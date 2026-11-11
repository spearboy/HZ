import { Box, Skeleton, Stack } from '@mui/material'

// 로딩 중에도 화면 뼈대를 먼저 보여 줘서 내용이 들어올 때 레이아웃이 튀지 않게 한다
export const CardSkeleton = ({ h }: { h: number }) => <Skeleton variant="rounded" height={h} sx={{ borderRadius: '18px' }} />

export function SummarySkeleton() {
  return (
    <Box className="screen home-screen" aria-busy="true">
      <Box className="screen-heading"><Skeleton width={140} height={52} /></Box>
      <Box className="couple-card"><CardSkeleton h={294} /></Box>
      <Box className="today-section"><Skeleton width={96} height={28} sx={{ mb: 1 }} /><CardSkeleton h={140} /></Box>
      <Box className="upcoming-section"><Skeleton width={96} height={28} sx={{ mb: 1 }} /><CardSkeleton h={72} /></Box>
      <Box className="week-section"><Skeleton width={72} height={28} sx={{ mb: 1 }} /><CardSkeleton h={136} /></Box>
    </Box>
  )
}

export function CalendarSkeleton() {
  return (
    <Box className="screen calendar-screen" aria-busy="true">
      <Skeleton width={60} height={20} />
      <Skeleton width={96} height={48} sx={{ mb: 1.5 }} />
      <Box className="calendar-layout"><CardSkeleton h={440} />
        <Box><Skeleton width={120} height={36} sx={{ mb: 1.5 }} /><Stack spacing={1}>{[0, 1].map((i) => <CardSkeleton key={i} h={72} />)}</Stack></Box></Box>
    </Box>
  )
}

export function GridSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Box sx={{ p: 2 }}>
      <Skeleton width={64} height={40} sx={{ mb: 2 }} />
      <Stack spacing={3}>
        {Array.from({ length: rows }, (_, r) => (
          <Box key={r}>
            <Skeleton width={140} height={28} sx={{ mb: 1 }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '1', borderRadius: 3 }} />)}
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
