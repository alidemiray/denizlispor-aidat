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
    okul: metin(formData.get("okul")),
    ayak: metin(formData.get("ayak")),
    acil_kisi: metin(formData.get("acil_kisi")),
    acil_telefon: metin(formData.get("acil_telefon")),
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

export async function sporcuDurumGuncelle(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const durum = String(formData.get("durum"));
  const guncelleme: Record<string, unknown> = { durum };
  const aidat = formData.get("aylik_aidat");
  if (aidat !== null && String(aidat).trim() !== "") {
    guncelleme.aylik_aidat = sayi(aidat);
  }
  const yasGrubu = metin(formData.get("yas_grubu"));
  if (yasGrubu) guncelleme.yas_grubu = yasGrubu;

  const { error } = await supabase.from("spor_sporcular").update(guncelleme).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/sporcular");
  revalidatePath("/yonetim");
}

export async function macKaydet(formData: FormData) {
  const supabase = await createClient();
  const id = metin(formData.get("id"));
  const kayit = {
    tarih: String(formData.get("tarih")),
    saat: metin(formData.get("saat")),
    rakip: String(formData.get("rakip") ?? "").trim(),
    yas_grubu: metin(formData.get("yas_grubu")),
    yer: String(formData.get("yer") ?? "ic"),
    tur: String(formData.get("tur") ?? "lig"),
    skor_biz: metin(formData.get("skor_biz")) ? sayi(formData.get("skor_biz")) : null,
    skor_rakip: metin(formData.get("skor_rakip")) ? sayi(formData.get("skor_rakip")) : null,
    aciklama: metin(formData.get("aciklama")),
  };

  if (id) {
    const { error } = await supabase.from("spor_maclar").update(kayit).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("spor_maclar").insert(kayit);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/yonetim/maclar");
}

export async function macSil(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_maclar")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/maclar");
  redirect("/yonetim/maclar");
}

export async function kadroKaydet(formData: FormData) {
  const supabase = await createClient();
  const macId = String(formData.get("mac_id"));

  const eklenecek: Record<string, unknown>[] = [];
  const silinecek: string[] = [];

  for (const anahtar of formData.keys()) {
    if (!anahtar.startsWith("dakika_")) continue;
    const sporcuId = anahtar.slice("dakika_".length);
    const dakika = Math.max(0, Math.min(130, sayi(formData.get(anahtar))));
    const ilkOnbir = formData.get(`ilk11_${sporcuId}`) === "on";
    const gol = Math.max(0, sayi(formData.get(`gol_${sporcuId}`)));
    const asist = Math.max(0, sayi(formData.get(`asist_${sporcuId}`)));
    const kart = String(formData.get(`kart_${sporcuId}`) ?? "yok");

    if (dakika > 0 || ilkOnbir || gol > 0 || asist > 0 || kart !== "yok") {
      eklenecek.push({
        mac_id: macId,
        sporcu_id: sporcuId,
        dakika,
        ilk_onbir: ilkOnbir,
        gol,
        asist,
        kart,
      });
    } else {
      silinecek.push(sporcuId);
    }
  }

  if (eklenecek.length) {
    const { error } = await supabase
      .from("spor_mac_katilim")
      .upsert(eklenecek, { onConflict: "mac_id,sporcu_id" });
    if (error) throw new Error(error.message);
  }
  if (silinecek.length) {
    const { error } = await supabase
      .from("spor_mac_katilim")
      .delete()
      .eq("mac_id", macId)
      .in("sporcu_id", silinecek);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/yonetim/maclar/${macId}`);
  revalidatePath("/yonetim/maclar");
}

export async function belgeSil(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const yol = metin(formData.get("dosya_yolu"));
  const { error } = await supabase.from("spor_belgeler").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (yol) await supabase.storage.from("spor-belgeler").remove([yol]);
  revalidatePath(`/yonetim/sporcular/${String(formData.get("sporcu_id"))}`);
}
