"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function sayi(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function metin(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function sporcuKaydet(formData: FormData) {
  const supabase = await createClient();
  const id = metin(formData.get("id"));

  const kayit = {
    ad: String(formData.get("ad") ?? "").trim(),
    soyad: String(formData.get("soyad") ?? "").trim(),
    dogum_tarihi: metin(formData.get("dogum_tarihi")),
    yas_grubu: metin(formData.get("yas_grubu")),
    mevki: metin(formData.get("mevki")),
    forma_no: metin(formData.get("forma_no")) ? sayi(formData.get("forma_no")) : null,
    veli_ad_soyad: metin(formData.get("veli_ad_soyad")),
    veli_telefon: metin(formData.get("veli_telefon")),
    veli_eposta: metin(formData.get("veli_eposta"))?.toLowerCase() ?? null,
    aylik_aidat: sayi(formData.get("aylik_aidat")),
    durum: String(formData.get("durum") ?? "aktif"),
    notlar: metin(formData.get("notlar")),
  };

  if (id) {
    const { error } = await supabase.from("spor_sporcular").update(kayit).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("spor_sporcular").insert(kayit);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/yonetim/sporcular");
  redirect("/yonetim/sporcular");
}

export async function sporcuSil(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("spor_sporcular").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/sporcular");
  redirect("/yonetim/sporcular");
}

export async function donemOlustur(formData: FormData) {
  const supabase = await createClient();
  const ham = String(formData.get("donem"));
  const donem = ham.length === 7 ? `${ham}-01` : ham;
  const sonOdeme = metin(formData.get("son_odeme_tarihi"));
  const { error } = await supabase.rpc("spor_donem_olustur", {
    p_donem: donem,
    p_son_odeme: sonOdeme,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/aidatlar");
}

export async function aidatDurumGuncelle(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const durum = String(formData.get("durum"));
  const { error } = await supabase.from("spor_aidatlar").update({ durum }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/aidatlar");
}

export async function aidatSil(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_aidatlar")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/aidatlar");
}

export async function odemeKarar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const id = String(formData.get("id"));
  const durum = String(formData.get("durum"));
  const { error } = await supabase
    .from("spor_odemeler")
    .update({
      durum,
      onaylayan_id: user?.id ?? null,
      onay_tarihi: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/odemeler");
  revalidatePath("/yonetim/aidatlar");
}

export async function odemeEkle(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("spor_odemeler").insert({
    sporcu_id: String(formData.get("sporcu_id")),
    aidat_id: metin(formData.get("aidat_id")),
    tutar: sayi(formData.get("tutar")),
    odeme_tarihi: String(formData.get("odeme_tarihi")),
    yontem: String(formData.get("yontem") ?? "nakit"),
    aciklama: metin(formData.get("aciklama")),
    durum: "onaylandi",
    bildiren_id: user?.id ?? null,
    onaylayan_id: user?.id ?? null,
    onay_tarihi: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/odemeler");
  revalidatePath("/yonetim/aidatlar");
}

export async function ayarKaydet(formData: FormData) {
  const supabase = await createClient();
  const anahtarlar = [
    "kulup_adi",
    "banka_adi",
    "hesap_sahibi",
    "iban",
    "odeme_aciklamasi",
    "iletisim_telefon",
    "iletisim_eposta",
  ];
  const satirlar = anahtarlar.map((a) => ({
    anahtar: a,
    deger: String(formData.get(a) ?? "").trim(),
    guncellendi: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("spor_ayarlar")
    .upsert(satirlar, { onConflict: "anahtar" });
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/ayarlar");
  revalidatePath("/panel/odeme-bildir");
}

export async function rolAta(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_profiller")
    .update({ rol: String(formData.get("rol")) })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/ayarlar");
}
