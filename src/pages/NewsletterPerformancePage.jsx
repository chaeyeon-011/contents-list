import { Fragment, useState, useEffect } from 'react'
import {
  dbFetchNewsletterPerformance,
  dbInsertNewsletterPerformance,
  dbUpdatePerformanceStats,
  dbUpdateSortOrders,
  dbDeleteNewsletterPerformance,
} from '../lib/dbNewsletter'

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  } catch { return dateStr }
}

function fmtRate(v) {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return '—'
  return `${n.toFixed(1)}%`
}

function fmtNum(v) {
  if (v === null || v === undefined) return '—'
  const n = Number(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString()
}

function avgOf(arr, key) {
  const vals = arr.map(r => Number(r[key])).filter(v => !isNaN(v) && v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

const EMPTY_FORM = {
  issueDate: '',
  emailSent: '',
  emailOpenRate: '',
  emailClickRate: '',
  kakaoSent: '',
  kakaoView: '',
  kakaoNote: '',
}

function LineChart({ data, series, yUnit = '' }) {
  const W = 560, H = 190
  const pad = { top: 16, right: 20, bottom: 36, left: 48 }
  const plotW = W - pad.left - pad.right
  const plotH = H - pad.top - pad.bottom

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        데이터 없음
      </div>
    )
  }

  const allVals = series.flatMap(s => data.map(d => Number(d[s.key] ?? 0))).filter(v => !isNaN(v))
  const rawMax = Math.max(...allVals, 0.01)
  const yMax = yUnit === '%'
    ? Math.ceil((rawMax * 1.25) / 10) * 10 || 100
    : Math.ceil((rawMax * 1.25) / 100) * 100 || 1000
  const gridCount = 4

  const cx = i => pad.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2)
  const cy = v => pad.top + plotH - (Math.min(Number(v ?? 0), yMax) / yMax) * plotH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
      {Array.from({ length: gridCount + 1 }, (_, k) => {
        const t = k / gridCount
        const yp = pad.top + plotH * (1 - t)
        return (
          <g key={k}>
            <line x1={pad.left} y1={yp} x2={W - pad.right} y2={yp} stroke="#e5e7eb" strokeWidth="1" />
            <text x={pad.left - 4} y={yp + 4} textAnchor="end" fontSize="11" fill="#9ca3af">
              {Math.round(yMax * t)}{yUnit}
            </text>
          </g>
        )
      })}
      {series.map(s => (
        <polyline
          key={s.key}
          points={data.map((d, i) => `${cx(i)},${cy(d[s.key] ?? 0)}`).join(' ')}
          fill="none" stroke={s.color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round"
        />
      ))}
      {series.map(s =>
        data.map((d, i) => (
          <circle key={`${s.key}-${i}`} cx={cx(i)} cy={cy(d[s.key] ?? 0)}
            r="4" fill="white" stroke={s.color} strokeWidth="2" />
        ))
      )}
      {data.map((d, i) => (
        <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
          #{d.issue_no}
        </text>
      ))}
    </svg>
  )
}

function FormFields({ form, onChange }) {
  const field = (key, label, opts = {}) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      <input
        type={opts.type ?? 'number'}
        step={opts.step}
        value={form[key]}
        onChange={e => onChange(key, e.target.value)}
        className={`border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm ${opts.wide ? 'w-full' : opts.date ? 'w-36' : 'w-28'}`}
        placeholder={opts.placeholder ?? ''}
      />
    </div>
  )

  return (
    <div className="space-y-3">
      <div>
        {field('issueDate', '발행일 *', { type: 'date', date: true })}
      </div>
      <div>
        <p className="text-xs font-medium text-blue-600 mb-2">이메일</p>
        <div className="flex flex-wrap gap-3">
          {field('emailSent', '발송수', { placeholder: '0' })}
          {field('emailOpenRate', '오픈율 (%)', { step: '0.1', placeholder: '0.0' })}
          {field('emailClickRate', '클릭률 (%)', { step: '0.1', placeholder: '0.0' })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-yellow-600 mb-2">카카오톡</p>
        <div className="flex flex-wrap gap-3">
          {field('kakaoSent', '발송수', { placeholder: '0' })}
          {field('kakaoView', '조회수', { placeholder: '0' })}
        </div>
      </div>
      {field('kakaoNote', '비고 (선택)', { type: 'text', wide: true, placeholder: '메모를 입력하세요' })}
    </div>
  )
}

