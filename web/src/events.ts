import { supabase } from './supabase'
import type { Event } from './repeat'

const COLUMNS = 'id,title,note,start_at,all_day,created_by,end_date,repeat_yearly,repeat_until_year,dday'

// 기간에 걸치는 일정: 안에서 시작, 앞에서 시작해 이어지는 기간 일정, 매년 반복(전부 가져와 화면에서 펼친다)
export const eventsInRange = (fromIso: string, toIso: string, fromDay: string) =>
  supabase.from('events').select(COLUMNS).lt('start_at', toIso)
    .or(`start_at.gte."${fromIso}",end_date.gte.${fromDay},repeat_yearly.is.true`).order('start_at')
    .overrideTypes<Event[], { merge: false }>()

export const ddayEvents = () =>
  supabase.from('events').select(COLUMNS).eq('dday', true).overrideTypes<Event[], { merge: false }>()
