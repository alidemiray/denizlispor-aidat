import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function yoneticiGerekli() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profil } = await supabase
    .from("spor_profiller")
    .select("id, ad_soyad, rol")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.rol !== "yonetici") redirect("/panel");

  return { supabase, user, profil };
}
