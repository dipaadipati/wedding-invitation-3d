import { useEffect, useRef, useState } from 'react'
import { createUndanganScene } from './engine'
import type { UndanganEngine } from './engine'
import { invite, babList, totalUnits } from './invite'
import type { BabKey } from './invite'

/* Batas progres 0..1 untuk tiap bab (urutan sama dgn babList). */
const BOUND = (() => {
  const out = [0]
  let c = 0
  for (const b of babList) {
    c += b.unit
    out.push(c / totalUnits)
  }
  return out
})()

/** Alfa tiap bab + indeks bab aktif untuk progres p (crossfade antar bab berdekatan). */
function layerAt(p: number): { alpha: number[]; k: number } {
  const n = babList.length
  let k = 0
  while (k < n - 1 && p >= BOUND[k + 1]) k++
  const alpha = new Array<number>(n).fill(0)
  const span = BOUND[k + 1] - BOUND[k]
  const u = span > 0 ? (p - BOUND[k]) / span : 1
  const r = Math.min(1, u / 0.42)
  const s = r * r * (3 - 2 * r) // smoothstep masuk
  if (k === 0) {
    alpha[0] = 1 // bab pembuka sudah penuh sejak halaman atas
  } else {
    alpha[k] = s
    alpha[k - 1] = 1 - s
  }
  return { alpha, k }
}

/** Bab pembuka dan penutup ikut "bernafas" pelan; bab lain diam agar panel terbaca. */
function driftY(j: number, k: number, s: number): number {
  if (j === k) return k === 0 ? 0 : (1 - s) * 42
  if (j === k - 1) return -s * 30
  return 0
}

function Rings() {
  return (
    <svg className="rings" viewBox="0 0 64 40" aria-hidden="true">
      <circle cx="22" cy="20" r="14" fill="none" stroke="#e7c14f" strokeWidth="3" />
      <circle cx="42" cy="20" r="14" fill="none" stroke="#f6e6c4" strokeWidth="3" />
    </svg>
  )
}

/** Isi kartu untuk satu bab; dipakai dua tempat (overlay 3D + daftar statis fallback). */
function CardContent({ k, guest }: { k: number; guest?: string }) {
  const key = babList[k].key as BabKey
  switch (key) {
    case 'cover':
      return (
        <>
          <p className="eyebrow">{invite.eyebrow}</p>
          <h1 className="name groom">{invite.groom}</h1>
          <Rings />
          <h1 className="name bride">{invite.bride}</h1>
          <p className="cover-date">{invite.dateLine}</p>
          {guest ? (
            <>
              <p className="guest">{invite.toPrefix}</p>
              <p className="guest-name">{guest}</p>
            </>
          ) : null}
        </>
      )
    case 'salam':
      return (
        <div className="card glass">
          <h2>{invite.salamHeading}</h2>
          <p className="body">{invite.salamBody}</p>
          <p className="sig">{invite.mark}</p>
        </div>
      )
    case 'akad':
      return (
        <div className="card glass">
          <p className="chip">{invite.akadChip}</p>
          <p className="l-date">{invite.akadDate}</p>
          <p className="l-time">{invite.akadTime}</p>
          <p className="note">{invite.akadNote}</p>
        </div>
      )
    case 'resepsi':
      return (
        <div className="card glass">
          <p className="chip">{invite.resepsiChip}</p>
          <h2>{invite.resepsiHeading}</h2>
          <p className="l-time">{invite.resepsiTime}</p>
          <p className="note">{invite.resepsiNote}</p>
        </div>
      )
    case 'doa':
      return (
        <div className="card glass">
          <h2>{invite.doaHeading}</h2>
          <p className="body">{invite.doaBody}</p>
          <p className="sig">{invite.mark}</p>
        </div>
      )
  }
}

