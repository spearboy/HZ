// Open-Meteo: 키·가입·요금 없음, CORS 허용. 문서 https://open-meteo.com/en/docs
// ponytail: 위치는 서울 고정. 위치 권한을 물을 만한 기능이 아니라서, 다른 지역이 필요해지면 설정에 도시 선택을 넣는다
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978'
  + '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  + '&timezone=Asia%2FSeoul&forecast_days=1'

export type Weather = { temp: number; code: number; max: number; min: number; pop: number }

const KEY = 'weather'
const FRESH = 10 * 60 * 1000
let pending: Promise<Weather | null> | null = null

// 탭을 오갈 때마다 다시 부르지 않게 10분 캐시
export function getWeather(): Promise<Weather | null> {
  if (pending) return pending
  pending = loadWeather().finally(() => { pending = null })
  return pending
}

async function loadWeather(): Promise<Weather | null> {
  try {
    const hit = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; w: Weather } | null
    if (hit && Date.now() - hit.at < FRESH) return hit.w
  } catch { /* 캐시가 깨졌으면 그냥 새로 부른다 */ }

  try {
    const r = await fetch(URL)
    if (!r.ok) return null
    const j = await r.json()
    const w: Weather = {
      temp: Math.round(j.current.temperature_2m),
      code: j.current.weather_code,
      max: Math.round(j.daily.temperature_2m_max[0]),
      min: Math.round(j.daily.temperature_2m_min[0]),
      pop: j.daily.precipitation_probability_max[0] ?? 0,
    }
    try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), w })) } catch { /* 저장 못 해도 이번엔 보여 준다 */ }
    return w
  } catch {
    return null // 날씨는 없어도 앱이 돌아간다
  }
}

// WMO 날씨 코드. 표: https://open-meteo.com/en/docs (Weather variable documentation)
export function weatherText(code: number) {
  if (code === 0) return '맑음'
  if (code <= 2) return '구름 조금'
  if (code === 3) return '흐림'
  if (code <= 48) return '안개'
  if (code <= 57) return '이슬비'
  if (code <= 67) return '비'
  if (code <= 77) return '눈'
  if (code <= 82) return '소나기'
  if (code <= 86) return '눈 소나기'
  return '천둥번개'
}

// 메인 카드에 깔 효과
export const weatherFx = (code: number): 'rain' | 'snow' | 'none' => {
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain'
  return 'none'
}
