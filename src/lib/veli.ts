import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kişinin velisi olduğu (anne ya da baba: birinci veya ikinci veli) ve isteğe bağlı olarak
 * kendisi olduğu sporcu kayıtları. 20261106 göçü (ikinci_veli_id) yoksa eski sorguya düşer.
 */
export async function benimSporcularim<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  kullanici: string,
  kolonlar = "*",
  { sporcuDahil = true }: { sporcuDahil?: boolean } = {},
): Promise<{ data: T[] }> {
  const kosul = (ikinci: boolean) =>
    [
      `veli_id.eq.${kullanici}`,
      ...(ikinci ? [`ikinci_veli_id.eq.${kullanici}`] : []),
      ...(sporcuDahil ? [`sporcu_kullanici_id.eq.${kullanici}`] : []),
    ].join(",");
  const yeni = await supabase.from("spor_sporcular").select(kolonlar).or(kosul(true)).order("ad");
  if (!yeni.error) return { data: (yeni.data ?? []) as T[] };
  const eski = await supabase.from("spor_sporcular").select(kolonlar).or(kosul(false)).order("ad");
  return { data: (eski.data ?? []) as T[] };
}
