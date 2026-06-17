import { getSupabase } from './supabase'
import { getContents, saveContents, getCollectedUrls, saveCollectedUrls } from '../storage'

function toRow(item) {
  return {
    id: item.id,
    title: item.title,
    url: item.url || '',
    summary: item.summary || '',
    judgment: item.judgment || '',
    user_judgment: item.userJudgment || '',
    reason: item.reason || '',
    category: item.category,
    week_id: item.weekId || '',
    collected_at: item.collectedAt || new Date().toISOString(),
    uploaded: item.uploaded || false,
    employment_type: item.employmentType || null,
    priority: item.priority || null,
  }
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    summary: row.summary,
    judgment: row.judgment,
    userJudgment: row.user_judgment,
    reason: row.reason,
    category: row.category,
    weekId: row.week_id,
    collectedAt: row.collected_at,
    uploaded: row.uploaded,
    employmentType: row.employment_type,
    priority: row.priority,
  }
}

export async function dbFetchContents() {
  const sb = getSupabase()
  if (!sb) return getContents() // localStorage fallback

  const { data, error } = await sb
    .from('contents')
    .select('*')
    .order('collected_at', { ascending: false })

  if (error) throw new Error(`데이터 불러오기 실패: ${error.message}`)
  return data.map(fromRow)
}

export async function dbAddContent(item) {
  const sb = getSupabase()
  if (!sb) {
    // localStorage fallback
    const list = getContents()
    list.unshift(item)
    saveContents(list)
    const urls = getCollectedUrls()
    if (!urls.includes(item.url)) saveCollectedUrls([...urls, item.url])
    return
  }
  const { error } = await sb.from('contents').insert(toRow(item))
  if (error) throw new Error(`소재 저장 실패: ${error.message}`)
}

export async function dbUpdateContent(id, updates) {
  const sb = getSupabase()
  if (!sb) return // localStorage handled by caller

  const mapped = {}
  if (updates.userJudgment !== undefined) mapped.user_judgment = updates.userJudgment
  if (updates.uploaded !== undefined) mapped.uploaded = updates.uploaded

  const { error } = await sb.from('contents').update(mapped).eq('id', id)
  if (error) throw new Error(`소재 수정 실패: ${error.message}`)
}

export async function dbDeleteContent(id) {
  const sb = getSupabase()
  if (!sb) return

  const { error } = await sb.from('contents').delete().eq('id', id)
  if (error) throw new Error(`소재 삭제 실패: ${error.message}`)
}

export async function dbGetCollectedUrls() {
  const sb = getSupabase()
  if (!sb) return getCollectedUrls()

  const { data, error } = await sb.from('contents').select('url')
  if (error) return getCollectedUrls()
  return data.map(r => r.url).filter(Boolean)
}

export async function dbResetAllContents() {
  const sb = getSupabase()
  if (!sb) return
  await sb.from('contents').delete().neq('id', '')
}

export async function dbMigrateFromLocalStorage() {
  const sb = getSupabase()
  if (!sb) return

  const { data } = await sb.from('contents').select('id').limit(1)
  if (data && data.length > 0) return // 이미 데이터 있음, 마이그레이션 스킵

  const localContents = getContents()
  if (localContents.length === 0) return

  const rows = localContents.map(toRow)
  const { error } = await sb.from('contents').insert(rows)
  if (!error) {
    console.log(`localStorage 데이터 ${localContents.length}개를 Supabase로 이전했습니다.`)
  }
}
