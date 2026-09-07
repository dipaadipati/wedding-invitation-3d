import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { babList } from './invite'

export interface UndanganEngine {
  /** Progres scroll 0..1; dipakai koreografi kamera. */
  setProgress(p: number): void
  /** Callback sekali setelah frame pertama digambar (patung hati selesai dimuat / gagal). */
  onReady(cb: () => void): void
  dispose(): void
}

export interface EngineOptions {
  reducedMotion: boolean
}

/* ============================================================ tuning adegan
   Nilai pemandangan (posisi matahari, patung, pasangan) dikumpulkan di sini
   biar gampang dicoba-coba tanpa menyusuri seluruh file. */
const CENTER_HEART: readonly [number, number, number] = [0, 0, -5] // posisi panggung patung
const SUN_POS: readonly [number, number, number] = [0, 6.5, -120]
const FOG_NEAR = 30
const FOG_FAR = 150

/* ============================================================ koreografi kamera
   Satu pose {pos, focus} per BATAS bab (babList.length+1 pose), diinterpolasi
   per-segmen memakai Catmull-Rom 4 titik agar tepat berpapasan dgn teks bab.

   Kamera MEMUTARI patung hati (pusat ± (0, 2, -5)): tiap pose diambil dari orbit
   dengan sudut azimut & radius dari pusat patung, lalu fokus ditembakkan ke patung.
   Radius mengecil tiap bab, jadi makin di-scroll ke bawah makin dekat, dan bab
   terakhir berakhir di close-up "wajah" patung. Arah 0° = sisi depan (+z). */
const CAM_POS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 1.7, 9.2], //    buka   r13  a0°:  depan-tengah patung
  [7.8, 2.3, 0.4], //   salam  r9.5 a55°: sisi kanan patung, mulai dekat
  [3.9, 2.0, -11.8], // akad   r7.8 a150°: memutar lewat samping belakang
  [-3.3, 1.8, -10.7], // resepsi r6.6 a210°: sisi belakang, masih agak jauh
  [-4.0, 2.0, -3.6], // doa    r4.2 a290°: kembali ke depan, dekat
  [-0.3, 2.1, -2.1], // penutup r3  a355°: close-up wajah patung
]
const CAM_FOCUS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 2.1, -3.2], // depan-tengah patung (pose awal; patung jadi pusat adegan)
  [0, 1.7, -3.9], // arah sisi patung
  [0, 1.9, -5.0], // pusat patung
  [0, 1.7, -4.9], // pusat patung dari belakang
  [0, 2.0, -5.0], // detil atas patung
  [0, 2.15, -5.0], // "wajah" patung dari depan-dekat
]

const POS = CAM_POS.map((p) => new THREE.Vector3(...p))
const FOC = CAM_FOCUS.map((p) => new THREE.Vector3(...p))
const BOUND = (() => {
  const total = babList.reduce((s, b) => s + b.unit, 0)
  const b: number[] = [0]
  let cum = 0
  for (const x of babList) {
    cum += x.unit
    b.push(cum / total)
  }
  return b
})()

function crPoint(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const t2 = t * t
  const t3 = t2 * t
  const x = 0.5 * (2 * b.x + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3)
  const y = 0.5 * (2 * b.y + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3)
  const z = 0.5 * (2 * b.z + (-a.z + c.z) * t + (2 * a.z - 5 * b.z + 4 * c.z - d.z) * t2 + (-a.z + 3 * b.z - 3 * c.z + d.z) * t3)
  return out.set(x, y, z)
}

function sample(pts: THREE.Vector3[], p: number, out: THREE.Vector3): void {
  // cari segmen yang memuat progres p; batas = awal bab (pose kamera di tiap batas)
  let i = 0
  while (i < BOUND.length - 2 && p > BOUND[i + 1]) i++
  const span = BOUND[i + 1] - BOUND[i]
  const t = span > 0 ? Math.min(1, Math.max(0, (p - BOUND[i]) / span)) : 0
  const a = pts[Math.max(0, i - 1)]
  const b = pts[i]
  const c = pts[Math.min(pts.length - 1, i + 1)]
  const d = pts[Math.min(pts.length - 1, i + 2)]
  crPoint(a, b, c, d, t, out)
}

