import { useState } from 'react'
import { EMPLOYMENT_TYPES, PRIORITY_LABELS } from '../constants'

export default function ContentCard({ item, onUpdateJudgment, onUpdateUploaded, onDelete, compact = false }) {
  const [expanded, setExpanded] = useState(false)
  const isJob = item.category === 'job'
  const empType = isJob && item.employmentType ? EMPLOYMENT_TYPES[item.employmentType] : null
  const priority = isJob && item.priority ? PRIORITY_LABELS[item.priority] : null

  // 간략형 (아코디언 닫힘)
  if (compact && !expanded) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 group">
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${item.userJudgment === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {item.userJudgment}
        </span>
        {empType && (
          <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${empType.color}`}>
            {item.employmentType}
          </span>
        )}
        <span
          onClick={() => setExpanded(true)}
          className="text-sm text-gray-800 flex-1 truncate cursor-pointer hover:text-blue-600"
          title={item.title}
        >
          {item.title}
        </span>
        {item.uploaded && (
          <span className="text-xs text-blue-500 flex-shrink-0">완료</span>
        )}
        <label className={`flex items-center gap-1 flex-shrink-0 ${item.userJudgment !== 'OK' ? 'opacity-30 pointer-events-none' : ''}`}>
          <input
            type="checkbox"
            checked={item.uploaded}
            onChange={e => onUpdateUploaded(item.id, e.target.checked)}
            disabled={item.userJudgment !== 'OK'}
            className="w-3.5 h-3.5 rounded"
          />
          <span className="text-xs text-gray-400">업로드</span>
        </label>
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-gray-300 hover:text-gray-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          펼치기
        </button>
      </div>
    )
  }

  // 상세형
  return (
    <div className={`bg-white rounded-lg border shadow-sm p-4 ${item.userJudgment === 'NG' ? 'opacity-60 border-gray-200' : 'border-gray-200'}`}>
      {compact && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1"
        >
          ▲ 간략히 보기
        </button>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.userJudgment === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {item.userJudgment}
            </span>
            {empType && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${empType.color}`}>
                {item.employmentType}
              </span>
            )}
            {priority && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${priority.color}`}>
                {priority.label}
              </span>
            )}
            {item.uploaded && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                업로드완료
              </span>
            )}
          </div>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 block mb-1"
          >
            {item.title}
          </a>

          <p className="text-xs text-gray-400 truncate mb-2">{item.url}</p>

          {item.summary && (
            <p className="text-sm text-gray-600 mb-2">{item.summary}</p>
          )}

          {item.reason && (
            <p className="text-xs text-gray-400 italic">AI 판단: {item.reason}</p>
          )}

          {item.collectedAt && (
            <p className="text-xs text-gray-300 mt-1">
              {new Date(item.collectedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 flex-shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => onUpdateJudgment(item.id, 'OK')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${item.userJudgment === 'OK' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-500 border-gray-300 hover:border-green-400'}`}
            >
              OK
            </button>
            <button
              onClick={() => onUpdateJudgment(item.id, 'NG')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${item.userJudgment === 'NG' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-500 border-gray-300 hover:border-red-400'}`}
            >
              NG
            </button>
          </div>

          <label className={`flex items-center gap-1 text-xs cursor-pointer ${item.userJudgment !== 'OK' ? 'opacity-40 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              checked={item.uploaded}
              onChange={e => onUpdateUploaded(item.id, e.target.checked)}
              disabled={item.userJudgment !== 'OK'}
              className="w-3.5 h-3.5 rounded"
            />
            <span className="text-gray-600">업로드</span>
          </label>

          <button
            onClick={() => onDelete(item.id)}
            className="text-xs text-gray-300 hover:text-red-400 text-right"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
