import { Fragment, useState, useEffect } from 'react'
import { dbFetchNewsletterPerformance, dbSyncEmailStats, dbUpdateKakaoStats } from '../lib/dbNewsletter'

// Returns Monday date string (YYYY-MM-DD) for the week containing dateStr
function weekStart(dateStr) {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

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

// Simple SVG line chart — no external dependencies
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
  // Round up to a nice number for y-axis
  const yMax = yUnit === '%'
    ? Math.ceil((rawMax * 1.25) / 10) * 10 || 100
    : Math.ceil((rawMax * 1.25) / 100) * 100 || 1000
  const gridCount = 4

  const cx = i => pad.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2)
  const cy = v => pad.top + plotH - (Math.min(Number(v ?? 0), yMax) / yMax) * plotH

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: H }}>
      {/* Horizontal grid lines + Y labels */}
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

      {/* Series polylines */}
      {series.map(s => (
        <polyline
          key={s.key}
          points={data.map((d, i) => `${cx(i)},${cy(d[s.key] ?? 0)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Data dots */}
      {series.map(s =>
        data.map((d, i) => (
          <circle
            key={`${s.key}-${i}`}
            cx={cx(i)}
            cy={cy(d[s.key] ?? 0)}
            r="4"
            fill="white"
            stroke={s.color}
            strokeWidth="2"
          />
        ))
      )}

      {/* X axis labels */}
      {data.map((d, i) => (
        <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#6b7280">
          #{d.issue_no}
        </text>
      ))}
    </svg>
  )
}

export default function NewsletterPerformancePage() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [syncInfo, setSyncInfo] = useState('')
  const [editingRow, setEditingRow] = useState(null)
  const [editForm, setEditForm] = useState({ kakaoSent: '', kakaoView: '', kakaoNote: '' })
  const [savingRow, setSavingRow] = useState(null)
  const [activeChart, setActiveChart] = useState('email')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const data = await dbFetchNewsletterPerformance()
      setRecords(data)
    } catch (e) {
      setSyncError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncError('')
    setSyncInfo('')
    try {
      const res = await fetch('/api/stibee-stats')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `API 오류 ${res.status}`)
      }
      const { emails } = await res.json()
      if (!emails?.length) {
        setSyncInfo('스티비에서 가져올 이메일이 없습니다.')
        return
      }

      // Sort existing records ascending to find max issue_no
      const existing = [...records].sort((a, b) => a.issue_no - b.issue_no)
      const maxIssueNo = existing.length ? Math.max(...existing.map(r => r.issue_no)) : 0
      let nextNo = maxIssueNo + 1

      const upsertRows = []
      for (const email of emails) {
        const emailWeek = weekStart(email.sentAt)
        // Match by same calendar week
        const match = existing.find(r => r.issue_date && weekStart(r.issue_date) === emailWeek)
        upsertRows.push({
          issue_no: match ? match.issue_no : nextNo++,
          issue_date: email.sentAt.slice(0, 10),
          email_sent: email.emailSent ?? null,
          email_open_rate: email.emailOpenRate ?? null,
          email_click_rate: email.emailClickRate ?? null,
          synced_at: new Date().toISOString(),
        })
      }

      await dbSyncEmailStats(upsertRows)
      const fresh = await dbFetchNewsletterPerformance()
      setRecords(fresh)
      setSyncInfo(`✓ ${emails.length}개 회차 동기화 완료`)
    } catch (e) {
      setSyncError(e.message ?? '동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  function startEdit(record) {
    setEditingRow(record.issue_no)
    setEditForm({
      kakaoSent: record.kakao_sent ?? '',
      kakaoView: record.kakao_view ?? '',
      kakaoNote: record.kakao_note ?? '',
    })
  }

  async function handleKakaoSave(issueNo) {
    setSavingRow(issueNo)
    try {
      const payload = {
        kakaoSent: editForm.kakaoSent !== '' ? Number(editForm.kakaoSent) : null,
        kakaoView: editForm.kakaoView !== '' ? Number(editForm.kakaoView) : null,
        kakaoNote: editForm.kakaoNote || null,
      }
      await dbUpdateKakaoStats(issueNo, payload)
      setRecords(prev => prev.map(r =>
        r.issue_no === issueNo
          ? { ...r, kakao_sent: payload.kakaoSent, kakao_view: payload.kakaoView, kakao_note: payload.kakaoNote }
          : r
      ))
      setEditingRow(null)
    } catch (e) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSavingRow(null)
    }
  }

  // Ascending order for charts
  const chartData = [...records].sort((a, b) => a.issue_no - b.issue_no)

  // Summary stats from latest record (records[0] = highest issue_no)
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">뉴스레터 성과분석</h2>
          <p className="text-sm text-gray-500 mt-0.5">이메일 + 카카오톡 채널 메시지 발행 성과</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {syncing
            ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            : <span className="text-base leading-none">↻</span>
          }
          스티비 동기화
        </button>
      </div>

      {syncError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {syncError}
        </div>
      )}
      {syncInfo && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
          {syncInfo}
        </div>
      )}

      {/* Empty state */}
      {records.length === 0 && !syncError && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-base text-gray-600 font-medium mb-1">성과 데이터가 없습니다</p>
          <p className="text-sm">스티비 동기화 버튼을 눌러 이메일 통계를 가져오세요</p>
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
                  onClick={() => setActiveChart('email')}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    activeChart === 'email'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  이메일
                </button>
                <button
                  onClick={() => setActiveChart('kakao')}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    activeChart === 'kakao'
                      ? 'bg-yellow-500 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  카카오톡
                </button>
              </div>
            </div>

            {activeChart === 'email' ? (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 bg-blue-500 rounded" />
                    오픈율
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 bg-indigo-400 rounded" />
                    클릭률
                  </span>
                </div>
                <LineChart
                  data={chartData}
                  series={[
                    { key: 'email_open_rate', color: '#3b82f6' },
                    { key: 'email_click_rate', color: '#818cf8' },
                  ]}
                  yUnit="%"
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 bg-yellow-500 rounded" />
                    발송수
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-4 h-0.5 bg-orange-400 rounded" />
                    조회수
                  </span>
                </div>
                <LineChart
                  data={chartData}
                  series={[
                    { key: 'kakao_sent', color: '#eab308' },
                    { key: 'kakao_view', color: '#f97316' },
                  ]}
                />
              </>
            )}
          </div>

          {/* Detail table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">회차별 상세</h3>
              <span className="text-xs text-gray-400">카카오톡 항목은 직접 입력</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500">
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
                  {records.map(r => (
                    <Fragment key={r.issue_no}>
                      {/* Main row */}
                      <tr className={`border-b border-gray-50 transition-colors ${
                        editingRow === r.issue_no ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}>
                        <td className="px-4 py-3 font-semibold text-gray-800">#{r.issue_no}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap text-xs">
                          {fmtDate(r.issue_date)}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-700">{fmtNum(r.email_sent)}</td>
                        <td className="px-3 py-3 text-right font-medium text-blue-600">
                          {fmtRate(r.email_open_rate)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium text-indigo-500">
                          {fmtRate(r.email_click_rate)}
                        </td>
                        <td className="px-3 py-3 text-right text-yellow-700">{fmtNum(r.kakao_sent)}</td>
                        <td className="px-3 py-3 text-right text-orange-600">{fmtNum(r.kakao_view)}</td>
                        <td className="px-3 py-3 text-right">
                          {editingRow === r.issue_no ? (
                            <span className="text-xs text-blue-400">편집 중</span>
                          ) : (
                            <button
                              onClick={() => startEdit(r)}
                              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              {r.kakao_sent != null || r.kakao_view != null ? '수정' : '입력'}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Inline kakao edit row */}
                      {editingRow === r.issue_no && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                            <div className="flex flex-wrap gap-3 items-end">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1.5">카카오 발송수</label>
                                <input
                                  type="number"
                                  value={editForm.kakaoSent}
                                  onChange={e => setEditForm(f => ({ ...f, kakaoSent: e.target.value }))}
                                  className="w-28 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1.5">조회수</label>
                                <input
                                  type="number"
                                  value={editForm.kakaoView}
                                  onChange={e => setEditForm(f => ({ ...f, kakaoView: e.target.value }))}
                                  className="w-28 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                                  placeholder="0"
                                />
                              </div>
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-xs text-gray-500 mb-1.5">비고 (선택)</label>
                                <input
                                  type="text"
                                  value={editForm.kakaoNote}
                                  onChange={e => setEditForm(f => ({ ...f, kakaoNote: e.target.value }))}
                                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm"
                                  placeholder="메모를 입력하세요"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleKakaoSave(r.issue_no)}
                                  disabled={savingRow === r.issue_no}
                                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                                >
                                  {savingRow === r.issue_no ? '저장 중…' : '저장'}
                                </button>
                                <button
                                  onClick={() => setEditingRow(null)}
                                  className="px-3 py-1.5 text-sm bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                            {r.kakao_note && (
                              <p className="text-xs text-gray-400 mt-2">현재 비고: {r.kakao_note}</p>
                            )}
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