/* ============================================================ material
   Senja: gerbang & pepohonan sengaja gelap-hampir-hitam biar menyala di muka
   matahari. Panggung batu & tanah diberi nada hangat + butiran halus supaya
   tidak polos/hitam. */
const WOOD = new THREE.MeshStandardMaterial({ color: 0x5a331f, roughness: 1 })
const STONE = new THREE.MeshStandardMaterial({ color: 0x9a6a45, roughness: 0.85, metalness: 0.05, emissive: 0x2a1408, emissiveIntensity: 0.35 })
const LEAF = new THREE.MeshStandardMaterial({ color: 0x3a2a16, roughness: 1 })

/** Tekstur butir halus untuk tanah (digambar sekali di runtime, bukan file aset). */
function grainTexture(size = 160): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#7a6b58'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 2600; i++) {
      const v = 60 + Math.floor(Math.random() * 170)
      ctx.fillStyle = `rgba(${v}, ${Math.max(0, v - 20)}, ${Math.max(0, v - 46)}, ${0.05 + Math.random() * 0.12})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5)
    }
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(28, 18, 12, ${0.05 + Math.random() * 0.08})`
      ctx.fillRect(Math.random() * size, Math.random() * size, 2.4, 2.4)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(14, 14)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function disposeDeep(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) for (const m of mat) disposeMat(m)
    else if (mat) disposeMat(mat)
  })
}
function disposeMat(m: THREE.Material): void {
  const mm = m as THREE.MeshStandardMaterial
  for (const key of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'aoMap'] as const) {
    const t = mm[key]
    if (t) t.dispose()
  }
  m.dispose()
}

/* ============================================================ skenario yang
   di-scroll: panggung patung + lingkungan senja. Patung hati Meshy = pusat. */
function buildHeartStage(): THREE.Group {
  const root = new THREE.Group()
  const [hx, , hz] = CENTER_HEART
  // dua anak tangga panggung batu
  const step1 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.24, 40), STONE)
  step1.position.set(hx, 0.12, hz)
  const step2 = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 0.8, 40), STONE)
  step2.position.set(hx, 0.72, hz)
  root.add(step1, step2)
  return root
}

