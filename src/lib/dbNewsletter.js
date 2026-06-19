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

export async function dbInsertNewsletterPerformance(record) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase가 연결되어 있지 않습니다')

  const { error } = await sb.from('newsletter_performance').insert(record)
  if (error) throw new Error(`회차 추가 실패: ${error.message}`)
}

export async function dbUpdatePerformanceStats(issueNo, data) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase가 연결되어 있지 않습니다')

  const { error } = await sb
    .from('newsletter_performance')
    .update({
      issue_date: data.issueDate ?? null,
      email_sent: data.emailSent ?? null,
      email_open_rate: data.emailOpenRate ?? null,
      email_click_rate: data.emailClickRate ?? null,
      kakao_sent: data.kakaoSent ?? null,
      kakao_view: data.kakaoView ?? null,
      kakao_note: data.kakaoNote ?? null,
    })
    .eq('issue_no', issueNo)

  if (error) throw new Error(`성과 수정 실패: ${error.message}`)
}

// 스티비 프로 요금제 업그레이드 시 사용 가능
export async function dbSyncEmailStats(records) {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase가 연결되어 있지 않습니다')

  const { error } = await sb
    .from('newsletter_performance')
    .upsert(records, { onConflict: 'issue_no' })

  if (error) throw new Error(`이메일 통계 저장 실패: ${error.message}`)
}
