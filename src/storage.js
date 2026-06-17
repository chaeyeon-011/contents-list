import { STORAGE_KEYS } from './constants'
import { getWeekId } from './utils/week'

export function getApiKey() {
  return localStorage.getItem(STORAGE_KEYS.API_KEY) || ''
}

export function saveApiKey(key) {
  localStorage.setItem(STORAGE_KEYS.API_KEY, key)
}

export function getSerperKey() {
  return localStorage.getItem(STORAGE_KEYS.SERPER_KEY) || ''
}

export function saveSerperKey(key) {
  localStorage.setItem(STORAGE_KEYS.SERPER_KEY, key)
}

export function getContents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTENTS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveContents(contents) {
  localStorage.setItem(STORAGE_KEYS.CONTENTS, JSON.stringify(contents))
}

export function getCollectedUrls() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COLLECTED_URLS)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCollectedUrls(urls) {
  localStorage.setItem(STORAGE_KEYS.COLLECTED_URLS, JSON.stringify(urls))
}

export function addCollectedUrl(url) {
  const urls = getCollectedUrls()
  if (!urls.includes(url)) {
    urls.push(url)
    saveCollectedUrls(urls)
  }
}

export function addContent(item) {
  const contents = getContents()
  contents.unshift(item)
  saveContents(contents)
  addCollectedUrl(item.url)
  return contents
}

export function updateContent(id, updates) {
  const contents = getContents()
  const idx = contents.findIndex(c => c.id === id)
  if (idx !== -1) {
    contents[idx] = { ...contents[idx], ...updates }
    saveContents(contents)
  }
  return contents
}

export function deleteContent(id) {
  const contents = getContents().filter(c => c.id !== id)
  saveContents(contents)
  return contents
}

export function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.CONTENTS)
  localStorage.removeItem(STORAGE_KEYS.COLLECTED_URLS)
}

export function migrateContents() {
  const currentWeekId = getWeekId()
  const contents = getContents()
  let needsSave = false
  for (const item of contents) {
    if (!item.weekId) {
      item.weekId = currentWeekId
      needsSave = true
    }
  }
  if (needsSave) saveContents(contents)
  return contents
}

export function getViewMode() {
  return localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || 'detail'
}

export function saveViewMode(mode) {
  localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode)
}

export function getTabViewModes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TAB_VIEW_MODES)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveTabViewModes(modes) {
  localStorage.setItem(STORAGE_KEYS.TAB_VIEW_MODES, JSON.stringify(modes))
}
