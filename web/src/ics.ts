export type IcsEvent = { uid: string; title: string; note: string | null; start: Date; allDay: boolean }

const unescape = (s: string) => s.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c))

// shortcut: TZID는 무시하고 브라우저 시간대로 읽는다(KST 가정), 반복 일정(RRULE)은 첫 회차만 가져온다. 해외 일정/반복 일정이 필요해지면 ical.js 도입 검토
function parseDate(v: string): { date: Date; allDay: boolean } | null {
  const d = v.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (d) return { date: new Date(+d[1], +d[2] - 1, +d[3]), allDay: true }
  const t = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!t) return null
  const p = [+t[1], +t[2] - 1, +t[3], +t[4], +t[5], +t[6]] as const
  return { date: t[7] ? new Date(Date.UTC(...p)) : new Date(...p), allDay: false }
}

export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)
  const out: IcsEvent[] = []
  let cur: Record<string, string> | null = null
  let nested = 0 // VEVENT 안의 VALARM 등은 건너뛴다
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; nested = 0; continue }
    if (!cur) continue
    if (line.startsWith('BEGIN:')) { nested++; continue }
    if (line === 'END:VEVENT') {
      const start = cur.DTSTART ? parseDate(cur.DTSTART) : null
      if (start && cur.UID) {
        out.push({ uid: cur.UID, title: unescape(cur.SUMMARY ?? '(제목 없음)').slice(0, 200), note: cur.DESCRIPTION ? unescape(cur.DESCRIPTION) : null, start: start.date, allDay: start.allDay })
      }
      cur = null
      continue
    }
    if (line.startsWith('END:')) { nested--; continue }
    if (nested) continue
    const i = line.indexOf(':')
    if (i > 0) cur[line.slice(0, i).split(';')[0].toUpperCase()] ??= line.slice(i + 1)
  }
  return out
}
