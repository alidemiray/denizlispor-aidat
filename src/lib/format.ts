export const AYLAR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

export function tl(deger: number | string | null | undefined) {
  const n = Number(deger ?? 0);
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);
}

export function donemAdi(tarih: string | null | undefined) {
  if (!tarih) return "-";
  const d = new Date(tarih + "T00:00:00");
  return `${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
}

export function gunAdi(tarih: string | null | undefined) {
  if (!tarih) return "-";
  const d = new Date(tarih.length > 10 ? tarih : tarih + "T00:00:00");
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function gecikmisMi(sonOdeme: string | null, durum: string) {
  if (durum !== "bekliyor" || !sonOdeme) return false;
  return new Date(sonOdeme + "T23:59:59") < new Date();
}

export function bugununDonemi() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
