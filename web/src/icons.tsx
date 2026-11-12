import type { ReactNode } from 'react'

type Props = { size?: number; color?: string }
function SvgIcon({ size = 24, color = 'currentColor', children }: Props & { children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0 }}>{children}</svg>
}
export function HouseIcon(props: Props) { return <SvgIcon {...props}><path d="m3 10 9-7 9 7v10H15v-7H9v7H3Z" /></SvgIcon> }
export function CalendarDaysIcon(props: Props) { return <SvgIcon {...props}><><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h1m4 0h1m4 0h1M7 17h1m4 0h1"/></></SvgIcon> }
export function CalendarPlusIcon(props: Props) { return <SvgIcon {...props}><><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-9 3v5m-2.5-2.5h5"/></></SvgIcon> }
export function ImageIcon(props: Props) { return <SvgIcon {...props}><><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></></SvgIcon> }
export function SettingsIcon(props: Props) { return <SvgIcon {...props}><><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--mui-palette-background-paper)"/><circle cx="16" cy="12" r="2" fill="var(--mui-palette-background-paper)"/><circle cx="8" cy="18" r="2" fill="var(--mui-palette-background-paper)"/></></SvgIcon> }
export function HeartIcon(props: Props) { return <SvgIcon {...props}><path d="M12 21S2 15 2 8.5C2 3 9 2 12 7c3-5 10-4 10 1.5C22 15 12 21 12 21Z"/></SvgIcon> }
export function ChevronRightIcon(props: Props) { return <SvgIcon {...props}><path d="m9 5 7 7-7 7"/></SvgIcon> }
export function ChevronLeftIcon(props: Props) { return <SvgIcon {...props}><path d="m15 5-7 7 7 7"/></SvgIcon> }
export function PlusIcon(props: Props) { return <SvgIcon {...props}><path d="M12 5v14M5 12h14"/></SvgIcon> }
export function XIcon(props: Props) { return <SvgIcon {...props}><path d="m6 6 12 12M6 18 18 6"/></SvgIcon> }
export function CheckIcon(props: Props) { return <SvgIcon {...props}><path d="m5 12 4 4L19 6"/></SvgIcon> }
export function PencilIcon(props: Props) { return <SvgIcon {...props}><path d="m14 5 5 5M4 15 16 3l5 5L9 20l-6 1Z"/></SvgIcon> }
export function CameraIcon(props: Props) { return <SvgIcon {...props}><><path d="M8 5 9 3h6l1 2h4a1 1 0 0 1 1 1v14H3V6a1 1 0 0 1 1-1Z"/><circle cx="12" cy="12" r="4"/></></SvgIcon> }
export function ClockIcon(props: Props) { return <SvgIcon {...props}><><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></></SvgIcon> }
export function ListIcon(props: Props) { return <SvgIcon {...props}><path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1"/></SvgIcon> }
export function BellIcon(props: Props) { return <SvgIcon {...props}><path d="M4 17h16l-2-3V9a6 6 0 0 0-12 0v5ZM10 21h4"/></SvgIcon> }
export function LogOutIcon(props: Props) { return <SvgIcon {...props}><path d="M9 4H3v16h6m6-12 4 4-4 4m-7-4h12"/></SvgIcon> }
export function UnlinkIcon(props: Props) { return <SvgIcon {...props}><path d="m4 4 16 16M9 15l-2 2a3 3 0 0 1-4-4l3-3m9-1 2-2a3 3 0 0 0-4-4l-3 3M3 21l3-3m12-12 3-3"/></SvgIcon> }
export function FileUpIcon(props: Props) { return <SvgIcon {...props}><path d="M14 2H4v20h16V8Zm0 0v6h6M12 18v-7m-3 3 3-3 3 3"/></SvgIcon> }
export function DropletIcon(props: Props) { return <SvgIcon {...props}><path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/></SvgIcon> }
export function SunIcon(props: Props) { return <SvgIcon {...props}><><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></></SvgIcon> }
const cloud = <path d="M6 19a5 5 0 1 1 1-10 6 6 0 0 1 11-1 5.5 5.5 0 0 1 0 11Z"/>
export function CloudIcon(props: Props) { return <SvgIcon {...props}>cloud</SvgIcon> }
export function CloudSunIcon(props: Props) { return <SvgIcon {...props}><><path d="M4 2v2M1 7h2m3-2a3 3 0 0 1 5-2"/>{cloud}</></SvgIcon> }
export function CloudLightningIcon(props: Props) { return <SvgIcon {...props}><>{cloud}<path d="m13 12-3 5h4l-3 6"/></></SvgIcon> }
export function SnowflakeIcon(props: Props) { return <SvgIcon {...props}><path d="M12 2v20M3 7l18 10M3 17 21 7M9 3l3 3 3-3M9 21l3-3 3 3M3 10l4-1-1-4m12 0-1 4 4 1M3 14l4 1-1 4m12 0-1-4 4-1"/></SvgIcon> }
export function UmbrellaIcon(props: Props) { return <SvgIcon {...props}><path d="M2 12a10 10 0 0 1 20 0H2Zm10 0v7a2 2 0 0 0 4 0"/></SvgIcon> }
