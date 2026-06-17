import { CATEGORIES } from './constants'
import { getCollectedUrls } from './storage'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const SERPER_URL = 'https://google.serper.dev/search'

async function searchWithSerper(serperKey, query) {
  const response = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': serperKey,
    },
    body: JSON.stringify({ q: query, gl: 'kr', hl: 'ko', num: 10 }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `Serper 오류: ${response.status}`)
  }
  const data = await response.json()
  return (data.organic || []).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || '',
  }))
}

async function callGroq(groqKey, systemText, userText) {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: userText },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq 오류: ${response.status}`)
  }
  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

function parseJsonFromText(text) {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI 응답에서 JSON을 파싱할 수 없습니다')
  return JSON.parse(match[0])
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

export async function searchContents(groqKey, serperKey, category, collectedUrls) {
  const cat = CATEGORIES.find(c => c.id === category)
  if (!collectedUrls) collectedUrls = getCollectedUrls()

  // 1. Serper로 실제 구글 검색
  const results = await searchWithSerper(serperKey, cat.searchQuery)

  // 2. 이미 수집된 URL 제외
  const fresh = results.filter(r => !collectedUrls.includes(r.url))
  if (fresh.length === 0) return []

  // 3. Groq로 OK/NG 판단
  const resultList = fresh.map((r, i) =>
    `[${i + 1}] 제목: ${r.title}\nURL: ${r.url}\n요약: ${r.snippet}`
  ).join('\n\n')

  const userPrompt = `카테고리: ${cat.name}
목표 선별 수: 최대 ${cat.dailyQuota}개

판단 기준 (카테고리별):
${cat.judgmentCriteria.map(c => `- ${c}`).join('\n')}

아래 구글 검색 결과에서 중장년에게 유익한 항목을 최대 ${cat.dailyQuota}개 선별하고 OK/NG를 판단하세요.
${cat.id === 'job' ? '채용공고는 고용형태와 우선순위(high/medium/low)도 판단하세요.' : ''}

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
      "collectedAt": "${new Date().toISOString()}"${cat.id === 'job' ? `,
      "employmentType": "정규직|계약직|파트타임|아르바이트|무기계약직|프리랜서",
      "priority": "high|medium|low"` : ''}
    }
  ]
}`

  const text = await callGroq(groqKey, JUDGE_SYSTEM, userPrompt)
  const parsed = parseJsonFromText(text)
  const items = parsed.items || []

  return items
    .filter(item => item.url)
    .map(item => ({
      ...item,
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      userJudgment: item.judgment,
      uploaded: false,
    }))
}

export async function judgeUrl(groqKey, url, category) {
  const cat = CATEGORIES.find(c => c.id === category)

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

  const text = await callGroq(groqKey, JUDGE_SYSTEM, userText)
  const item = parseJsonFromText(text)
  return {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    userJudgment: item.judgment,
    uploaded: false,
  }
}
