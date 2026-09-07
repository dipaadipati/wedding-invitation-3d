/** SATU-SATUNYA tempat mengubah teks undangan.
 * Semua bab + porsi panjang scroll diatur di sini; isi ulang undangan = edit file ini. */
export const invite = {
  // nama & tanggal (contoh fiktif untuk demo)
  eyebrow: 'Undangan pernikahan',
  groom: 'Raka',
  bride: 'Ayu',
  dateLine: 'Sabtu · 12 Desember 2026',
  // sapaan tamu; nama datang dari query ?kepada= di URL
  toPrefix: 'Kepada Yth.',
  brand: 'R & A',
  mark: 'Raka & Ayu · Amuntai',

  // bab salam
  salamHeading: 'Assalamualaikum Wr. Wb.',
  salamBody:
    'Dengan memohon rahmat dan ridha Allah SWT, kami mengundang Bapak/Ibu/Saudara/i untuk hadir, mendoakan, dan menyaksikan ikrar pernikahan kami.',

  // akad
  akadChip: 'AKAD NIKAH',
  akadDate: 'Sabtu · 12 Desember 2026',
  akadTime: 'Pukul 08.00 WITA',
  akadNote: 'Gedung Adipati Kota Raja, Amuntai.',

  // resepsi
  resepsiChip: 'RESEPSI',
  resepsiHeading: 'Setelah akad, mari bersilaturahmi.',
  resepsiTime: 'Pukul 12.00 hingga 15.00 WITA',
  resepsiNote: 'Susunan acara menyusul.',

  // penutup
  doaHeading: 'Doa restu Anda adalah hadiah terbaik kami.',
  doaBody:
    'Semoga Allah melimpahkan rahmat dan keberkahan atas kehadiran serta doa Bapak/Ibu/Saudara/i. Terima kasih sudah meluangkan waktu menyusuri undangan ini.',

  demoTag: 'undangan demo',
}

export type BabKey = 'cover' | 'salam' | 'akad' | 'resepsi' | 'doa'

/** Porsi scroll tiap bab (unit). total dipakai utk tinggi trek & batas pose kamera. */
export const babList: ReadonlyArray<{ key: BabKey; unit: number; label: string }> = [
  { key: 'cover', unit: 1.9, label: 'Pembuka' },
  { key: 'salam', unit: 1.05, label: 'Salam' },
  { key: 'akad', unit: 1.15, label: 'Akad' },
  { key: 'resepsi', unit: 1.0, label: 'Resepsi' },
  { key: 'doa', unit: 1.3, label: 'Doa' },
]

export const totalUnits = babList.reduce((s, b) => s + b.unit, 0)
