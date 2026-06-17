import { createClient } from '@supabase/supabase-js'

let _client = null

export function getSupabase() {
  if (_client) return _client
  const url = localStorage.getItem('sb_url') || import.meta.env.VITE_SUPABASE_URL || ''
  const key = localStorage.getItem('sb_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

export function resetSupabaseClient() {
  _client = null
}

export function getSupabaseConfig() {
  return {
    url: localStorage.getItem('sb_url') || '',
    key: localStorage.getItem('sb_key') || '',
  }
}

export function saveSupabaseConfig(url, key) {
  localStorage.setItem('sb_url', url.trim())
  localStorage.setItem('sb_key', key.trim())
  resetSupabaseClient()
}
