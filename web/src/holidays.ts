// 한국 공휴일. 음력 명절은 브라우저에 내장된 음력(Intl 'chinese' 달력)으로 계산해서 해마다 표를 고치지 않는다
const lunarFmt = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric', timeZone: 'UTC' })
const lunarOf = (d: Date) => {
  const p = lunarFmt.formatToParts(d)
  return `${p.find((x) => x.type === 'month')?.value}/${p.find((x) => x.type === 'day')?.value}`
}

const iso = (d: Date) => d.toISOString().slice(0, 10)
const shift = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
const dowOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()

// 그 해에서 음력 target('1/1' 등)에 해당하는 첫 양력 날짜. 윤달이 있어도 평달이 먼저 걸린다
function fromLunar(year: number, target: string, month: number, day: number, span: number) {
  for (let i = 0; i < span; i++) {
    const d = new Date(Date.UTC(year, month, day + i))
    if (lunarOf(d) === target) return iso(d)
  }
  return null
}

// 대체공휴일 규칙 (공휴일에 관한 법률 시행령):
//  - 신정·현충일: 대체 없음
//  - 설날·추석 연휴: 일요일과 겹칠 때만  (예: 2024 설 연휴 2/9금·2/10토·2/11일 → 2/12 하루만 대체)
//  - 나머지: 토·일 모두              (예: 2021 한글날 10/9토 → 10/11 대체, 2024 어린이날 5/5일 → 5/6 대체)
// [검증 필요] 법령이 바뀌면 아래 weekend 플래그만 고치면 된다
export function holidays(year: number): Map<string, string> {
  const out = new Map<string, string>()
  const add = (day: string | null, name: string) => { if (day && !out.has(day)) out.set(day, name) }

  const seol = fromLunar(year, '1/1', 0, 15, 42)   // 설날: 양력 1/15 ~ 2/25 사이
  const buddha = fromLunar(year, '4/8', 3, 20, 47) // 부처님오신날: 4/20 ~ 6/5
  const chuseok = fromLunar(year, '8/15', 7, 20, 62) // 추석: 8/20 ~ 10/20

  add(`${year}-01-01`, '신정')
  add(`${year}-06-06`, '현충일')

  // weekend: true면 토요일과 겹쳐도 대체, false면 일요일만
  const subject: { day: string | null; name: string; weekend: boolean }[] = [
    ...[-1, 0, 1].map((n) => ({ day: seol && shift(seol, n), name: '설날', weekend: false })),
    ...[-1, 0, 1].map((n) => ({ day: chuseok && shift(chuseok, n), name: '추석', weekend: false })),
    { day: `${year}-03-01`, name: '삼일절', weekend: true },
    { day: buddha, name: '부처님오신날', weekend: true },
    { day: `${year}-05-05`, name: '어린이날', weekend: true },
    { day: `${year}-08-15`, name: '광복절', weekend: true },
    { day: `${year}-10-03`, name: '개천절', weekend: true },
    { day: `${year}-10-09`, name: '한글날', weekend: true },
    { day: `${year}-12-25`, name: '성탄절', weekend: true },
  ]

  for (const s of subject) add(s.day, s.name)

  // 본 공휴일을 전부 넣은 뒤에 대체를 계산한다 (공휴일끼리 겹친 경우도 함께 잡힌다)
  for (const s of subject) {
    if (!s.day) continue
    const w = dowOf(s.day)
    const taken = out.get(s.day) !== s.name // 다른 공휴일이 이미 그날을 차지함
    if (!(w === 0 || (s.weekend && w === 6) || taken)) continue
    let d = shift(s.day, 1)
    while (out.has(d) || dowOf(d) === 0 || dowOf(d) === 6) d = shift(d, 1)
    add(d, `대체공휴일`)
  }
  return out
}

// 화면이 쓰는 달력 범위는 두 해에 걸칠 수 있다. 해마다 한 번만 계산하고 캐시한다
const cache = new Map<number, Map<string, string>>()
export function holidayName(day: string): string | undefined {
  const y = +day.slice(0, 4)
  if (!cache.has(y)) cache.set(y, holidays(y))
  return cache.get(y)!.get(day)
}
