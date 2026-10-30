import assert from 'node:assert/strict'
import { coupleDays, dLabel, expand, groupByDay, nextStart, type Event } from '../src/repeat.ts'

const base: Event = { id: '1', title: 't', note: null, start_at: new Date(2024, 11, 30, 12).toISOString(), all_day: false,
  created_by: 'a', end_date: null, repeat_yearly: false, repeat_until_year: null, dday: false }
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
