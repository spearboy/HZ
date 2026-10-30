import assert from 'node:assert/strict'
import { expand, type Event } from '../src/repeat.ts'

const base: Event = { id: '1', title: 't', note: null, start_at: new Date(2024, 11, 30, 12).toISOString(), all_day: false,
  created_by: 'a', end_date: null, repeat_yearly: false, repeat_until_year: null }
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
console.log('repeat ok')
