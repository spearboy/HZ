import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { auth, koError, supabase } from './supabase'

type Event = { id: string; title: string; note: string | null; start_at: string; all_day: boolean; created_by: string }

// shortcut: 브라우저 시간대 = KST로 가정, 둘 다 한국 밖에서 쓰면 Asia/Seoul 고정 변환으로 바꾼다
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hm = (d: Date) => d.toTimeString().slice(0, 5)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export default function Calendar({ coupleId, userId }: { coupleId: string; userId: string }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [events, setEvents] = useState<Event[]>([])
  const [selected, setSelected] = useState(() => ymd(new Date()))
  const [editing, setEditing] = useState<Event | null>(null)
  const [msg, setMsg] = useState('')

  // 6주 고정 그리드: 그 달 1일이 속한 주의 일요일부터 42일
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay())
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  const from = days[0].toISOString()
  const to = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42).toISOString()

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('events')
      .select('id,title,note,start_at,all_day,created_by')
      .gte('start_at', from).lt('start_at', to).order('start_at')
    if (error) setMsg(koError(error))
    else setEvents(data)
  }, [from, to])

  useEffect(() => { load() }, [load])

  // 상대가 바꾼 일정이 바로 보이도록 변경이 오면 다시 불러온다
  useEffect(() => {
    const ch = supabase.channel('events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `couple_id=eq.${coupleId}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [coupleId, load])

  const byDay = new Map<string, Event[]>()
  for (const ev of events) {
    const k = ymd(new Date(ev.start_at))
    byDay.set(k, [...(byDay.get(k) ?? []), ev])
  }

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const allDay = f.get('all_day') === 'on'
    const row = {
      title: String(f.get('title')).trim(),
      note: String(f.get('note')).trim() || null,
      all_day: allDay,
      start_at: new Date(`${selected}T${allDay ? '00:00' : f.get('time')}`).toISOString(),
    }
    const { error } = editing
      ? await supabase.from('events').update(row).eq('id', editing.id)
      : await supabase.from('events').insert({ ...row, couple_id: coupleId, created_by: userId })
    if (error) return setMsg(koError(error))
    setMsg('')
    setEditing(null)
    form.reset()
    load()
  }

  const remove = async (ev: Event) => {
    if (!confirm(`'${ev.title}' 일정을 삭제할까요?`)) return
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) setMsg(koError(error))
    else { setEditing(null); load() }
  }

  const today = ymd(new Date())
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <main>
      <header>
        <button className="secondary" onClick={() => shift(-1)} aria-label="이전 달">‹</button>
        <h1>{month.getFullYear()}년 {month.getMonth() + 1}월</h1>
        <button className="secondary" onClick={() => shift(1)} aria-label="다음 달">›</button>
        <button className="secondary" onClick={auth.signOut}>로그아웃</button>
      </header>

      <div className="grid">
        {WEEK.map((w) => <div key={w} className="dow">{w}</div>)}
        {days.map((d) => {
          const k = ymd(d)
          const list = byDay.get(k) ?? []
          return (
            <button key={k} onClick={() => { setSelected(k); setEditing(null) }}
              className={['day', d.getMonth() !== month.getMonth() && 'other', k === today && 'today', k === selected && 'selected'].filter(Boolean).join(' ')}>
              <span>{d.getDate()}</span>
              {list.slice(0, 3).map((ev) => <small key={ev.id} className={ev.created_by === userId ? 'mine' : 'theirs'}>{ev.title}</small>)}
              {list.length > 3 && <small>+{list.length - 3}</small>}
            </button>
          )
        })}
      </div>

      <section className="panel">
        <h2>{selected}</h2>
        <ul>
          {(byDay.get(selected) ?? []).map((ev) => (
            <li key={ev.id}>
              <button className="link" onClick={() => setEditing(ev)}>
                <b>{ev.all_day ? '하루 종일' : hm(new Date(ev.start_at))}</b> {ev.title} {ev.note && <span className="muted">— {ev.note}</span>}
              </button>
            </li>
          ))}
        </ul>

        {/* key로 폼을 다시 만들어 수정 대상의 값을 채운다 */}
        <form key={editing?.id ?? 'new' + selected} onSubmit={save}>
          <input name="title" placeholder="일정 제목" required maxLength={200} defaultValue={editing?.title} />
          <label><input type="checkbox" name="all_day" defaultChecked={editing?.all_day} /> 하루 종일</label>
          <input type="time" name="time" defaultValue={editing ? hm(new Date(editing.start_at)) : '12:00'} />
          <input name="note" placeholder="메모 (선택)" defaultValue={editing?.note ?? ''} />
          <button type="submit">{editing ? '수정' : '추가'}</button>
          {editing && <>
            <button type="button" className="danger" onClick={() => remove(editing)}>삭제</button>
            <button type="button" className="secondary" onClick={() => setEditing(null)}>취소</button>
          </>}
        </form>
        {msg && <p role="alert">{msg}</p>}
      </section>
    </main>
  )
}
