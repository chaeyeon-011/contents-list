import { useState, useEffect, useRef } from 'react'
import { getWeekId } from './utils/week'
import { dbFetchContents, dbUpdateContent, dbDeleteContent, dbMigrateFromLocalStorage } from './lib/db'
import { updateContent, deleteContent } from './storage'
import ListingPage from './pages/ListingPage'
import PastWeeksPage from './pages/PastWeeksPage'
import DashboardPage from './pages/DashboardPage'
import NewsletterPerformancePage from './pages/NewsletterPerformancePage'

export default function App() {
  const currentWeekId = getWeekId()
  const [contents, setContents] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('listing')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  async function loadContents() {
    setLoading(true)
    try {
      await dbMigrateFromLocalStorage()
      const data = await dbFetchContents()
      setContents(data)
    } catch (e) {
      console.error('데이터 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContents() }, [])

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  function navigate(target) { setPage(target); setMenuOpen(false) }

  async function handleUpdateJudgment(id, judgment) {
    const updates = { userJudgment: judgment, ...(judgment === 'NG' ? { uploaded: false } : {}) }
    setContents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    try {
      await dbUpdateContent(id, updates)
      updateContent(id, updates)
    } catch (e) { console.error(e) }
  }

  async function handleUpdateUploaded(id, uploaded) {
    setContents(prev => prev.map(c => c.id === id ? { ...c, uploaded } : c))
    try {
      await dbUpdateContent(id, { uploaded })
      updateContent(id, { uploaded })
    } catch (e) { console.error(e) }
  }

  async function handleDelete(id) {
    setContents(prev => prev.filter(c => c.id !== id))
    try {
      await dbDeleteContent(id)
      deleteContent(id)
    } catch (e) { console.error(e) }
  }

  const PAGE_LABELS = { listing: '리스트업', past: '이전 주차', dashboard: '대시보드', performance: '성과분석' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">중장년 콘텐츠 AI 리스트업</h1>
              {page !== 'listing' && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                  {PAGE_LABELS[page]}
                </span>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex flex-col gap-1.5 p-2 rounded hover:bg-gray-100 transition-colors"
              >
                <span className="block w-5 h-0.5 bg-gray-600" />
                <span className="block w-5 h-0.5 bg-gray-600" />
                <span className="block w-5 h-0.5 bg-gray-600" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  <button onClick={() => navigate('dashboard')} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${page === 'dashboard' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                    <span>📊</span> 대시보드
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => navigate('listing')} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${page === 'listing' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                    <span>📋</span><span>리스트업</span><span className="text-xs text-gray-400 ml-auto">현재 주차</span>
                  </button>
                  <button onClick={() => navigate('past')} className={`w-full text-left pl-9 pr-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${page === 'past' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                    <span>└</span><span>이전 주차</span>
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => navigate('performance')} className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 ${page === 'performance' ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
                    <span>📈</span> 성과분석
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <span className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mr-3" />
            데이터 불러오는 중...
          </div>
        ) : (
          <>
            {page === 'listing' && (
              <ListingPage
                selectedWeek={currentWeekId}
                contents={contents}
                setContents={setContents}
                onUpdateJudgment={handleUpdateJudgment}
                onUpdateUploaded={handleUpdateUploaded}
                onDelete={handleDelete}
              />
            )}
            {page === 'past' && (
              <PastWeeksPage
                contents={contents}
                setContents={setContents}
                onUpdateJudgment={handleUpdateJudgment}
                onUpdateUploaded={handleUpdateUploaded}
                onDelete={handleDelete}
              />
            )}
            {page === 'dashboard' && (
              <DashboardPage
                contents={contents}
                setContents={setContents}
                onUpdateJudgment={handleUpdateJudgment}
                onUpdateUploaded={handleUpdateUploaded}
                onDelete={handleDelete}
              />
            )}
            {page === 'performance' && (
              <NewsletterPerformancePage />
            )}
          </>
        )}
      </main>
    </div>
  )
}
