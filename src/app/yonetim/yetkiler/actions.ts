"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uyar } from "@/lib/eylem";
import { ROL_ADI } from "@/lib/roller";

const YOL = "/yonetim/yetkiler";

function bildir(mesaj: string): never {
  redirect(`${YOL}?kaydedildi=${encodeURIComponent(mesaj)}`, RedirectType.replace);
}

/** Kişiye bir grupta pozisyon ver / al (grup değiştirmeden). */
export async function grupYetkisiVer(formData: FormData) {
  const supabase = await createClient();
  const rol = String(formData.get("rol") ?? "yok");
  const { error } = await supabase.rpc("spor_grup_yetkisi_ver", {
    p_kullanici: String(formData.get("kullanici") ?? ""),
    p_grup: String(formData.get("grup") ?? ""),
    p_rol: rol,
  });
  if (error) uyar(YOL, error.message);
  revalidatePath("/", "layout");
  bildir(rol === "yok" ? "Pozisyon kaldırıldı" : `Pozisyon verildi: ${ROL_ADI[rol] ?? rol}`);
}

/** Kulüp geneli rol: kulüp başkanı yap ya da veliye döndür (yalnızca admin). */
export async function kulupRoluVer(formData: FormData) {
  const supabase = await createClient();
  const rol = String(formData.get("rol") ?? "");
  const { error } = await supabase.rpc("spor_yetki_ver", {
    p_kullanici: String(formData.get("kullanici") ?? ""),
    p_rol: rol,
  });
  if (error) uyar(YOL, error.message);
  revalidatePath("/", "layout");
  bildir(rol === "baskan" ? "Kulüp başkanı atandı" : "Kulüp geneli yetki kaldırıldı");
}

/** Grup görünürlüğü: veliler kasa / ödemeyenler / aidat akışını görsün mü. */
export async function gorunurlukKaydet(formData: FormData) {
  const supabase = await createClient();
  const grup = String(formData.get("grup") ?? "");
  for (const anahtar of ["veli_kasa", "veli_odemeyenler", "veli_aidat_akisi"]) {
    const { error } = await supabase.rpc("spor_grup_ayar_yaz", {
      p_grup: grup,
      p_anahtar: anahtar,
      p_deger: formData.get(anahtar) === "on" ? "acik" : "kapali",
    });
    if (error) uyar(YOL, error.message);
  }
  revalidatePath("/", "layout");
  bildir("Görünürlük kaydedildi");
}
