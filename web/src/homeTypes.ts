import { DEFAULT_FIT, type Fit } from './imageFitStyles'

export type Profile = {
  id: string; display_name: string | null; color: string | null
  avatar_path: string | null; avatar_zoom: number; avatar_x: number; avatar_y: number
  avatarUrl?: string | null
}
export const avatarFit = (p: Profile): Fit =>
  p.avatar_path ? { zoom: p.avatar_zoom, x: p.avatar_x, y: p.avatar_y } : DEFAULT_FIT
export type TabProps = {
  coupleId: string; userId: string; active: boolean; eventVersion: number; photoVersion: number; coupleVersion: number; notify: (m: string) => void
  profiles: Profile[]; colorOf: (userId: string) => string; reloadProfiles: () => Promise<void>; onLeft: () => void
  openCalendar: (date: string) => void
}

// 색을 아직 안 골랐으면 나 = 분홍, 상대 = 파랑
export const DEFAULT_COLORS = { me: '#ff6b8b', partner: '#5b8def' }
