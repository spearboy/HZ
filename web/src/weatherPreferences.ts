import { useSyncExternalStore } from 'react'

const FX_KEY = 'weatherFx'
const listeners = new Set<() => void>()
export const fxOn = () => { try { return localStorage.getItem(FX_KEY) !== 'off' } catch { return true } }
let sessionValue: boolean | undefined
const snapshot = () => sessionValue ?? fxOn()
export function setFxOn(on: boolean) {
  sessionValue = on
  try { localStorage.setItem(FX_KEY, on ? 'on' : 'off') } catch { /* Keep this session's preference. */ }
  listeners.forEach(notify => notify())
}
function storage(event: StorageEvent) {
  if (event.key === FX_KEY || event.key === null) { sessionValue = undefined; listeners.forEach(notify => notify()) }
}
function subscribe(notify: () => void) {
  listeners.add(notify)
  if (listeners.size === 1) window.addEventListener('storage', storage)
  return () => { listeners.delete(notify); if (!listeners.size) window.removeEventListener('storage', storage) }
}
export const useWeatherFx = () => useSyncExternalStore(subscribe, snapshot, () => true)
