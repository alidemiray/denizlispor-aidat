export const ANTRENMAN_TURU: Record<string, string> = {
  saha: "Saha antrenmanı",
  kondisyon: "Kondisyon",
  taktik: "Taktik çalışma",
  kuvvet: "Kuvvet / core",
  mac_provasi: "Maç provası",
  tesis_disi: "Tesis dışı",
  diger: "Diğer",
};

export const YOKLAMA_DURUMU: Record<
  string,
  { ad: string; kisa: string; stil: string; nokta: string }
> = {
  geldi: {
    ad: "Geldi",
    kisa: "G",
    stil: "bg-emerald-100 text-emerald-800",
    nokta: "bg-emerald-600",
  },
  gec: { ad: "Geç geldi", kisa: "Gç", stil: "bg-amber-100 text-amber-900", nokta: "bg-amber-500" },
  izinli: { ad: "İzinli", kisa: "İ", stil: "bg-sky-100 text-sky-800", nokta: "bg-sky-600" },
  gelmedi: { ad: "Gelmedi", kisa: "Y", stil: "bg-red-100 text-red-800", nokta: "bg-red-600" },
};

export const DEGERLENDIRME_ALANLARI = [
  { anahtar: "teknik", ad: "Teknik" },
  { anahtar: "fizik", ad: "Fizik" },
  { anahtar: "taktik", ad: "Taktik" },
  { anahtar: "disiplin", ad: "Disiplin" },
  { anahtar: "takim_oyunu", ad: "Takım oyunu" },
] as const;

/** Tarihin içinde bulunduğu haftanın pazartesisi (ISO) */
export function haftaBasi(tarih: string) {
  const d = new Date(tarih + "T00:00:00");
  const gun = (d.getDay() + 6) % 7; // pazartesi = 0
  d.setDate(d.getDate() - gun);
  return d.toISOString().slice(0, 10);
}

export function haftaAdi(haftaBasiTarihi: string) {
  const bas = new Date(haftaBasiTarihi + "T00:00:00");
  const son = new Date(bas);
  son.setDate(son.getDate() + 6);
  const bicim = (d: Date) =>
    d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return `${bicim(bas)} – ${bicim(son)}`;
}

export function buHaftaMi(haftaBasiTarihi: string) {
  return haftaBasi(new Date().toISOString().slice(0, 10)) === haftaBasiTarihi;
}
