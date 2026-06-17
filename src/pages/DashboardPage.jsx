import { useState } from 'react'
import { CATEGORIES, PRIORITY_LABELS, EMPLOYMENT_TYPES } from '../constants'
import { resetAllData } from '../storage'
import { dbResetAllContents } from '../lib/db'
import ContentCard from '../components/ContentCard'

function getNewsletterDeadline() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
  const friday = new Date(today)
  friday.setDate(today.getDate() + daysUntilFriday)
  return friday
}

export default function DashboardPage({ contents, setContents, onUpdateJudgment, onUpdateUploaded, onDelete }) {
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const deadline = getNewsletterDeadline()
  const today = new Date()
  const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))

  async function handleReset() {
    resetAllData()
    await dbResetAllContents().catch(() => {})
    setContents([])
    setShowResetConfirm(false)
  }

  const filtered = contents.filter(item => {
    if (filterCategory !== 'all' && item.category !== filterCategory) return false
    if (filterStatus === 'ok' && item.userJudgment !== 'OK') return false
    if (filterStatus === 'pending' && (item.userJudgment !== 'OK' || item.uploaded)) return false
    return true
  })

  return (
    <div>
      {/* Newsletter Deadline */}
      <div className={`rounded-lg p-4 mb-4 border ${daysLeft <= 1 ? 'bg-red-50 border-red-200' : daysLeft <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">뉴스레터 마감</p>
            <p className="text-sm font-semibold text-gray-800">
              {deadline.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
              <span className={`ml-2 text-xs font-normal ${daysLeft <= 1 ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-blue-600'}`}>
                ({daysLeft === 0 ? '오늘 마감!' : `${daysLeft}일 남음`})
              </span>
            </p>
          </div>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded transition-colors"
          >
            데이터 초기화
          </button>
        </div>
      </div>

      {/* Reset Confirm */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 mx-4 max-w-sm w-full shadow-xl">
            <p className="font-semibold text-gray-900 mb-2">모든 데이터를 초기화할까요?</p>
            <p className="text-sm text-gray-500 mb-4">수집된 소재와 이력이 모두 삭제됩니다. 되돌릴 수 없습니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">취소</button>
              <button onClick={handleReset} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium">초기화</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {CATEGORIES.map(cat => {
          const items = contents.filter(c => c.category === cat.id)
          const ok = items.filter(c => c.userJudgment === 'OK').length
          const uploaded = items.filter(c => c.uploaded).length
          const progress = Math.min((ok / cat.dailyQuota) * 100, 100)

          return (
            <div key={cat.id} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-gray-800">{cat.name}</p>
                <span className="text-xs text-gray-400">{items.length}개 수집</span>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 mb-2">
                <span className="text-green-600 font-medium">OK {ok}/{cat.dailyQuota}</span>
                <span className="text-blue-600">업로드 {uploaded}</span>
                {ok - uploaded > 0 && <span className="text-orange-500">미업로드 {ok - uploaded}</span>}
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${progress >= 100 ? 'bg-green-500' : 'bg-blue-400'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Total Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="flex gap-6 text-sm text-center">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-800">{contents.length}</p>
            <p className="text-xs text-gray-400">전체 수집</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-green-600">{contents.filter(c => c.userJudgment === 'OK').length}</p>
            <p className="text-xs text-gray-400">OK 소재</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-blue-600">{contents.filter(c => c.uploaded).length}</p>
            <p className="text-xs text-gray-400">업로드 완료</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-orange-500">
              {contents.filter(c => c.userJudgment === 'OK' && !c.uploaded).length}
            </p>
            <p className="text-xs text-gray-400">업로드 대기</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setFilterCategory('all')}
            className={`text-xs px-3 py-1 rounded-md transition-colors ${filterCategory === 'all' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'}`}
          >
            전체
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${filterCategory === cat.id ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { value: 'all', label: '전체' },
            { value: 'ok', label: 'OK만' },
            { value: 'pending', label: '미업로드' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterStatus(f.value)}
              className={`text-xs px-3 py-1 rounded-md transition-colors ${filterStatus === f.value ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            조건에 맞는 소재가 없습니다.
          </div>
        ) : (
          filtered.map(item => (
            <ContentCard
              key={item.id}
              item={item}
              onUpdateJudgment={onUpdateJudgment}
              onUpdateUploaded={onUpdateUploaded}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