export default function NewsletterPerformancePage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addingRecord, setAddingRecord] = useState(false)
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [savingRow, setSavingRow] = useState(null)
  const [deletingRow, setDeletingRow] = useState(null)
  const [dragIndex, setDragIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [activeChart, setActiveChart] = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError('')
    try {
      const data = await dbFetchNewsletterPerformance()
      setRecords(data)
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function updateAddForm(key, value) {
    setAddForm(f => ({ ...f, [key]: value }))
  }

  function updateEditForm(key, value) {
    setEditForm(f => ({ ...f, [key]: value }))
  }

  async function handleAddSubmit() {
    if (!addForm.issueDate) { alert('발행일을 입력해주세요'); return }
    setAddingRecord(true)
    try {
      const maxNo = records.length ? Math.max(...records.map(r => r.issue_no)) : 0
      const minSort = records.length ? Math.min(...records.map(r => r.sort_order ?? 0)) : 0
      await dbInsertNewsletterPerformance({
        issue_no: maxNo + 1,
        issue_date: addForm.issueDate,
        sort_order: minSort - 1,
        email_sent: numOrNull(addForm.emailSent),
        email_open_rate: numOrNull(addForm.emailOpenRate),
        email_click_rate: numOrNull(addForm.emailClickRate),
        kakao_sent: numOrNull(addForm.kakaoSent),
        kakao_view: numOrNull(addForm.kakaoView),
        kakao_note: addForm.kakaoNote || null,
      })
      // 추가 후 발행일 내림차순으로 sort_order 재정렬
      const fresh = await dbFetchNewsletterPerformance()
      const byDate = [...fresh].sort((a, b) => {
        if (!a.issue_date) return 1
        if (!b.issue_date) return -1
        return new Date(b.issue_date) - new Date(a.issue_date)
      })
      await dbUpdateSortOrders(byDate.map((r, i) => ({ id: r.id, sort_order: i })))
      const final = await dbFetchNewsletterPerformance()
      setRecords(final)
      setShowAddForm(false)
      setAddForm(EMPTY_FORM)
    } catch (e) {
      alert('추가 실패: ' + e.message)
    } finally {
      setAddingRecord(false)
    }
  }

  function startEdit(record) {
    setShowAddForm(false)
    setEditingRow(record.issue_no)
    setEditForm({
      issueDate: record.issue_date ?? '',
      emailSent: record.email_sent ?? '',
      emailOpenRate: record.email_open_rate ?? '',
      emailClickRate: record.email_click_rate ?? '',
      kakaoSent: record.kakao_sent ?? '',
      kakaoView: record.kakao_view ?? '',
      kakaoNote: record.kakao_note ?? '',
    })
  }

  function handleDragStart(e, index) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, index) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDrop(e, index) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) {
      handleDragEnd()
      return
    }
    const reordered = [...records]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(index, 0, moved)
    setRecords(reordered)
    handleDragEnd()
    saveReorder(reordered)
  }

  async function saveReorder(reordered) {
    try {
      await dbUpdateSortOrders(reordered.map((r, i) => ({ id: r.id, sort_order: i })))
    } catch {
      const fresh = await dbFetchNewsletterPerformance()
      setRecords(fresh)
    }
  }

  async function handleDelete(issueNo) {
    if (!window.confirm(`#${issueNo} 회차를 삭제하시겠습니까?`)) return
    setDeletingRow(issueNo)
    try {
      await dbDeleteNewsletterPerformance(issueNo)
      setRecords(prev => prev.filter(r => r.issue_no !== issueNo))
      if (editingRow === issueNo) setEditingRow(null)
    } catch (e) {
      alert('삭제 실패: ' + e.message)
    } finally {
      setDeletingRow(null)
    }
  }

  async function handleEditSave(issueNo) {
    setSavingRow(issueNo)
    try {
      const payload = {
        issueDate: editForm.issueDate || null,
        emailSent: numOrNull(editForm.emailSent),
        emailOpenRate: numOrNull(editForm.emailOpenRate),
        emailClickRate: numOrNull(editForm.emailClickRate),
        kakaoSent: numOrNull(editForm.kakaoSent),
        kakaoView: numOrNull(editForm.kakaoView),
        kakaoNote: editForm.kakaoNote || null,
      }
      await dbUpdatePerformanceStats(issueNo, payload)
      setRecords(prev => prev.map(r =>
        r.issue_no === issueNo
          ? {
              ...r,
              issue_date: payload.issueDate,
              email_sent: payload.emailSent,
              email_open_rate: payload.emailOpenRate,
              email_click_rate: payload.emailClickRate,
              kakao_sent: payload.kakaoSent,
              kakao_view: payload.kakaoView,
              kakao_note: payload.kakaoNote,
            }
          : r
      ))
      setEditingRow(null)
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSavingRow(null)
    }
  }

  const chartData = [...records].sort((a, b) => a.issue_no - b.issue_no)
  const latest = records[0] ?? null
  const recentFour = records.slice(0, 4)
  const avgOpen = avgOf(recentFour.filter(r => r.email_open_rate != null), 'email_open_rate')
  const avgClick = avgOf(recentFour.filter(r => r.email_click_rate != null), 'email_click_rate')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <span className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mr-3" />
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">뉴스레터 성과분석</h2>
          <p className="text-sm text-gray-500 mt-0.5">이메일 + 카카오톡 채널 메시지 발행 성과</p>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setEditingRow(null) }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <span className="text-base leading-none">+</span> 성과 추가하기
        </button>
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {loadError}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">새 회차 추가</h3>
            <button
              onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM) }}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ✕
            </button>
          </div>
          <FormFields form={addForm} onChange={updateAddForm} />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM) }}
              className="px-4 py-2 text-sm bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAddSubmit}
              disabled={addingRecord}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {addingRecord ? '추가 중…' : '저장하기'}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && !loadError && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-base text-gray-600 font-medium mb-1">성과 데이터가 없습니다</p>
          <p className="text-sm">성과 추가하기 버튼으로 첫 번째 회차를 입력해보세요</p>
        </div>
      )}

      {records.length > 0 && (
        <>
          {/* Summary cards */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              최근 회차 {latest ? `(#${latest.issue_no} · ${fmtDate(latest.issue_date)})` : ''}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">이메일 발송수</p>
                <p className="text-2xl font-bold text-gray-900">{fmtNum(latest?.email_sent)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">오픈율</p>
                <p className="text-2xl font-bold text-blue-600">{fmtRate(latest?.email_open_rate)}</p>
                {avgOpen !== null && (
                  <p className="text-xs text-gray-400 mt-1">최근 4회 평균 {fmtRate(avgOpen)}</p>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">클릭률</p>
                <p className="text-2xl font-bold text-indigo-600">{fmtRate(latest?.email_click_rate)}</p>
                {avgClick !== null && (
                  <p className="text-xs text-gray-400 mt-1">최근 4회 평균 {fmtRate(avgClick)}</p>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">카카오톡 조회수</p>
                <p className="text-2xl font-bold text-yellow-600">{fmtNum(latest?.kakao_view)}</p>
                <p className="text-xs text-gray-400 mt-1">발송 {fmtNum(latest?.kakao_sent)}</p>
              </div>
            </div>
          </div>

          {/* Trend charts */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">회차별 추이</h3>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
                <button
                  onClick={() => setActiveChart('all')}
                  className={`px-3 py-1.5 font-medium transition-colors ${activeChart === 'all' ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  전체보기
                </button>
                <button
                  onClick={() => setActiveChart('email')}
                  className={`px-3 py-1.5 font-medium transition-colors ${activeChart === 'email' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  이메일
                </button>
                <button
                  onClick={() => setActiveChart('kakao')}
                  className={`px-3 py-1.5 font-medium transition-colors ${activeChart === 'kakao' ? 'bg-yellow-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  카카오톡
                </button>
              </div>
            </div>

            {activeChart === 'email' && (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#2563eb' }} />오픈율
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#dc2626' }} />클릭률
                  </span>
                </div>
                <LineChart
                  data={chartData}
                  series={[{ key: 'email_open_rate', color: '#2563eb' }, { key: 'email_click_rate', color: '#dc2626' }]}
                  yUnit="%"
                />
              </>
            )}

            {activeChart === 'kakao' && (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#d97706' }} />발송수
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#7c3aed' }} />조회수
                  </span>
                </div>
                <LineChart
                  data={chartData}
                  series={[{ key: 'kakao_sent', color: '#d97706' }, { key: 'kakao_view', color: '#7c3aed' }]}
                />
              </>
            )}

            {activeChart === 'all' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-xs font-medium text-blue-700">이메일</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#2563eb' }} />오픈율
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#dc2626' }} />클릭률
                    </span>
                  </div>
                  <LineChart
                    data={chartData}
                    series={[{ key: 'email_open_rate', color: '#2563eb' }, { key: 'email_click_rate', color: '#dc2626' }]}
                    yUnit="%"
                  />
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-xs font-medium text-yellow-600">카카오톡</span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#d97706' }} />발송수
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: '#7c3aed' }} />조회수
                    </span>
                  </div>
                  <LineChart
                    data={chartData}
                    series={[{ key: 'kakao_sent', color: '#d97706' }, { key: 'kakao_view', color: '#7c3aed' }]}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">회차별 상세</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
                    <th className="w-7 px-2 py-2.5"></th>
                    <th className="text-left px-4 py-2.5 whitespace-nowrap">회차</th>
                    <th className="text-left px-3 py-2.5 whitespace-nowrap">발행일</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap text-blue-500">발송수</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap text-blue-500">오픈율</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap text-blue-500">클릭률</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap text-yellow-600">카카오<br />발송수</th>
                    <th className="text-right px-3 py-2.5 whitespace-nowrap text-yellow-600">조회수</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, index) => (
                    <Fragment key={r.issue_no}>
                      <tr
                        draggable
                        onDragStart={e => handleDragStart(e, index)}
                        onDragOver={e => handleDragOver(e, index)}
                        onDrop={e => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`border-b transition-colors select-none
                          ${dragIndex === index ? 'opacity-40 bg-gray-50' : ''}
                          ${dragOverIndex === index && dragIndex !== index ? 'border-t-2 border-t-blue-400' : 'border-gray-50'}
                          ${editingRow === r.issue_no && dragIndex !== index ? 'bg-blue-50' : dragIndex !== index ? 'hover:bg-gray-50' : ''}
                        `}
                      >
                        <td className="px-2 py-3 cursor-grab active:cursor-grabbing">
                          <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" className="text-gray-300 hover:text-gray-500 mx-auto transition-colors">
                            <circle cx="3" cy="2.5" r="1.5" /><circle cx="9" cy="2.5" r="1.5" />
                            <circle cx="3" cy="8" r="1.5" /><circle cx="9" cy="8" r="1.5" />
                            <circle cx="3" cy="13.5" r="1.5" /><circle cx="9" cy="13.5" r="1.5" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">#{r.issue_no}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(r.issue_date)}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{fmtNum(r.email_sent)}</td>
                        <td className="px-3 py-3 text-right font-medium text-blue-600">{fmtRate(r.email_open_rate)}</td>
                        <td className="px-3 py-3 text-right font-medium text-indigo-500">{fmtRate(r.email_click_rate)}</td>
                        <td className="px-3 py-3 text-right text-yellow-700">{fmtNum(r.kakao_sent)}</td>
                        <td className="px-3 py-3 text-right text-orange-600">{fmtNum(r.kakao_view)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {editingRow === r.issue_no ? (
                            <span className="text-xs text-blue-400">편집 중</span>
                          ) : (
                            <span className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => startEdit(r)}
                                className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                              >
                                수정
                              </button>
                              <span className="text-gray-200">|</span>
                              <button
                                onClick={() => handleDelete(r.issue_no)}
                                disabled={deletingRow === r.issue_no}
                                className="text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                              >
                                {deletingRow === r.issue_no ? '삭제 중…' : '삭제'}
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Inline edit row */}
                      {editingRow === r.issue_no && (
                        <tr>
                          <td colSpan={9} className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                            <FormFields form={editForm} onChange={updateEditForm} />
                            <div className="flex justify-end gap-2 mt-4">
                              <button
                                onClick={() => setEditingRow(null)}
                                className="px-3 py-1.5 text-sm bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                              >
                                취소
                              </button>
                              <button
                                onClick={() => handleEditSave(r.issue_no)}
                                disabled={savingRow === r.issue_no}
                                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                              >
                                {savingRow === r.issue_no ? '저장 중…' : '저장'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