function buildEnvironment(scene: THREE.Scene): void {
  // langit kubah gradien senja (bukan dipengaruhi fog)
  const skyGeo = new THREE.SphereGeometry(380, 48, 24)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color('#23123c') },
      horizon: { value: new THREE.Color('#d1653f') },
      down: { value: new THREE.Color('#2a1220') },
    },
    vertexShader: `
      varying float vY;
      void main(){
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 down;
      varying float vY;
      void main(){
        vec3 col;
        if (vY >= 0.0) {
          col = mix(horizon, top, smoothstep(0.0, 0.8, vY));
        } else {
          col = mix(horizon, down, smoothstep(0.0, -0.7, -vY));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
  scene.add(new THREE.Mesh(skyGeo, skyMat))

  // tanah: warna tanah senja + butiran; bagian jauh meleleh ke warna cakrawala lewat fog
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x9c704c, map: grainTexture(), roughness: 0.95 })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(360, 72), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  scene.add(ground)

  scene.fog = new THREE.Fog(0xc25a38, FOG_NEAR, FOG_FAR)

  // cahaya senja: langit oranye menyebar merata + isian hangat dari depan +
  // rim dari arah matahari (belakang) supaya siluet & patung dapat garis tepi
  scene.add(new THREE.HemisphereLight(0xffc9a0, 0x2a1620, 0.9))
  const fill = new THREE.DirectionalLight(0xffd0a8, 0.55)
  fill.position.set(2, 6, 9)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xff8a45, 0.85)
  rim.position.set(-8, 5, -16)
  scene.add(rim)


  // gerbang/pergola siluet jauh di belakang panggung patung
  const pz = -20
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 11, 12), WOOD)
  post.position.set(-7, 5.5, pz)
  const post2 = post.clone()
  post2.position.set(7, 5.5, pz)
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(15, 0.6, 0.5), WOOD)
  lintel.position.set(0, 11.2, pz)
  scene.add(post, post2, lintel)

  // rumpun pohon siluet di sisi jauh
  const bushGeo = new THREE.SphereGeometry(1, 16, 12)
  const bush = (x: number, z: number, s: number) => {
    const m = new THREE.Mesh(bushGeo, LEAF)
    m.scale.set(s, s * 1.4, s)
    m.position.set(x, s, z)
    scene.add(m)
  }
  ;[-16, -12, 11, 15].forEach((x, i) => bush(x, -34 - (i % 2) * 6, 3 + (i % 2) * 1.2))

  // untaian lampu taman hangat di atas panggung patung
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false, fog: false, transparent: true, opacity: 0.95 }),
  )
  const bx0 = -5.5
  const bx1 = 5.5
  const topY = 10.6
  const sag = 1.6
  const n = 9
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1)
    const x = bx0 + (bx1 - bx0) * u
    const y = topY - sag * (1 - Math.cos(Math.PI * u)) * 0.5
    const b = bulb.clone()
    b.position.set(x, y, pz + 0.4)
    scene.add(b)
  }
}

function buildFireflies(): { points: THREE.Points; base: Float32Array; phase: Float32Array; speed: Float32Array } {
  const count = 140
  const base = new Float32Array(count * 3)
  const phase = new Float32Array(count)
  const speed = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    base[i * 3 + 0] = (Math.random() - 0.5) * 22
    base[i * 3 + 1] = 0.3 + Math.random() * 3.2
    base[i * 3 + 2] = -8 + Math.random() * 16
    phase[i] = Math.random() * Math.PI * 2
    speed[i] = 0.4 + Math.random() * 0.9
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base), 3))
  const mat = new THREE.PointsMaterial({
    color: 0xffcf8a,
    size: 0.09,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  })
  const points = new THREE.Points(geo, mat)
  return { points, base, phase, speed }
}

/** Gumpal matahari senja: satu persegi ber-shader radial (inti terang memudar ke
 *  tepi, agak lonjong horizontal). Diarahkan ke kamera di tiap frame sehingga
 *  tak pernah terlihat sebagai dua piringan atau tersabit saat berputar. */
function buildSunGlow(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      core: { value: new THREE.Color('#fff3d8') },
      glow: { value: new THREE.Color('#ff8a45') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 core;
      uniform vec3 glow;
      varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = sqrt(p.x * p.x * 0.4 + p.y * p.y);
        float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.1);
        vec3 col = mix(glow, core, smoothstep(0.5, 0.0, length(p)));
        gl_FragColor = vec4(col, a);
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  mesh.position.set(...SUN_POS)
  mesh.scale.setScalar(52)
  return mesh
}

/* ============================================================ entry */
export function createUndanganScene(canvas: HTMLCanvasElement, opts: EngineOptions): UndanganEngine | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(window.innerWidth, window.innerHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900)

  buildEnvironment(scene)

  // gumpal matahari senja (billboard; selalu diarahkan ke kamera, lihat frame())
  const sunGlow = buildSunGlow()
  scene.add(sunGlow)

  // panggung patung hati (Meshy) sebagai pusat adegan
  const stage = buildHeartStage()
  scene.add(stage)
  const heart = new THREE.Group()
  stage.add(heart)
  let heartLoaded = false

  const loader = new GLTFLoader()
  loader.load(
    '/models/meshy_hearts.glb',
    (gltf) => {
      const m = gltf.scene
      // material dibuat "menyala sendiri" agar patung terang di senja (tekstur tetap terlihat)
      m.traverse((o) => {
        const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (mm && mm.isMeshStandardMaterial) {
          // TEKSTUR model dipertahankan lewat glow hangat (emissiveMap = tekstur asli),
          // hanya diredupkan (intensitas lebih rendah drpd krem terang) agar matahari
          // maghrib lebih terasa tanpa menghilangkan teksturnya.
          mm.emissive = new THREE.Color('#ffca90')
          mm.emissiveIntensity = 0.55
          mm.emissiveMap = mm.map ?? null
          mm.metalness = Math.min(mm.metalness ?? 0, 0.3)
          mm.roughness = Math.max(mm.roughness ?? 0, 0.4)
        }
      })
      // ukuran & ground-kan di atas panggung (tinggi total ±2,2 m)
      const box = new THREE.Box3().setFromObject(m)
      const size = box.getSize(new THREE.Vector3())
      const targetH = 2.2
      const k = size.y > 0 ? targetH / size.y : 1
      m.scale.setScalar(k)
      heart.add(m)
      // angkat model agar dasar menyentuh puncak panggung (stage step2 puncak = 1,12)
      const box2 = new THREE.Box3().setFromObject(m)
      m.position.y -= box2.min.y
      heart.position.set(CENTER_HEART[0], 1.12, CENTER_HEART[2])
      heartLoaded = true
      fireReady()
    },
    undefined,
    (err) => {
      console.warn('[undangan] gagal memuat patung hati, lanjut tanpa patung:', err)
      fireReady()
    },
  )

  // kunang-kunang
  const ff = buildFireflies()
  scene.add(ff.points)

  let raf = 0
  let pTarget = 0
  let pCur = 0
  let disposed = false
  let readyFired = false
  let readyCb: (() => void) | null = null
  const camPos = new THREE.Vector3()
  const camFocus = new THREE.Vector3()
  const clock = new THREE.Clock()

  function fireReady(): void {
    if (readyFired || disposed) return
    readyFired = true
    if (readyCb) readyCb()
  }
  // kalau model sangat lambat, tetap kasih sinyal setelah frame pertama (2s an)
  const failTimer = window.setTimeout(fireReady, 4000)

  function frame(): void {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    pCur += (pTarget - pCur) * Math.min(1, dt * 4.5)
    sample(POS, pCur, camPos)
    sample(FOC, pCur, camFocus)

    // "napas" halus biar kamera tidak beku sempurna (nonaktif saat reduced-motion)
    if (!opts.reducedMotion) {
      const sway = 0.05
      camPos.x += Math.sin(t * 0.5) * sway
      camPos.y += Math.cos(t * 0.37) * sway * 0.5
      camFocus.y += Math.sin(t * 0.6 + 1.0) * 0.04
    }

    camera.position.copy(camPos)
    camera.lookAt(camFocus)
    // gumpal matahari selalu menghadap kamera (tetap bulat/lembut dari semua sudut)
    sunGlow.lookAt(camera.position)

    // kunang-kunang melayang pelan
    const arr = ff.points.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < ff.phase.length; i++) {
      const y = ff.base[i * 3 + 1] + Math.sin(t * ff.speed[i] + ff.phase[i]) * 0.35
      arr[i * 3 + 1] = y
      arr[i * 3 + 0] = ff.base[i * 3 + 0] + Math.cos(t * ff.speed[i] * 0.6 + ff.phase[i]) * 0.8
    }
    ff.points.geometry.attributes.position.needsUpdate = true

    if (heartLoaded) heart.rotation.y = Math.sin(t * 0.08) * 0.04

    renderer.render(scene, camera)
  }

  function onResize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
  }
  window.addEventListener('resize', onResize)
  frame()
  // sinyal siap setelah satu frame pertama (adegan sudah tergambar)
  requestAnimationFrame(() => {
    if (!heartLoaded) fireReady()
  })

  return {
    setProgress(p) {
      pTarget = Math.min(1, Math.max(0, p))
    },
    onReady(cb) {
      readyCb = cb
      if (readyFired) cb()
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(raf)
      window.clearTimeout(failTimer)
      window.removeEventListener('resize', onResize)
      disposeDeep(scene)
      renderer.dispose()
    },
  }
}
