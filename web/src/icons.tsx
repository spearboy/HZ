// @animateicons/react 아이콘을 MUI 아이콘 자리에 그대로 끼울 수 있게 감싼다.
// 원본은 <div>를 그리므로 MUI의 ListItemIcon/BottomNavigation 안에서 크기와 정렬이 틀어진다. 여기서 한 번만 맞춘다
import { forwardRef, useImperativeHandle, useRef, type ComponentType } from 'react'
import { Box } from '@mui/material'

type AnyIcon = ComponentType<{ size?: number; color?: string; isAnimated?: boolean; duration?: number }>
export type Playable = { play: () => void }

export function makeIcon(Inner: AnyIcon) {
  return forwardRef<Playable, { size?: number; color?: string; duration?: number; sx?: object }>(
    function Icon({ size = 24, color = 'currentColor', duration, sx }, ref) {
      const inner = useRef<{ startAnimation: () => void } | null>(null)
      useImperativeHandle(ref, () => ({ play: () => inner.current?.startAnimation() }), [])
      return (
        <Box sx={{ display: 'inline-flex', width: size, height: size, color, '& svg': { display: 'block' }, ...sx }}>
          {/* @ts-expect-error forwardRef 핸들 타입은 아이콘마다 따로 선언돼 있어 공통 타입으로 좁힌다 */}
          <Inner ref={inner} size={size} color="currentColor" duration={duration} />
        </Box>
      )
    },
  )
}
