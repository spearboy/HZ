import { Box, Card, Skeleton, Stack, Typography } from '@mui/material'
import {
  CloudIcon, CloudLightningIcon, CloudSunIcon, DropletIcon, SnowflakeIcon, SunIcon, UmbrellaIcon,
} from '@animateicons/react/lucide'
import { keyframes } from '@emotion/react'
import { weatherFx, weatherText, type Weather } from './weather'
import { isEnglish, tr } from './language'

const icon = (code: number) => {
  if (code === 0) return SunIcon
  if (code <= 2) return CloudSunIcon
  if (code <= 48) return CloudIcon
  if (code >= 95) return CloudLightningIcon
  return weatherFx(code) === 'snow' ? SnowflakeIcon : UmbrellaIcon
}

// 메인 카드 위에 까는 비/눈. 요소를 수백 개 만드는 대신 배경 패턴 두세 겹을 흘린다
const rain = keyframes`to { background-position: -36px 300px, -26px 380px }`
const snow = keyframes`to { background-position: 50px 260px, -40px 320px, 25px 400px }`

export function WeatherFx({ code }: { code: number }) {
  const fx = weatherFx(code)
  if (fx === 'none') return null
  const style = fx === 'rain'
    ? {
        backgroundImage: 'repeating-linear-gradient(97deg, transparent 0 17px, #ffffff9e 17px 18px), repeating-linear-gradient(94deg, transparent 0 29px, #ffffff5c 29px 30px)',
        backgroundSize: '100px 150px, 150px 190px',
        animation: `${rain} .6s linear infinite`,
      }
    : {
        backgroundImage: 'radial-gradient(#ffffffe6 2.7px, transparent 3.2px), radial-gradient(#ffffffb3 2px, transparent 2.5px), radial-gradient(#ffffff8c 1.5px, transparent 2px)',
        backgroundSize: '92px 92px, 68px 68px, 46px 46px',
        animation: `${snow} 9s linear infinite`,
      }
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.55, ...style,
      '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }} />
  )
}

export default function WeatherCard({ w }: { w: Weather | null | undefined }) {
  if (w === undefined) return <Skeleton variant="rounded" height={68} sx={{ mb: 3, borderRadius: '18px' }} />
  if (w === null) return null // 날씨를 못 받아오면 자리만 비운다

  const Icon = icon(w.code)
  return (
    <Card sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1.5} sx={{ p: 1.75, alignItems: 'center' }}>
        <Box sx={{ width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
          bgcolor: 'color-mix(in srgb, var(--mui-palette-primary-main) 14%, transparent)', color: 'primary.main' }}>
          <Icon size={23} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
            <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{w.temp}°</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{isEnglish() ? 'Seoul' : '서울'} · {tr(weatherText(w.code))}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">{isEnglish() ? 'High' : '최고'} {w.max}° · {isEnglish() ? 'Low' : '최저'} {w.min}°</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Stack sx={{ alignItems: 'center', color: w.pop >= 60 ? 'primary.main' : 'text.secondary', flexShrink: 0, minWidth: 54 }}>
          <DropletIcon size={18} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>{isEnglish() ? 'Rain' : '강수'} {w.pop}%</Typography>
        </Stack>
      </Stack>
    </Card>
  )
}
