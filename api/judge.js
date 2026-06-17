const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

const CATEGORIES = {
  job: {
    name: '채용공고',
    judgmentCriteria: [
      '50세 이상 지원 가능 또는 나이 제한 없음',
      '정규직/계약직/파트타임 등 고용형태 명시',
      '실제 채용 중인 공고 (마감 미확인)',
      '급여 정보 있으면 우선',
    ],
  },
  news: {
    name: '뉴스기사',
    judgmentCriteria: [
      '중장년(50대 이상) 관련 내용',
      '정책, 복지, 고용, 건강, 재취업 등 실용 주제',
      '최신 뉴스 (가능한 최근 3개월 이내)',
      '신뢰할 수 있는 언론사',
    ],
  },
  benefit: {
    name: '프로그램',
    judgmentCriteria: [
      '실제 신청 가능한 지원 제도',
      '지원 대상, 내용, 신청 방법 명시',
      '중장년(50대 이상) 대상',
      '정부/공공기관 출처 우선',
    ],
  },
  trend: {
    name: '인사이트',
    judgmentCriteria: [
      '중장년 관심사 관련 (건강, 취미, 재테크, 여행 등)',
      '실용적이고 유익한 정보',
      '긍정적이고 희망적인 콘텐츠 선호',
    ],
  },
}

const JUDGE_SYSTEM = `당신은 중장년(50대 이상) 대상 콘텐츠 소재를 선별하는 전문 에디터입니다.
구글 검색 결과를 받아 각 항목의 OK/NG를 판단하고 JSON으로만 응답하세요.

판단 기준:
- OK: 중장년(50대 이상)에게 실질적으로 유익한 정보
- OK: 신뢰할 수 있는 출처 (공공기관, 주요 언론, 공신력 있는 기업)
- NG: 낚시성/광고성 콘텐츠
- NG: 중장년과 관련 없는 내용
- NG: 출처 불명확

마크다운 없이 순수 JSON만 반환하세요.`

async function callGroq(systemText, userText) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemText }, { role: 'user', content: userText }],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq 오류: ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJsonFromText(text) {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 응답에서 JSON을 파싱할 수 없습니다')
  return JSON.parse(match[0])
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, category } = req.body || {}
  if (!url || !category) return res.status(400).json({ error: 'url과 category가 필요합니다' })

  const cat = CATEGORIES[category]
  if (!cat) return res.status(400).json({ error: '알 수 없는 카테고리입니다' })

  try {
    const userText = `아래 URL의 채용공고를 분석하고 JSON으로 응답해주세요.
카테고리: ${cat.name}
URL: ${url}

판단 기준:
${cat.judgmentCriteria.map(c => `- ${c}`).join('\n')}

반드시 아래 JSON 형식으로만 응답 (마크다운 없이):
{
  "title": "채용공고 제목",
  "url": "${url}",
  "summary": "1-2문장 요약",
  "judgment": "OK 또는 NG",
  "reason": "판단 이유",
  "category": "${category}",
  "employmentType": "고용형태",
  "priority": "high|medium|low",
  "collectedAt": "${new Date().toISOString()}"
}`

    const text = await callGroq(JUDGE_SYSTEM, userText)
    const item = parseJsonFromText(text)
    return res.status(200).json({
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userJudgment: item.judgment,
      uploaded: false,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || '서버 오류가 발생했습니다' })
  }
}
