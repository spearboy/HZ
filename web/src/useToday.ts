import { useSyncExternalStore } from 'react'

export function currentDay(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined
function schedule() {
  clearTimeout(timer)
  if (!listeners.size) return
  const midnight = new Date(`${currentDay()}T00:00:00+09:00`).getTime() + 86400000
  timer = setTimeout(() => { listeners.forEach(notify => notify()); schedule() }, Math.max(1, midnight - Date.now()))
}
function visible() {
  if (document.visibilityState === 'visible') { listeners.forEach(notify => notify()); schedule() }
}
function subscribe(notify: () => void) {
  listeners.add(notify)
  if (listeners.size === 1) { document.addEventListener('visibilitychange', visible); schedule() }
  return () => {
    listeners.delete(notify)
    if (!listeners.size) { clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }
}
export const useToday = () => useSyncExternalStore(subscribe, currentDay, currentDay)
