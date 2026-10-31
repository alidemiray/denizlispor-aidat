import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { anaEkranYolu, antrenorMu, kasaGorebilirMi, kulupGeneliMi, paraGorebilirMi, personelMi, yoneticiMi } from "@/lib/roller";
import type { Profil } from "@/lib/types";

/**
 * Oturumu ve profili getirir; profil yoksa veritabanı tarafında oluşturulur.
 * `cache`: aynı istek içinde düzen (layout) ve sayfa birlikte çağırınca tek sefer çalışır.
 * Kullanıcı jetondan (getClaims) okunur; middleware isteği zaten doğruladı.
 */
export const oturum = cache(async () => {
  const supabase = await createClient();
  const [{ data: claimData }, { data }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.rpc("spor_profil"),
  ]);
  const claims = claimData?.claims;
  if (!claims?.sub) redirect("/giris");
  const user = { id: claims.sub, email: (claims.email as string | undefined) ?? null };

  const profil = (data ?? null) as Profil | null;

  return { supabase, user, profil, rol: (profil?.rol ?? "veli") as string };
});

/** Admin, kulüp başkanı veya grup yöneticisi */
export async function yoneticiGerekli() {
  const s = await oturum();
  if (!yoneticiMi(s.rol)) redirect(anaEkranYolu(s.rol));
  return s;
}

/** Antrenör, yardımcı antrenör, başkan veya yönetici */
export async function personelGerekli() {
  const s = await oturum();
  if (!personelMi(s.rol)) redirect(anaEkranYolu(s.rol));
  return s;
}

/** Para ile ilgili ekranlar: sporcu hesapları giremez. */
export async function paraEkraniGerekli() {
  const s = await oturum();
  if (!paraGorebilirMi(s.rol)) redirect("/panel");
  return s;
}

/** Kulübün parası (kasa, aidat akışı): yönetim ve veli; antrenör ve sporcu giremez. */
export async function kasaEkraniGerekli() {
  const s = await oturum();
  if (!kasaGorebilirMi(s.rol)) redirect(anaEkranYolu(s.rol));
  return s;
}

/** Admin ya da kulüp başkanı (tüm gruplar) */
export async function kulupGeneliGerekli() {
  const s = await oturum();
  if (!kulupGeneliMi(s.rol)) redirect(anaEkranYolu(s.rol));
  return s;
}

export { anaEkranYolu as anaEkran, antrenorMu, yoneticiMi, personelMi };
