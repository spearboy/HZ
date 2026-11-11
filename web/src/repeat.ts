export type Event = {
  id: string; title: string; note: string | null; start_at: string; all_day: boolean; created_by: string
  end_date: string | null; repeat_yearly: boolean; repeat_until_year: number | null; dday: boolean
  end_at: string | null
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
    const first = o.first < fromDay ? fromDay : o.first
    const last = o.last > toDay ? toDay : o.last
    if (first > last) continue
    const [y, m, d] = first.split('-').map(Number)
    for (let i = 0, length = dayDiff(first, last); i <= length; i++) {
      const k = ymd(new Date(y, m - 1, d + i))
      const list = byDay.get(k)
      if (list) list.push(o)
      else byDay.set(k, [o])
    }
  }
  const time = (o: Occ) => (o.ev.all_day ? '' : hm(new Date(o.ev.start_at)))
  for (const list of byDay.values()) list.sort((a, b) => a.first.localeCompare(b.first) || time(a).localeCompare(time(b)))
  return byDay
}

// 오늘 이후(오늘 포함) 가장 가까운 시작일. 지난 일회성 일정은 null
export function nextStart(ev: Event, today: string) {
  if (!ev.repeat_yearly) return expand(ev, []).find((o) => o.first >= today)?.first ?? null
  const startYear = Math.max(+today.slice(0, 4), new Date(ev.start_at).getFullYear())
  // 윤일은 다음 발생까지 최대 8년(2100년 같은 평년 세기)이 걸릴 수 있다.
  const lastYear = Math.min(ev.repeat_until_year ?? startYear + 8, startYear + 8)
  for (let year = startYear; year <= lastYear; year++) {
    const occurrence = expand(ev, [year])[0]
    if (occurrence && occurrence.first >= today) return occurrence.first
  }
  return null
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

// 시간표 한 칸: 자정부터 분 단위 시작/끝, 겹치는 것끼리 가로로 나눈 위치(lane/lanes)
export type Slot = { ev: Event; from: number; to: number; lane: number; lanes: number }

// 겹치는 일정들을 묶어(cluster) 그 안에서만 폭을 나눈다. 안 겹치는 일정은 폭을 그대로 쓴다
export function layout(items: { ev: Event; from: number; to: number }[]): Slot[] {
  const sorted = [...items].sort((a, b) => a.from - b.from || a.to - b.to)
  const out: Slot[] = []
  let cluster: Slot[] = []
  let laneEnd: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const s of cluster) s.lanes = laneEnd.length
    out.push(...cluster)
    cluster = []
    laneEnd = []
  }

  for (const it of sorted) {
    if (cluster.length && it.from >= clusterEnd) flush()
    let lane = laneEnd.findIndex((end) => end <= it.from)
    if (lane < 0) { lane = laneEnd.length; laneEnd.push(0) }
    laneEnd[lane] = it.to
    clusterEnd = cluster.length ? Math.max(clusterEnd, it.to) : it.to
    cluster.push({ ev: it.ev, from: it.from, to: it.to, lane, lanes: 1 })
  }
  flush()
  return out
}

// 일정 하나가 그날 차지하는 시간대. 끝 시각이 없으면 1시간으로 본다
export function slotOf(ev: Event, occurrence?: { date: string; first: string; last: string }): { from: number; to: number } {
  const s = new Date(ev.start_at)
  const from = s.getHours() * 60 + s.getMinutes()
  if (occurrence && occurrence.first !== occurrence.last) {
    const start = occurrence.date === occurrence.first ? from : 0
    const end = occurrence.date === occurrence.last && ev.end_at
      ? new Date(ev.end_at).getHours() * 60 + new Date(ev.end_at).getMinutes()
      : 24 * 60
    return { from: start, to: end }
  }
  if (!ev.end_at) return { from, to: Math.min(from + 60, 24 * 60) }
  const e = new Date(ev.end_at)
  const sameDay = ymd(e) === ymd(s)
  return { from, to: sameDay ? e.getHours() * 60 + e.getMinutes() : 24 * 60 }
}
