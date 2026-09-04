import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profil } from "@/lib/types";

/** Oturumu ve profili getirir; profil yoksa oluşturur. */
export async function oturum() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data } = await supabase.rpc("spor_profil");
  const profil = (data ?? null) as Profil | null;

  return { supabase, user, profil, rol: profil?.rol ?? "veli" };
}

export async function yoneticiGerekli() {
  const s = await oturum();
  if (s.rol !== "yonetici") redirect("/panel");
  return s;
}

/** Antrenör veya yönetici */
export async function personelGerekli() {
  const s = await oturum();
  if (s.rol !== "antrenor" && s.rol !== "yonetici") redirect("/panel");
  return s;
}

/** Rolüne göre kişinin ana ekranı */
export function anaEkran(rol: string) {
  if (rol === "antrenor") return "/antrenor";
  if (rol === "yonetici") return "/yonetim";
  return "/panel";
}
