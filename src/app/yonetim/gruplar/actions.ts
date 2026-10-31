"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uyar } from "@/lib/eylem";
import { grupKodu, kodGecerli } from "@/lib/grup";

const YOL = "/yonetim/gruplar";

function bildir(mesaj: string): never {
  redirect(`${YOL}?kaydedildi=${encodeURIComponent(mesaj)}`, RedirectType.replace);
}

function cakismaMi(m: string) {
  return /duplicate key|spor_gruplar_kod_key/i.test(m);
}

/** Yeni grup aç ya da grubu düzenle (yalnızca admin; veritabanı kuralı da denetler). */
export async function grupKaydet(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const ad = String(formData.get("ad") ?? "").trim();
  const kod = (String(formData.get("kod") ?? "").trim() || grupKodu(ad)).toLowerCase();
  if (!ad) uyar(YOL, "Grup adını yazın (ör. U12).");
  if (!kodGecerli(kod)) uyar(YOL, "Bağlantı kodu küçük harf, rakam ve tire olmalı (ör. u12).");

  const kayit = {
    ad,
    kod,
    aciklama: String(formData.get("aciklama") ?? "").trim() || null,
    sira: Number(formData.get("sira") ?? 0) || 0,
    kayit_acik: formData.get("kayit_acik") === "on",
    aktif: id ? formData.get("aktif") === "on" : true,
  };

  const { error } = id
    ? await supabase.from("spor_gruplar").update(kayit).eq("id", id)
    : await supabase.from("spor_gruplar").insert(kayit);
  if (error) {
    if (cakismaMi(error.message)) uyar(YOL, `"${kod}" kodu başka bir grupta kullanılıyor.`);
    if (/row-level security/i.test(error.message)) uyar(YOL, "Grupları yalnızca admin açar ve düzenler.");
    throw new Error(error.message);
  }
  revalidatePath("/", "layout");
  bildir(id ? `${ad} kaydedildi` : `${ad} grubu açıldı`);
}

/**
 * Sezon geçişi: işaretli gruplar yeni adlarına geçer (U15 → U16). Grup bir yaş kuşağıdır;
 * sporcuları, velileri, kasası onunla gider. "Pasife al" seçilen grup kayda kapanır.
 */
export async function sezonGecisi(formData: FormData) {
  const supabase = await createClient();
  const idler = formData.getAll("gecis").map(String);
  if (!idler.length) uyar(YOL, "Geçiş için en az bir grup seçin.");
  const degisimler = idler.map((id) => {
    const ad = String(formData.get(`ad_${id}`) ?? "").trim();
    return {
      grup_id: id,
      ad,
      kod: String(formData.get(`kod_${id}`) ?? "").trim().toLowerCase() || grupKodu(ad),
      aktif: formData.get(`pasif_${id}`) !== "on",
    };
  });
  for (const d of degisimler) {
    if (!d.ad || !kodGecerli(d.kod)) uyar(YOL, "Her grup için geçerli yeni ad ve kod gerekli.");
  }
  if (new Set(degisimler.map((d) => d.kod)).size !== degisimler.length) {
    uyar(YOL, "İki grup aynı koda geçemez.");
  }
  const { error } = await supabase.rpc("spor_sezon_gecisi", { p_degisimler: degisimler });
  if (error) {
    if (cakismaMi(error.message)) {
      uyar(YOL, "Yeni kodlardan biri geçişe katılmayan bir grupta kullanılıyor. O grubu da geçişe ekleyin ya da pasife alın.");
    }
    uyar(YOL, error.message);
  }
  revalidatePath("/", "layout");
  bildir(`Sezon geçişi tamamlandı: ${degisimler.length} grup`);
}

/** Sporcuyu başka gruba taşı (admin / kulüp başkanı). */
export async function sporcuGrupDegistir(formData: FormData) {
  const supabase = await createClient();
  const sporcu = String(formData.get("sporcu") ?? "");
  const grup = String(formData.get("grup") ?? "");
  const donus = `/yonetim/sporcular/${sporcu}`;
  const { error } = await supabase.rpc("spor_sporcu_grup_degistir", { p_sporcu: sporcu, p_grup: grup });
  if (error) uyar(donus, error.message);
  revalidatePath("/yonetim/sporcular");
  // Sporcu artık başka grupta: yönetici kendi grubunun listesine döner
  redirect(`/yonetim/sporcular?kaydedildi=${encodeURIComponent("Sporcu diğer gruba taşındı")}`, RedirectType.replace);
}
