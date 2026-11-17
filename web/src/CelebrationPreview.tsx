import { useEffect, useState, type CSSProperties } from 'react'
import { Modal } from '@mui/material'
import { isEnglish } from './language'

// Storage may be unavailable in private browsing; still avoid replaying during this app session.
const seenInSession = new Set<string>()
function hasSeen(key: string) {
  try { return seenInSession.has(key) || localStorage.getItem(key) === '1' } catch { return seenInSession.has(key) }
}
function markSeen(key: string) {
  seenInSession.add(key)
  try { localStorage.setItem(key, '1') } catch { /* The in-memory fallback covers this session. */ }
}

const particles = [
  [-160, -150, 20, -25], [-116, -205, 14, 18], [-60, -180, 22, -18], [8, -224, 12, 25], [73, -190, 18, -12], [145, -158, 23, 20],
  [-180, -65, 13, 15], [-108, -85, 22, -20], [-45, -130, 12, 10], [45, -118, 16, -20], [113, -78, 14, 15], [180, -43, 18, -25],
  [-169, 45, 19, -18], [-114, 110, 13, 20], [-53, 148, 17, -15], [38, 156, 21, 18], [108, 108, 13, -20], [172, 48, 20, 20],
] as const

function Burst({ sequence }: { sequence: number }) {
  return <div key={sequence} className="celebration-burst" aria-hidden="true">
    {particles.map(([x, y, size, rotation], index) => <svg key={index} viewBox="0 0 24 24" className="celebration-particle" style={{ '--x': `${x}px`, '--y': `${y}px`, '--size': `${size}px`, '--rotation': `${rotation}deg`, '--delay': `${(index % 4) * 35}ms` } as CSSProperties}>
      <path d="M12 21S2 15 2 8.5C2 3 9 2 12 7c3-5 10-4 10 1.5C22 15 12 21 12 21Z" />
    </svg>)}
  </div>
}

export default function CelebrationPreview({ coupleId, userId, startedOn }: { coupleId: string; userId: string; startedOn: string }) {
  const key = `moro:celebration:200:${coupleId}:${userId}:${startedOn}`
  const [visible, setVisible] = useState(() => !hasSeen(key))
  const [presses, setPresses] = useState(0)
  const [burst, setBurst] = useState(0)
  const revealed = presses >= 3
  const en = isEnglish()

  useEffect(() => { if (visible) markSeen(key) }, [key, visible])

  const replay = () => { setPresses(0); setBurst(value => value + 1); setVisible(true) }
  const tapHeart = () => { setPresses(value => Math.min(value + 1, 3)); setBurst(value => value + 1) }

  return <>
    <button type="button" className="celebration-replay" onClick={replay}>{en ? 'Replay celebration' : '200일 축하 다시 보기'} <span aria-hidden="true">↗</span></button>
    <Modal open={visible} onClose={() => setVisible(false)} aria-label={en ? '200-day celebration' : '200일 축하'}>
    <div className="celebration" role="dialog" aria-modal="true" aria-label={en ? '200-day celebration' : '200일 축하'}>
      <div className="celebration-scrim" />
      <button className="celebration-close" type="button" aria-label={en ? 'Close celebration' : '축하 화면 닫기'} onClick={() => setVisible(false)}>×</button>
      <div className={`celebration-stage${revealed ? ' is-revealed' : ''}`}>
        <div className="celebration-note">
          <div className="celebration-topline"><span>OUR LITTLE MILESTONE</span><span>♥</span></div>
          {!revealed ? <div className="celebration-intro">
            <p>{en ? 'Our' : '우리의'}</p>
            <div className="celebration-number">200<span>th</span></div>
            <p>{en ? 'day together' : '번째 하루'}</p>
            <div className="celebration-instruction">{en ? 'Tap the heart three times' : '하트를 세 번 눌러봐'}</div>
          </div> : <div className="celebration-letter" aria-live="polite">
            <p className="celebration-letter-label">TO US, WITH LOVE</p>
            <p className="celebration-title">{en ? <>Happy<br />200 days!!</> : <>200일<br />축하!!</>}</p>
            <p className="celebration-copy">{en ? <>Here’s to more fun<br />and so much more love~ ❤️</> : <>앞으로도 더 재미있게<br />많이 사랑해봅시다~ ❤️</>}</p>
            <p className="celebration-signature">Always, us.</p>
          </div>}
          <div className="celebration-bottomline"><span>JUST YOU &amp; ME</span><span>200 DAYS TOGETHER</span></div>
        </div>
        <div className="celebration-heart-area">
          <Burst sequence={burst} />
          <button type="button" className="celebration-heart-button" onClick={tapHeart} aria-label={revealed ? (en ? 'Burst hearts' : '하트 터뜨리기') : (en ? `Tap heart, ${presses}/3` : `하트 누르기, ${presses}/3`)}>
            <svg viewBox="0 0 100 92" aria-hidden="true"><path d="M50 89C44 84 4 59 4 31 4 4 34-4 50 19 66-4 96 4 96 31 96 59 56 84 50 89Z" /></svg>
            <span>♥</span>
          </button>
          <div className="celebration-progress" aria-hidden="true">{[0, 1, 2].map(index => <i key={index} className={index < presses ? 'filled' : ''} />)}</div>
          <p className="celebration-hint">{revealed ? (en ? 'Tap the heart for more love!' : '하트를 누르면 사랑이 팡!') : `${presses} / 3`}</p>
        </div>
      </div>
    </div>
    </Modal>
  </>
}
