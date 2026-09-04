import type { Mac } from "@/lib/types";

export function macBasligi(m: Pick<Mac, "rakip" | "yer">) {
  if (m.yer === "ic") return `Denizlispor — ${m.rakip}`;
  if (m.yer === "dis") return `${m.rakip} — Denizlispor`;
  return `Denizlispor / ${m.rakip}`;
}

export function skorMetni(m: Pick<Mac, "skor_biz" | "skor_rakip" | "yer">) {
  if (m.skor_biz === null || m.skor_rakip === null) return null;
  return m.yer === "dis"
    ? `${m.skor_rakip} - ${m.skor_biz}`
    : `${m.skor_biz} - ${m.skor_rakip}`;
}

export function sonucRozeti(m: Pick<Mac, "skor_biz" | "skor_rakip">) {
  if (m.skor_biz === null || m.skor_rakip === null) return null;
  if (m.skor_biz > m.skor_rakip) return { ad: "Galibiyet", stil: "bg-emerald-100 text-emerald-800" };
  if (m.skor_biz < m.skor_rakip) return { ad: "Mağlubiyet", stil: "bg-red-100 text-red-800" };
  return { ad: "Beraberlik", stil: "bg-neutral-200 text-neutral-700" };
}

export const MAC_TURU: Record<string, string> = {
  lig: "Lig",
  kupa: "Kupa",
  hazirlik: "Hazırlık",
  turnuva: "Turnuva",
};

export const KART_ADI: Record<string, string> = {
  yok: "—",
  sari: "Sarı kart",
  cift_sari: "Çift sarı",
  kirmizi: "Kırmızı kart",
};
