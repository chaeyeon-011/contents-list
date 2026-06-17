import { useState } from 'react'
import { saveApiKey, saveSerperKey } from '../storage'
import { getSupabaseConfig, saveSupabaseConfig } from '../lib/supabase'

function KeyRow({ label, placeholder, value, onChange, onSave, saved }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 flex gap-1">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button onClick={() => setShow(!show)} className="text-xs text-gray-400 hover:text-gray-600 px-1">
          {show ? '숨김' : '보기'}
        </button>
        <button onClick={onSave} className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded whitespace-nowrap">
          {saved ? '✓' : '저장'}
        </button>
      </div>
    </div>
  )
}

export default function ApiKeyInput({ groqKey, serperKey, onSaveGroq, onSaveSerper, onSaveSupabase }) {
  const [open, setOpen] = useState(false)
  const [groqVal, setGroqVal] = useState(groqKey)
  const [serperVal, setSerperVal] = useState(serperKey)
  const sbConfig = getSupabaseConfig()
  const [sbUrl, setSbUrl] = useState(sbConfig.url)
  const [sbKey, setSbKey] = useState(sbConfig.key)

  const [groqSaved, setGroqSaved] = useState(false)
  const [serperSaved, setSerperSaved] = useState(false)
  const [sbSaved, setSbSaved] = useState(false)

  const allSet = !!groqKey && !!serperKey && !!sbConfig.url
  const partial = !allSet && (!!groqKey || !!serperKey || !!sbConfig.url)

  function handleSaveGroq() {
    saveApiKey(groqVal.trim()); onSaveGroq(groqVal.trim())
    setGroqSaved(true); setTimeout(() => setGroqSaved(false), 2000)
  }
  function handleSaveSerper() {
    saveSerperKey(serperVal.trim()); onSaveSerper(serperVal.trim())
    setSerperSaved(true); setTimeout(() => setSerperSaved(false), 2000)
  }
  function handleSaveSupabase() {
    saveSupabaseConfig(sbUrl, sbKey)
    onSaveSupabase()
    setSbSaved(true); setTimeout(() => setSbSaved(false), 2000)
  }

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        <span>⚙</span>
        <span>API 키 설정</span>
        {allSet && <span className="text-green-600 font-medium">✓ 모두 설정됨</span>}
        {partial && <span className="text-amber-500 font-medium">⚠ 일부 미설정</span>}
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI 검색</p>
            <KeyRow label="Groq API Key" placeholder="gsk_..." value={groqVal} onChange={setGroqVal} onSave={handleSaveGroq} saved={groqSaved} />
            <KeyRow label="Serper API Key" placeholder="abc123..." value={serperVal} onChange={setSerperVal} onSave={handleSaveSerper} saved={serperSaved} />
          </div>
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supabase (데이터 저장)</p>
            <KeyRow label="Project URL" placeholder="https://xxx.supabase.co" value={sbUrl} onChange={setSbUrl} onSave={() => {}} saved={false} />
            <KeyRow label="Anon Key" placeholder="eyJ..." value={sbKey} onChange={setSbKey} onSave={() => {}} saved={false} />
            <button
              onClick={handleSaveSupabase}
              className={`w-full text-xs py-1.5 rounded transition-colors ${sbSaved ? 'bg-green-500 text-white' : 'bg-gray-700 hover:bg-gray-800 text-white'}`}
            >
              {sbSaved ? '✓ Supabase 연결됨' : 'Supabase 저장 및 연결'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
