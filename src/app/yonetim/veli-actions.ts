"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uyar } from "@/lib/eylem";

function bildir(yol: string, mesaj: string): never {
  redirect(`${yol}?kaydedildi=${encodeURIComponent(mesaj)}`, RedirectType.replace);
}

/** İkinci veliyi (anne ya da baba) e-postasıyla ekler; boş e-posta kaldırır. */
export async function ikinciVeliKaydet(formData: FormData) {
  const supabase = await createClient();
  const sporcu = String(formData.get("sporcu") ?? "");
  const eposta = String(formData.get("eposta") ?? "").trim();
  const yol = `/yonetim/sporcular/${sporcu}`;
  const { data: bagli, error } = await supabase.rpc("spor_ikinci_veli_ata", {
    p_sporcu: sporcu,
    p_eposta: eposta,
    p_ad_soyad: String(formData.get("ad_soyad") ?? ""),
    p_telefon: String(formData.get("telefon") ?? ""),
  });
  if (error) uyar(yol, error.message);
  revalidatePath(yol);
  bildir(
    yol,
    !eposta ? "İkinci veli kaldırıldı" : bagli ? "İkinci veli bağlandı" : "Kaydedildi; veli bu e-postayla hesap açınca bağlanır",
  );
}

/** Çift kaydı birleştirir: kopyadaki her şey ana kayda taşınır, kopya silinir. */
export async function sporcuBirlestir(formData: FormData) {
  const supabase = await createClient();
  const ana = String(formData.get("ana") ?? "");
  const kopya = String(formData.get("kopya") ?? "");
  const { error } = await supabase.rpc("spor_sporcu_birlestir", { p_ana: ana, p_kopya: kopya });
  if (error) uyar("/yonetim/sporcular", error.message);
  revalidatePath("/yonetim/sporcular");
  bildir(`/yonetim/sporcular/${ana}`, "Kayıtlar birleştirildi; iki veli de bu kayda bağlı");
}
