import { createClient } from '@supabase/supabase-js'

let _client = null

export function getSupabase() {
  if (_client) return _client
  const url = import.meta.env.VITE_SUPABASE_URL || ''
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

export function resetSupabaseClient() {
  _client = null
}
