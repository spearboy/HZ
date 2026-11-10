import assert from 'node:assert/strict'
import { getWeather } from '../src/weather.ts'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
} })
let requests = 0
globalThis.fetch = (async () => {
  requests++
  await new Promise(resolve => setTimeout(resolve, 10))
  return { ok: true, json: async () => ({
    current: { temperature_2m: 17, weather_code: 0 },
    daily: { temperature_2m_max: [20], temperature_2m_min: [12], precipitation_probability_max: [5] },
  }) } as Response
}) as typeof fetch

const [first, concurrent] = await Promise.all([getWeather(), getWeather()])
assert.deepEqual(first, { temp: 17, code: 0, max: 20, min: 12, pop: 5 })
assert.deepEqual(concurrent, first)
assert.equal(requests, 1, '동시에 호출해도 날씨 요청은 한 번만 보낸다')
assert.deepEqual(await getWeather(), first)
assert.equal(requests, 1, '유효한 캐시를 재사용한다')
console.log('weather cache ok')
