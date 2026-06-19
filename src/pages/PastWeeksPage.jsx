import { useState } from 'react'
import { CATEGORIES } from '../constants'
import { getViewMode, saveViewMode, getTabViewModes, saveTabViewModes } from '../storage'
import { dbAddContent, dbGetCollectedUrls } from '../lib/db'
import { addContent } from '../storage'
import { getWeekId, getWeekLabel, getAvailableWeeks } from '../utils/week'
import { searchContents, judgeUrl } from '../claudeApi'
import ContentCard from '../components/ContentCard'

export default function PastWeeksPage({
  contents, setContents,
  onUpdateJudgment, onUpdateUploaded, onDelete,
}) {
  const currentWeekId = getWeekId()
  const pastWeeks = getAvailableWeeks(contents).filter(w => w !== currentWeekId).reverse()

  const [selectedWeek, setSelectedWeek] = useState(pastWeeks[0] || '')
  const [activeTab, setActiveTab] = useState('job')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [manualUrl, setManualUrl] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [globalViewMode, setGlobalViewMode] = useState(getViewMode)
  const [tabViewModes, setTabViewModes] = useState(getTabViewModes)

  const currentViewMode = tabViewModes[activeTab] ?? globalViewMode
  const currentCategory = CATEGORIES.find(c => c.id === activeTab)
  const filtered = selectedWeek ? contents.filter(c => c.category === activeTab && c.weekId === selectedWeek) : []

  function handleGlobalViewMode(mode) {
    setGlobalViewMode(mode); saveViewMode(mode)
    const newModes = {}
    CATEGORIES.forEach(cat => { newModes[cat.id] = mode })
    setTabViewModes(newModes); saveTabViewModes(newModes)
  }

  function handleTabViewMode(mode) {
    const newModes = { ...tabViewModes, [activeTab]: mode }
    setTabViewModes(newModes); saveTabViewModes(newModes)
  }

  async function handleSearch() {
    setError(''); setInfo(''); setLoading(true)
    try {
      const collectedUrls = await dbGetCollectedUrls()
      const items = await searchContents(activeTab, collectedUrls)
      if (items.length === 0) { setInfo('이미 수집한 소재와 중복되어 새로운 결과가 없습니다.'); return }
      const withWeek = items.map(item => ({ ...item, weekId: selectedWeek }))
      for (const item of withWeek) { await dbAddContent(item); addContent(item) }
      setContents(prev => [...withWeek, ...prev])
      setInfo(`${items.length}개 소재를 수집했습니다.`)
    } catch (e) {
      setError(e.message || '검색 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddUrl() {
    if (!manualUrl.trim()) return
    const collectedUrls = await dbGetCollectedUrls()
    if (collectedUrls.includes(manualUrl.trim())) { setError('이미 수집된 URL입니다.'); return }
    setError(''); setInfo(''); setAddingUrl(true)
    try {
      const item = await judgeUrl(manualUrl.trim(), activeTab)
      const withWeek = { ...item, weekId: selectedWeek }
      await dbAddContent(withWeek); addContent(withWeek)
      setContents(prev => [withWeek, ...prev])
      setManualUrl('')
    } catch (e) { setError(e.message || 'URL 분석 중 오류가 발생했습니다.') }
    finally { setAddingUrl(false) }
  }

  if (pastWeeks.length === 0) {
    return (
      <div className="text-center text-gray-400 py-20">
        <p className="text-4xl mb-4">📭</p>
        <p className="text-sm">이전 주차 데이터가 없습니다.</p>
      </div>
    )
  }

  const okCount = filtered.filter(c => c.userJudgment === 'OK').length
  const uploadedCount = filtered.filter(c => c.uploaded).length
  const quota = currentCategory?.dailyQuota || 0

  return (
    <div>
      <div className="mb-4">
        <select value={selectedWeek} onChange={e => { setSelectedWeek(e.target.value); setError(''); setInfo('') }}
          className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
          {pastWeeks.map(weekId => <option key={weekId} value={weekId}>{getWeekLabel(weekId)}</option>)}
        </select>
      </div>

      <div className="flex justify-end mb-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => handleGlobalViewMode('detail')} className={`text-xs px-3 py-1 rounded-md transition-colors ${globalViewMode === 'detail' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'}`}>자세히 보기</button>
          <button onClick={() => handleGlobalViewMode('compact')} className={`text-xs px-3 py-1 rounded-md transition-colors ${globalViewMode === 'compact' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'}`}>간략히 보기</button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 min-w-max sm:min-w-0">
          {CATEGORIES.map(cat => {
            const catOk = contents.filter(c => c.category === cat.id && c.weekId === selectedWeek && c.userJudgment === 'OK').length
            return (
              <button key={cat.id} onClick={() => { setActiveTab(cat.id); setError(''); setInfo('') }}
                className={`flex-1 min-w-[70px] text-sm py-2 px-2 rounded-md transition-colors ${activeTab === cat.id ? 'bg-white shadow text-blue-600 font-semibold' : 'text-gray-600'}`}>
                <span className="block text-xs">{cat.name}</span>
                <span className="text-xs opacity-60">{catOk}/{cat.dailyQuota}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex gap-2 sm:gap-4 text-xs sm:text-sm flex-wrap">
            <span className="text-gray-500">수집: <strong>{filtered.length}</strong></span>
            <span className="text-green-600">OK: <strong>{okCount}</strong>/{quota}</span>
            <span className="text-blue-600">업로드: <strong>{uploadedCount}</strong></span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${okCount >= quota ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{okCount >= quota ? '목표 달성' : `${quota - okCount}개 남음`}</div>
            <div className="flex gap-0.5 bg-gray-100 rounded p-0.5">
              <button onClick={() => handleTabViewMode('detail')} className={`text-xs px-2 py-0.5 rounded ${currentViewMode === 'detail' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>☰</button>
              <button onClick={() => handleTabViewMode('compact')} className={`text-xs px-2 py-0.5 rounded ${currentViewMode === 'compact' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}>≡</button>
            </div>
          </div>
        </div>
        <button onClick={handleSearch} disabled={loading || !selectedWeek}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          {loading ? <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />AI 검색 중...</> : `AI로 ${currentCategory?.name} 검색 (${quota}개 목표)`}
        </button>
        {activeTab === 'job' && (
          <div className="mt-3 flex gap-2">
            <input type="url" value={manualUrl} onChange={e => setManualUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
              placeholder="채용공고 URL 직접 입력..." className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
            <button onClick={handleAddUrl} disabled={addingUrl || !manualUrl.trim()} className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white text-sm px-3 py-1.5 rounded whitespace-nowrap">
              {addingUrl ? '분석 중...' : 'AI 판단 추가'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}
      {info && !error && <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-2 mb-4">{info}</div>}

      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12 text-sm">이 주차에 수집된 소재가 없습니다.</div>
      ) : currentViewMode === 'compact' ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {filtered.map(item => <ContentCard key={item.id} item={item} compact={true} onUpdateJudgment={onUpdateJudgment} onUpdateUploaded={onUpdateUploaded} onDelete={onDelete} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => <ContentCard key={item.id} item={item} compact={false} onUpdateJudgment={onUpdateJudgment} onUpdateUploaded={onUpdateUploaded} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  )
}
