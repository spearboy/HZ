import { ymd } from './repeat.ts'

export function weekRange(today: string) {
  const [year, month, day] = today.split('-').map(Number)
  const now = new Date(year, month - 1, day)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)))
  return { days, fromDay: days[0], from: new Date(`${days[0]}T00:00:00+09:00`).toISOString(), to: new Date(`${ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7))}T00:00:00+09:00`).toISOString() }
}
export function monthRange(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  return { days, from: new Date(`${ymd(days[0])}T00:00:00+09:00`).toISOString(), to: new Date(`${ymd(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42))}T00:00:00+09:00`).toISOString(), fromDay: ymd(days[0]), toDay: ymd(days[41]) }
}
