export type Event = {
  id: string; title: string; note: string | null; start_at: string; all_day: boolean; created_by: string
  end_date: string | null; repeat_yearly: boolean; repeat_until_year: number | null; dday: boolean
}
// 화면에 그릴 한 번의 발생: 반복이면 그해 날짜로 옮긴 시작/끝(YYYY-MM-DD)
export type Occ = { ev: Event; first: string; last: string }

// shortcut: 브라우저 시간대 = KST로 가정, 둘 다 한국 밖에서 쓰면 Asia/Seoul 고정 변환으로 바꾼다
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const hm = (d: Date) => d.toTimeString().slice(0, 5)
export const dayDiff = (a: string, b: string) => Math.round((+new Date(`${b}T00:00`) - +new Date(`${a}T00:00`)) / 864e5)

// 일정 하나를 years 안의 발생들로 펼친다. 2/29 반복은 윤년에만 (DB 알림과 같은 규칙)
export function expand(ev: Event, years: number[]): Occ[] {
  const s = new Date(ev.start_at)
  const len = ev.end_date ? dayDiff(ymd(s), ev.end_date) : 0
  const ys = ev.repeat_yearly
    ? years.filter((y) => y >= s.getFullYear() && (ev.repeat_until_year == null || y <= ev.repeat_until_year))
    : [s.getFullYear()]
  return ys.flatMap((y) => {
    const first = new Date(y, s.getMonth(), s.getDate())
    if (first.getMonth() !== s.getMonth()) return []
    return [{ ev, first: ymd(first), last: ymd(new Date(y, s.getMonth(), s.getDate() + len)) }]
  })
}

// fromDay~toDay 사이 날짜별 발생 목록. 이어지는 기간 일정이 같은 줄에 오게 먼저 시작한 것부터, 같은 날 시작이면 시간순
export function groupByDay(events: Event[], fromDay: string, toDay: string) {
  // 연말·연초에 걸친 반복 기간 일정도 잡히게 앞 해까지 펼친다
  const y0 = +fromDay.slice(0, 4)
  const years = [...new Set([y0 - 1, y0, +toDay.slice(0, 4)])]
  const byDay = new Map<string, Occ[]>()
  for (const o of events.flatMap((ev) => expand(ev, years))) {
    const [y, m, d] = o.first.split('-').map(Number)
    for (let i = 0; i <= dayDiff(o.first, o.last); i++) {
      const k = ymd(new Date(y, m - 1, d + i))
      if (k >= fromDay && k <= toDay) byDay.set(k, [...(byDay.get(k) ?? []), o])
    }
  }
  const time = (o: Occ) => (o.ev.all_day ? '' : hm(new Date(o.ev.start_at)))
  for (const list of byDay.values()) list.sort((a, b) => a.first.localeCompare(b.first) || time(a).localeCompare(time(b)))
  return byDay
}

// 오늘 이후(오늘 포함) 가장 가까운 시작일. 지난 일회성 일정은 null
export function nextStart(ev: Event, today: string) {
  const y = +today.slice(0, 4)
  return expand(ev, [y, y + 1]).find((o) => o.first >= today)?.first ?? null
}

// 사귄 날 = 1일. 다음 100일 단위와 다음 n주년
export function coupleDays(startedOn: string, today: string) {
  const n = dayDiff(startedOn, today) + 1
  const [y, m, d] = startedOn.split('-').map(Number)
  const nextHundred = Math.max(1, Math.ceil(n / 100)) * 100
  let years = +today.slice(0, 4) - y
  if (ymd(new Date(y + years, m - 1, d)) < today) years++
  years = Math.max(years, 1)
  return {
    n,
    hundred: { n: nextHundred, left: nextHundred - n },
    anniversary: { years, left: dayDiff(today, ymd(new Date(y + years, m - 1, d))) },
  }
}

export const dLabel = (left: number) => (left === 0 ? 'D-DAY' : left > 0 ? `D-${left}` : `D+${-left}`)
