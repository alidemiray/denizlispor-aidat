import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function yoneticiGerekli() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  // spor_profil(): profil satırı yoksa oluşturur, ilk kullanıcıyı yönetici yapar
  // ve e-postayla eşleşen bekleyen sporcuları hesaba bağlar.
  const { data: profil } = await supabase.rpc("spor_profil");

  if (profil?.rol !== "yonetici") redirect("/panel");

  return { supabase, user, profil };
}
