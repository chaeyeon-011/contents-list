export const CATEGORIES = [
  {
    id: 'job',
    name: '채용공고',
    dailyQuota: 5,
    description: '중장년 친화 채용공고',
    searchQuery: `중장년 채용공고 50대 60대 시니어 채용`,
    judgmentCriteria: [
      '50세 이상 지원 가능 또는 나이 제한 없음',
      '정규직/계약직/파트타임 등 고용형태 명시',
      '실제 채용 중인 공고 (마감 미확인)',
      '급여 정보 있으면 우선',
    ],
    priorityRules: {
      high: ['정규직', '공기업', '대기업', '무기계약직'],
      medium: ['계약직', '중견기업'],
      low: ['파트타임', '아르바이트', '프리랜서'],
    },
  },
  {
    id: 'news',
    name: '뉴스기사',
    dailyQuota: 10,
    description: '중장년층 관련 정책·트렌드 뉴스',
    searchQuery: `중장년 시니어 50대 60대 정책 뉴스 고용 복지`,
    judgmentCriteria: [
      '중장년(50대 이상) 관련 내용',
      '정책, 복지, 고용, 건강, 재취업 등 실용 주제',
      '최신 뉴스 (가능한 최근 3개월 이내)',
      '신뢰할 수 있는 언론사',
    ],
  },
  {
    id: 'benefit',
    name: '프로그램',
    dailyQuota: 5,
    description: '정부/지자체 복지 및 지원 프로그램',
    searchQuery: `중장년 시니어 복지 지원 정부 지자체 프로그램 신청`,
    judgmentCriteria: [
      '실제 신청 가능한 지원 제도',
      '지원 대상, 내용, 신청 방법 명시',
      '중장년(50대 이상) 대상',
      '정부/공공기관 출처 우선',
    ],
  },
  {
    id: 'trend',
    name: '인사이트',
    dailyQuota: 5,
    description: '중장년 라이프스타일 및 트렌드',
    searchQuery: `중장년 시니어 라이프스타일 트렌드 건강 취미 여가 재테크`,
    judgmentCriteria: [
      '중장년 관심사 관련 (건강, 취미, 재테크, 여행 등)',
      '실용적이고 유익한 정보',
      '긍정적이고 희망적인 콘텐츠 선호',
    ],
  },
]

export const EMPLOYMENT_TYPES = {
  정규직: { color: 'bg-blue-100 text-blue-800', priority: 1 },
  무기계약직: { color: 'bg-blue-100 text-blue-800', priority: 2 },
  계약직: { color: 'bg-yellow-100 text-yellow-800', priority: 3 },
  파트타임: { color: 'bg-gray-100 text-gray-700', priority: 4 },
  아르바이트: { color: 'bg-gray-100 text-gray-700', priority: 5 },
  프리랜서: { color: 'bg-purple-100 text-purple-700', priority: 6 },
}

export const PRIORITY_LABELS = {
  high: { label: '우선', color: 'bg-red-100 text-red-700' },
  medium: { label: '보통', color: 'bg-orange-100 text-orange-700' },
  low: { label: '낮음', color: 'bg-gray-100 text-gray-600' },
}

export const STORAGE_KEYS = {
  CONTENTS: 'ai_tool_contents',
  COLLECTED_URLS: 'ai_tool_collected_urls',
  VIEW_MODE: 'ai_tool_view_mode',
  TAB_VIEW_MODES: 'ai_tool_tab_view_modes',
}
