import { getSupabase } from './supabase'

export async function dbFetchNewsletterPerformance() {
  const sb = getSupabase()
  if (!sb) return []

  const { data, error } = await sb
    .from('newsletter_performance')
    .select('*')
    .order('issue_no', { ascending: false })

  if (error) throw new Error(`성과 데이터 불러오기 실패: ${error.message}`)
  return data ?? []
}

export async function dbSyncEmailStats(records) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase가 연결되어 있지 않습니다')

  const { error } = await sb
    .from('newsletter_performance')
    .upsert(records, { onConflict: 'issue_no' })

  if (error) throw new Error(`이메일 통계 저장 실패: ${error.message}`)
}

export async function dbUpdateKakaoStats(issueNo, kakaoData) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase가 연결되어 있지 않습니다')

  const { error } = await sb
    .from('newsletter_performance')
    .update({
      kakao_sent: kakaoData.kakaoSent ?? null,
      kakao_view: kakaoData.kakaoView ?? null,
      kakao_note: kakaoData.kakaoNote ?? null,
    })
    .eq('issue_no', issueNo)

  if (error) throw new Error(`카카오 통계 저장 실패: ${error.message}`)
}