export default function Demo() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engRef = useRef<UndanganEngine | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sectionsRef = useRef<HTMLElement[]>([])
  const dotsRef = useRef<(HTMLButtonElement | null)[]>([])
  const hintRef = useRef<HTMLParagraphElement>(null)
  const maxRef = useRef(0)
  const [boot, setBoot] = useState<'boot' | 'ready' | 'fallback'>('boot')
  const mid = BOUND.slice(0, -1).map((b, i) => (b + BOUND[i + 1]) / 2)
  // nama tamu dari URL, contoh: ?kepada=Adipati+dan+Partner
  const guest = (new URLSearchParams(window.location.search).get('kepada') ?? '').trim().replace(/\s+/g, ' ')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const engine = createUndanganScene(canvas, { reducedMotion: reduced })
    if (!engine) {
      setBoot('fallback')
      return
    }
    engRef.current = engine
    engine.onReady(() => setBoot('ready'))
    return () => {
      engRef.current = null
      engine.dispose()
    }
  }, [])

  /* Musik latar: Web Audio API sebagai SATU-SATUNYA mesin suara, karena loop-nya
     gapless (AudioBufferSourceNode.loop=true memutar ulang sampel akurat) — atribut
     loop di <audio> tidak gapless di iOS (WebKit me-restart elemen → jeda di titik
     loop sehingga beat meleset dari metronome), dan <audio> yang ikut berbunyi
     bersama Web Audio menimbulkan suara "double". Dua aturan iOS yang terbukti
     menentukan dari percobaan:
       1) AudioContext TIDAK boleh dibuat sebelum gestur — konteks yang lahir saat
          halaman muat senyap di iPhone walau sudah di-resume. Di iOS konteks hanya
          dibuat DI DALAM ketukan; di desktop dibuat saat muat (autoplay diizinkan).
          Byte mp3 di-fetch sejak awal TANPA membentuk konteks, lalu di-decode
          setelah konteks benar-benar 'running'.
       2) Pemicu harus betul-betul ketukan (pointerdown/touchstart/keydown), bukan
          sekadar scroll. Listener dilepas begitu sumber mulai. Tanpa tombol. */
  useEffect(() => {
    type AC = new () => AudioContext
    const ACtor: AC | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext
    if (!ACtor) return
    const iOS =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const url = `${import.meta.env.BASE_URL}audio/backsound.mp3`
    const EVENTS = ['pointerdown', 'touchstart', 'keydown'] as const

    let ctx: AudioContext | null = null
    let bytes: ArrayBuffer | null = null
    let started = false
    let disposed = false
    let lastTry = 0

    const startOn = (c: AudioContext) => {
      if (disposed || started) return
      const b = bytes
      if (!b || c.state !== 'running') return
      started = true
      c.decodeAudioData(b.slice(0))
        .then((buffer) => {
          if (disposed || started !== true || c.state === 'closed') return
          const src = c.createBufferSource()
          src.buffer = buffer
          src.loop = true
          const gain = c.createGain()
          gain.gain.value = 0.55
          src.connect(gain)
          gain.connect(c.destination)
          src.start(0)
        })
        .catch(() => {})
    }
    /* Pastikan ada konteks yang 'running', lalu mulai. Konteks yang tak 'running'
       ditutup dan diganti konteks BARU di dalam pemanggilan ini — jadi saat dipicu
       gestur, konteks lahir di dalam gestur (iOS); saat dipicu muat, lahir di
       muat (desktop autoplay). */
    const tryStart = async () => {
      if (disposed || started) return
      if (!bytes) return // fetch belum selesai → panggilan berikutnya mencoba lagi
      const now = Date.now()
      if (now - lastTry < 800) return // rapatkan rentetan event satu ketukan
      lastTry = now
      let c = ctx
      if (c && c.state !== 'running') {
        if (c.state !== 'closed') void c.close().catch(() => {})
        c = null
        ctx = null
      }
      if (!c) {
        c = new ACtor()
        ctx = c
      }
      if (c.state === 'suspended') {
        try {
          await c.resume()
        } catch {
          /* lanjut */
        }
      }
      if (disposed || started || ctx !== c) return
      startOn(c)
    }
    const unlock = () => {
      void tryStart()
    }

    // Muat byte mp3 sejak awal; di desktop langsung coba autoplay (mulai tanpa gestur).
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.arrayBuffer()
      })
      .then((ab) => {
        bytes = ab
        if (!iOS) void tryStart()
      })
      .catch(() => {})

    for (const ev of EVENTS) window.addEventListener(ev, unlock)
    return () => {
      disposed = true
      for (const ev of EVENTS) window.removeEventListener(ev, unlock)
      if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {})
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      maxRef.current = maxScroll
      const p = Math.min(1, Math.max(0, window.scrollY / maxScroll))
      engRef.current?.setProgress(p)
      const { alpha, k } = layerAt(p)
      for (let j = 0; j < babList.length; j++) {
        const el = sectionsRef.current[j]
        if (!el) continue
        const s = alpha[j]
        el.style.opacity = String(s)
        el.style.visibility = s > 0.001 ? 'visible' : 'hidden'
        el.style.transform = `translate3d(0, ${driftY(j, k, s)}px, 0)`
        const dot = dotsRef.current[j]
        dot?.classList.toggle('on', j === k)
      }
      if (hintRef.current) hintRef.current.style.opacity = String(1 - Math.min(1, p * 8))
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [])

  const jump = (i: number) => {
    const target = mid[i] * Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    window.scrollTo({ top: target, behavior: 'smooth' })
  }

  const rootClass = ['root', `boot-${boot}`, boot === 'fallback' ? 'fb' : ''].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <canvas ref={canvasRef} className="gl" />
      <div className="veil" aria-hidden="true" />

      <div className="stage" ref={stageRef}>
        {babList.map((b, j) => (
          <section
            key={b.key}
            className={`section sec-${b.key}`}
            ref={(el) => {
              if (el) sectionsRef.current[j] = el
            }}
            data-label={b.label}
          >
            <CardContent k={j} guest={guest} />
          </section>
        ))}
      </div>

      {/* daftar statis: dipakai saat WebGL mati */}
      <div className="fallback" aria-hidden={boot !== 'fallback'}>
        <div className="fb-cover">
          <CardContent k={0} guest={guest} />
        </div>
        {babList.slice(1).map((b, j) => (
          <section key={b.key} className="fb-card">
            <CardContent k={j + 1} guest={guest} />
          </section>
        ))}
        <p className="fb-tag">{invite.demoTag}</p>
      </div>

      {/* HUD */}
      <header className="hud-brand" aria-hidden="true">
        <span className="mono">{invite.brand}</span>
      </header>
      <nav className="rail" aria-label="Lompat bagian">
        {babList.map((b, j) => (
          <button
            key={b.key}
            ref={(el) => {
              dotsRef.current[j] = el
            }}
            className="dot"
            onClick={() => jump(j)}
            title={b.label}
            aria-label={b.label}
          />
        ))}
      </nav>
      <p className="hint" ref={hintRef}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none">
          <path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Gulir untuk menyusuri
      </p>
      <p className="demo-tag">{invite.demoTag}</p>

      <div className="loading" aria-hidden={boot !== 'boot'}>
        Menyiapkan pelataran…
      </div>

      {/* trek penggulung: menentukan panjang halaman, isinya kosong */}
      <div className="track" style={{ height: `${totalUnits * 100}vh` }} aria-hidden="true" />
    </div>
  )
}
