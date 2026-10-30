export type Event = {
  id: string; title: string; note: string | null; start_at: string; all_day: boolean; created_by: string
  end_date: string | null; repeat_yearly: boolean; repeat_until_year: number | null
}
// 화면에 그릴 한 번의 발생: 반복이면 그해 날짜로 옮긴 시작/끝(YYYY-MM-DD)
export type Occ = { ev: Event; first: string; last: string }

// shortcut: 브라우저 시간대 = KST로 가정, 둘 다 한국 밖에서 쓰면 Asia/Seoul 고정 변환으로 바꾼다
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
