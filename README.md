# undangan-digital-demo

Undangan pernikahan 3D berbasis scroll. Saat halaman digulir, kamera Three.js
menyusuri pelataran senja mengelilingi panggung patung hati, sementara teks
undangan bab per bab muncul di layar. Proyek contoh terpisah dari situs Gedung
Adipati (folder ini sengaja di-ignore dari repo root).

- Vite + React + TypeScript + Three.js (`three` 0.179).
- Patung hati tengah = model GLB dari Meshy (`public/models/meshy_hearts.glb`).
- Pasangan mempelai = siluet dari kode (bukan model manusia), berdiri di depan
  patung, saling pandang menggenggam tangan.
- Semua teks undangan ada di SATU file: `src/invite.ts`.

## Menjalankan

```bash
npm install
npm run dev      # buka http://localhost:5173
```

Verifikasi visual di browser: patung hati muncul (cek tab Network memuat
`/models/meshy_hearts.glb`), pasangan siluet di depannya, langit senja. Scroll
menggerakkan kamera dan teks bab berganti halus; titik di sisi kanan untuk lompat bab.

Build produksi:

```bash
npm run lint
npm run build
npm run preview
```

## Mengganti teks undangan

Edit `src/invite.ts`. Nama, tanggal, isi bab, dan panjang scroll tiap bab
(`unit`) diatur di sana. Tidak perlu menyentuh file lain.

Panjang trek halaman = `totalUnits * 100vh` (bawaan ±6,4 unit). Batas tiap bab
otomatis menjadi pose kamera baru di `src/engine.ts`.

## Mengganti model patung

1. Unduh GLB dari Meshy (pilih format **glTF / GLB**).
2. Letakkan di `public/models/` lalu ganti nama di `src/engine.ts` pada
   `loader.load(...)`.
3. Patung otomatis di-ground-kan di panggung dan dinyalakan hangat. Posisi
   panggung ada di konstanta `CENTER_HEART` di `src/engine.ts`.

Catatan: model Meshy bawaan ±17 MB; untuk ponsel bisa dikompres dulu
(gltfpack/Draco + turunkan ukuran tekstur).

## Struktur

```
src/invite.ts    # teks undangan + daftar bab (satu-satunya sumber teks)
src/engine.ts    # scene Three.js: langit senja, GLB, pasangan siluet, kamera, kunang-kunang
src/Demo.tsx     # kanvas + overlay bab + loop scroll ke kamera/UI + fallback WebGL
src/styles.css   # semua gaya overlay, veil, rail, tipografi
public/models/   # GLB patung hati
```

Kasus WebGL mati: halaman otomatis menumpuk isi undangan sebagai dokumen statis
yang tetap terbaca tanpa 3D.
