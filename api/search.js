const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const SERPER_URL = 'https://google.serper.dev/search'

const CATEGORIES = {
  job: {
    name: '채용공고',
    dailyQuota: 5,
    searchQuery: '중장년 채용공고 50대 60대 시니어 채용',
    judgmentCriteria: [
      '50세 이상 지원 가능 또는 나이 제한 없음',
      '정규직/계약직/파트타임 등 고용형태 명시',
      '실제 채용 중인 공고 (마감 미확인)',
      '급여 정보 있으면 우선',
    ],
  },
  news: {
    name: '뉴스기사',
    dailyQuota: 10,
    searchQuery: '중장년 시니어 50대 60대 정책 뉴스 고용 복지',
    judgmentCriteria: [
      '중장년(50대 이상) 관련 내용',
      '정책, 복지, 고용, 건강, 재취업 등 실용 주제',
      '최신 뉴스 (가능한 최근 3개월 이내)',
      '신뢰할 수 있는 언론사',
    ],
  },
  benefit: {
    name: '프로그램',
    dailyQuota: 5,
    searchQuery: '중장년 시니어 복지 지원 정부 지자체 프로그램 신청',
    judgmentCriteria: [
      '실제 신청 가능한 지원 제도',
      '지원 대상, 내용, 신청 방법 명시',
      '중장년(50대 이상) 대상',
      '정부/공공기관 출처 우선',
    ],
  },
  trend: {
    name: '인사이트',
    dailyQuota: 5,
    searchQuery: '중장년 시니어 라이프스타일 트렌드 건강 취미 여가 재테크',
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

async function searchWithSerper(query) {
  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': process.env.SERPER_API_KEY },
    body: JSON.stringify({ q: query, gl: 'kr', hl: 'ko', num: 10 }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Serper 오류: ${res.status}`)
  }
  const data = await res.json()
  return (data.organic || []).map(r => ({ title: r.title, url: r.link, snippet: r.snippet || '' }))
}

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

  const { category, collectedUrls = [] } = req.body || {}
  const cat = CATEGORIES[category]
  if (!cat) return res.status(400).json({ error: '알 수 없는 카테고리입니다' })

  try {
    const results = await searchWithSerper(cat.searchQuery)
    const fresh = results.filter(r => !collectedUrls.includes(r.url))
    if (fresh.length === 0) return res.status(200).json([])

    const resultList = fresh.map((r, i) =>
      `[${i + 1}] 제목: ${r.title}\nURL: ${r.url}\n요약: ${r.snippet}`
    ).join('\n\n')

    const userPrompt = `카테고리: ${cat.name}
목표 선별 수: 최대 ${cat.dailyQuota}개

판단 기준 (카테고리별):
${cat.judgmentCriteria.map(c => `- ${c}`).join('\n')}

아래 구글 검색 결과에서 중장년에게 유익한 항목을 최대 ${cat.dailyQuota}개 선별하고 OK/NG를 판단하세요.
${category === 'job' ? '채용공고는 고용형태와 우선순위(high/medium/low)도 판단하세요.' : ''}

검색 결과:
${resultList}

반드시 아래 JSON 형식으로만 응답 (마크다운 없이):
{
  "items": [
    {
      "title": "원래 제목 그대로",
      "url": "원래 URL 그대로",
      "summary": "1-2문장 한국어 요약 (중장년에게 왜 유익한지 포함)",
      "judgment": "OK 또는 NG",
      "reason": "판단 이유 1문장",
      "category": "${category}",
      "collectedAt": "${new Date().toISOString()}"${category === 'job' ? `,
      "employmentType": "정규직|계약직|파트타임|아르바이트|무기계약직|프리랜서",
      "priority": "high|medium|low"` : ''}
    }
  ]
}`

    const text = await callGroq(JUDGE_SYSTEM, userPrompt)
    const parsed = parseJsonFromText(text)
    const items = (parsed.items || [])
      .filter(item => item.url)
      .map(item => ({
        ...item,
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        userJudgment: item.judgment,
        uploaded: false,
      }))

    return res.status(200).json(items)
  } catch (e) {
    return res.status(500).json({ error: e.message || '서버 오류가 발생했습니다' })
  }
}
