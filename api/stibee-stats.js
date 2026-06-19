const STIBEE_BASE = 'https://api.stibee.com/v2'

function normalizeRate(v) {
  const n = Number(v)
  if (isNaN(n) || n === 0) return null
  // Stibee may return 0-1 (decimal) or 0-100 (percentage); normalize to 0-100
  return parseFloat((n <= 1 ? n * 100 : n).toFixed(2))
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.STIBEE_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'STIBEE_API_KEY 환경변수가 설정되지 않았습니다' })

  try {
    const response = await fetch(`${STIBEE_BASE}/emails?limit=100`, {
      headers: { 'AccessToken': apiKey },
    })

    if (!response.ok) {
      const body = await response.text()
      return res.status(response.status).json({
        error: `스티비 API 오류 (${response.status}): ${body.slice(0, 300)}`,
      })
    }

    const data = await response.json()

    // Stibee returns { Ok: true, Value: [...] } or just an array
    const raw = Array.isArray(data)
      ? data
      : Array.isArray(data.Value)
        ? data.Value
        : Array.isArray(data.Value?.items)
          ? data.Value.items
          : []

    const emails = raw
      .map(e => {
        const stats = e.stats ?? e.statistics ?? {}
        const receivers = stats.receivers ?? {}
        const opens = stats.opens ?? {}
        const clicks = stats.clicks ?? {}

        const sentCount = Number(
          receivers.count ?? stats.sendCount ?? stats.totalCount ?? e.sendCount ?? 0
        ) || null

        const openRate = normalizeRate(opens.rate ?? stats.openRate ?? e.openRate ?? 0)
        const clickRate = normalizeRate(clicks.rate ?? stats.clickRate ?? e.clickRate ?? 0)

        const sentAt = e.scheduledAt ?? e.sendDate ?? e.sentAt ?? e.createdAt ?? null

        return {
          stibeeId: String(e.id ?? ''),
          subject: e.name ?? e.subject ?? e.title ?? '(제목 없음)',
          sentAt,
          emailSent: sentCount,
          emailOpenRate: openRate,
          emailClickRate: clickRate,
        }
      })
      .filter(e => e.sentAt)
      .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))

    return res.status(200).json({ emails, total: emails.length })
  } catch (e) {
    return res.status(500).json({ error: e.message ?? '서버 오류' })
  }
}
