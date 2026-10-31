import type { SupabaseClient } from "@supabase/supabase-js";
import { gocYok } from "@/lib/ozellik";

/**
 * Gruplar: bir kulüp yaş gruplarını tek sistemde toplayabilir ya da ayırabilir.
 * Her grubun sporcuları, aidatı, kasası ve ödeme bilgileri ayrıdır; ayrımı veritabanı
 * yapar (aktif gruba göre satır kuralları). Ekranlar yalnızca grup seçiciyi gösterir.
 * Göç (20261104_gruplar) yoksa fonksiyonlar boş döner; uygulama tek grup gibi çalışır.
 */
export type Grubum = {
  id: string;
  ad: string;
  kod: string;
  sira: number;
  aktif: boolean;
  kayit_acik: boolean;
  secili: boolean;
  rol: string;
};

export type KayitGrubu = { id: string; ad: string; kod: string; aciklama: string | null };

export async function gruplarim(supabase: SupabaseClient): Promise<Grubum[]> {
  const { data, error } = await supabase.rpc("spor_gruplarim");
  if (error || !Array.isArray(data)) return [];
  return data as Grubum[];
}

export async function kayitGruplari(supabase: SupabaseClient): Promise<KayitGrubu[]> {
  const { data, error } = await supabase.rpc("spor_kayit_gruplari");
  if (error || !Array.isArray(data)) return [];
  return data as KayitGrubu[];
}

export function seciliGrup(gruplar: Grubum[]) {
  return gruplar.find((g) => g.secili) ?? gruplar[0] ?? null;
}

/** "U15" → "U16", "U9 Kızlar" → "U10 Kızlar"; sayı yoksa adı değiştirmez. */
export function ustKlasman(ad: string) {
  return ad.replace(/(\d+)/, (n) => String(Number(n) + 1));
}

/** Grup adından bağlantı kodu: "U15 Kızlar" → "u15-kizlar" */
export function grupKodu(ad: string) {
  const harf: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };
  return ad
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (c) => harf[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/** Kod geçerli mi (veritabanı kuralıyla aynı) */
export function kodGecerli(kod: string) {
  return /^[a-z0-9][a-z0-9-]{0,23}$/.test(kod);
}

/** Aktif grubun ayarları (IBAN vb. gruba özel olan kulüp genelini ezer); göç yoksa eski tablo. */
export async function ayarlariOku(supabase: SupabaseClient): Promise<Record<string, string>> {
  const r = await supabase.rpc("spor_ayarlari");
  const satirlar =
    r.error && gocYok(r.error) ? (await supabase.from("spor_ayarlar").select("anahtar, deger")).data : r.data;
  return Object.fromEntries(
    ((satirlar ?? []) as { anahtar: string; deger: string | null }[]).map((x) => [x.anahtar, x.deger ?? ""]),
  );
}
