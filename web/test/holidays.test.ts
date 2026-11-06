import assert from 'node:assert/strict'
import { holidays } from '../src/holidays.ts'

// 음력 명절이 실제 날짜와 맞는지
assert.equal(holidays(2026).get('2026-02-17'), '설날')
assert.equal(holidays(2026).get('2026-09-25'), '추석')
assert.equal(holidays(2026).get('2026-05-24'), '부처님오신날')
assert.equal(holidays(2025).get('2025-01-29'), '설날')
assert.equal(holidays(2024).get('2024-02-10'), '설날')
assert.equal(holidays(2024).get('2024-09-17'), '추석')

// 연휴는 명절 앞뒤 하루씩
assert.equal(holidays(2026).get('2026-02-16'), '설날')
assert.equal(holidays(2026).get('2026-02-18'), '설날')

// 실제로 있었던 대체공휴일
assert.equal(holidays(2021).get('2021-08-16'), '대체공휴일') // 광복절 8/15 일요일
assert.equal(holidays(2021).get('2021-10-04'), '대체공휴일') // 개천절 10/3 일요일
assert.equal(holidays(2021).get('2021-10-11'), '대체공휴일') // 한글날 10/9 토요일
assert.equal(holidays(2024).get('2024-02-12'), '대체공휴일') // 설 연휴 2/11 일요일
assert.equal(holidays(2024).get('2024-05-06'), '대체공휴일') // 어린이날 5/5 일요일
assert.equal(holidays(2025).get('2025-03-03'), '대체공휴일') // 삼일절 3/1 토요일
assert.equal(holidays(2025).get('2025-10-08'), '대체공휴일') // 추석 연휴 10/5 일요일

// 설·추석 연휴가 토요일과 겹치는 건 대체 대상이 아니다 (2024 설 연휴 2/10 토)
assert.equal([...holidays(2024)].filter(([, n]) => n === '대체공휴일').length, 2) // 2/12, 5/6

// 대체 없는 공휴일
assert.equal(holidays(2027).get('2027-01-01'), '신정')
assert.equal(holidays(2026).get('2026-06-06'), '현충일')
assert.equal(holidays(2026).get('2026-06-08'), undefined) // 현충일이 토요일이어도 대체 없음

console.log('holidays ok')
