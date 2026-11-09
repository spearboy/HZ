import { tr } from './language'
import { koError, supabase } from './supabase'

export async function poke(notify: (message: string) => void) {
  const { error } = await supabase.functions.invoke('hyper-endpoint', { body: { type: 'poke' } })
  if (!error) return notify(tr("콕 찔렀어요 👉"))
  const body = await (error as { context?: Response }).context?.json().catch(() => null)
  notify(body?.code === '23505' ? tr('오늘은 이미 찔렀어요. 내일 다시!') : koError(body ?? error))
}
