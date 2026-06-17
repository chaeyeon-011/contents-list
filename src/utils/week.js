export function getWeekId(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function getWeekLabel(weekId) {
  const [year, month, day] = weekId.split('-').map(Number)
  const monday = new Date(year, month - 1, day)

  let firstMonday = new Date(year, month - 1, 1)
  while (firstMonday.getDay() !== 1) {
    firstMonday.setDate(firstMonday.getDate() + 1)
  }

  const weekNum = Math.round((monday - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${month}월 ${weekNum}주차`
}

export function getAvailableWeeks(contents) {
  const currentWeekId = getWeekId()
  const weekSet = new Set([currentWeekId])
  contents.forEach(c => { if (c.weekId) weekSet.add(c.weekId) })
  return Array.from(weekSet).sort()
}
