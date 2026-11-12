import assert from 'node:assert/strict'
import { weekRange, monthRange } from '../src/calendarDates.ts'
import { currentDay } from '../src/useToday.ts'

assert.equal(currentDay(new Date('2026-11-12T14:59:59Z')), '2026-11-12')
assert.equal(currentDay(new Date('2026-11-12T15:00:00Z')), '2026-11-13')
const sunday = weekRange('2026-11-15')
assert.equal(sunday.fromDay, '2026-11-09')
assert.equal(sunday.from, '2026-11-08T15:00:00.000Z')
assert.equal(sunday.to, '2026-11-15T15:00:00.000Z')
assert.equal(sunday.days.length, 7)
assert.equal(weekRange('2027-01-01').fromDay, '2026-12-28')
const leap = monthRange(new Date(2024, 1, 1))
assert.equal(leap.days.length, 42)
assert.equal(leap.fromDay, '2024-01-28')
assert.equal(leap.toDay, '2024-03-09')
assert.equal(leap.from, '2024-01-27T15:00:00.000Z')
assert.equal(leap.to, '2024-03-09T15:00:00.000Z')
console.log('calendar date boundaries ok')
