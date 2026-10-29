import assert from 'node:assert/strict'
import { parseIcs } from '../src/ics.ts'

const ics = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:a1',
  'SUMMARY:저녁 약속\\, 강남',
  'DESCRIPTION:첫 줄\\n둘째',
  '  줄',
  'DTSTART;TZID=Asia/Seoul:20261105T183000',
  'BEGIN:VALARM',
  'DESCRIPTION:알람 설명은 무시',
  'END:VALARM',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a2',
  'SUMMARY:기념일',
  'DTSTART;VALUE=DATE:20261224',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:a3',
  'SUMMARY:UTC 일정',
  'DTSTART:20261101T000000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:UID 없음은 제외',
  'DTSTART:20261101T000000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

const [a, b, c, ...rest] = parseIcs(ics)
assert.equal(rest.length, 0)
assert.deepEqual([a.uid, a.title, a.note, a.allDay], ['a1', '저녁 약속, 강남', '첫 줄\n둘째 줄', false])
assert.deepEqual([a.start.getMonth(), a.start.getDate(), a.start.getHours(), a.start.getMinutes()], [10, 5, 18, 30])
assert.deepEqual([b.title, b.allDay, b.start.getDate(), b.start.getHours()], ['기념일', true, 24, 0])
assert.equal(c.start.toISOString(), '2026-11-01T00:00:00.000Z')
console.log('ics ok')
