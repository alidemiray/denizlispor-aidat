import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { anaEkranYolu, antrenorMu, paraGorebilirMi, personelMi, yoneticiMi } from "@/lib/roller";
import type { Profil } from "@/lib/types";

/** Oturumu ve profili getirir; profil yoksa veritabanı tarafında oluşturulur. */
export async function oturum() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data } = await supabase.rpc("spor_profil");
  const profil = (data ?? null) as Profil | null;

  return { supabase, user, profil, rol: (profil?.rol ?? "veli") as string };
}

/** Yönetici veya başkan */
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

export { anaEkranYolu as anaEkran, antrenorMu, yoneticiMi, personelMi };
