import assert from 'node:assert/strict'
import { coupleDays, dLabel, expand, groupByDay, layout, nextStart, slotOf, type Event } from '../src/repeat.ts'

const base: Event = { id: '1', title: 't', note: null, start_at: new Date(2024, 11, 30, 12).toISOString(), all_day: false,
  created_by: 'a', end_date: null, repeat_yearly: false, repeat_until_year: null, dday: false, end_at: null }
const range = (o: { first: string; last: string }[]) => o.map((x) => `${x.first}~${x.last}`)

assert.deepEqual(range(expand(base, [2024, 2025])), ['2024-12-30~2024-12-30'])
// 기간 일정은 해를 넘겨도 끝 날짜가 맞다
assert.deepEqual(range(expand({ ...base, end_date: '2025-01-02' }, [2024])), ['2024-12-30~2025-01-02'])
// 매년 반복: 시작 해 이전은 없음, 종료 연도까지만
assert.deepEqual(range(expand({ ...base, repeat_yearly: true, repeat_until_year: 2026 }, [2023, 2024, 2025, 2026, 2027])),
  ['2024-12-30~2024-12-30', '2025-12-30~2025-12-30', '2026-12-30~2026-12-30'])
// 2/29 반복은 윤년에만
const leap = { ...base, start_at: new Date(2024, 1, 29, 12).toISOString(), repeat_yearly: true }
assert.deepEqual(range(expand(leap, [2025, 2028])), ['2028-02-29~2028-02-29'])

// 날짜별 묶기: 기간 일정은 범위 안 날짜에만
const byDay = groupByDay([{ ...base, end_date: '2025-01-02' }], '2025-01-01', '2025-01-31')
assert.deepEqual([...byDay.keys()], ['2025-01-01', '2025-01-02'])
const longRange = groupByDay([{ ...base, end_date: '2035-01-01' }], '2025-01-01', '2025-01-03')
assert.deepEqual([...longRange.keys()], ['2025-01-01', '2025-01-02', '2025-01-03'])
assert.equal(longRange.get('2025-01-01')?.[0].first, '2024-12-30')
assert.equal(longRange.get('2025-01-03')?.[0].last, '2035-01-01')

// 다음 시작일: 매년 반복은 올해 지났으면 내년, 지난 일회성은 null
assert.equal(nextStart({ ...base, repeat_yearly: true }, '2025-12-31'), '2026-12-30')
assert.equal(nextStart({ ...base, repeat_yearly: true }, '2025-12-30'), '2025-12-30')
assert.equal(nextStart(base, '2025-01-01'), null)

// 사귄 날 = 1일
assert.deepEqual(coupleDays('2025-01-01', '2025-01-01'), { n: 1, hundred: { n: 100, left: 99 }, anniversary: { years: 1, left: 365 } })
assert.deepEqual(coupleDays('2025-01-01', '2025-04-10'), { n: 100, hundred: { n: 100, left: 0 }, anniversary: { years: 1, left: 266 } })
assert.deepEqual(coupleDays('2024-01-01', '2025-01-01').anniversary, { years: 1, left: 0 })
assert.equal(dLabel(0), 'D-DAY')
assert.equal(dLabel(12), 'D-12')
console.log('repeat ok')

// 시간표 배치: 안 겹치면 한 칸씩 전부 차지, 겹치면 그 묶음 안에서만 나눈다
{
  const ev = (id: string): Event => ({ ...base, id })
  const L = layout([
    { ev: ev('a'), from: 540, to: 600 },   // 09:00~10:00
    { ev: ev('b'), from: 570, to: 660 },   // 09:30~11:00  (a와 겹침)
    { ev: ev('c'), from: 840, to: 900 },   // 14:00~15:00  (아무와도 안 겹침)
  ])
  const by = Object.fromEntries(L.map((s) => [s.ev.id, `${s.lane}/${s.lanes}`]))
  assert.deepEqual(by, { a: '0/2', b: '1/2', c: '0/1' })
}
{
  // 앞 일정이 끝난 뒤 시작하면 같은 칸을 다시 쓴다
  const ev = (id: string): Event => ({ ...base, id })
  const L = layout([
    { ev: ev('a'), from: 540, to: 600 },
    { ev: ev('b'), from: 600, to: 660 },
  ])
  assert.deepEqual(L.map((s) => `${s.lane}/${s.lanes}`), ['0/1', '0/1'])
}
// 끝 시각이 없으면 1시간짜리로 본다
assert.deepEqual(slotOf({ ...base, start_at: new Date(2025, 0, 2, 9, 30).toISOString(), end_at: null }), { from: 570, to: 630 })
assert.deepEqual(slotOf({ ...base, start_at: new Date(2025, 0, 2, 9, 30).toISOString(), end_at: new Date(2025, 0, 2, 11, 0).toISOString() }), { from: 570, to: 660 })
console.log('layout ok')
