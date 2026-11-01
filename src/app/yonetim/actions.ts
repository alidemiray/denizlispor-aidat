"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hataIsle, uyar } from "@/lib/eylem";
import { ROL_ADI } from "@/lib/roller";
import { gocYok } from "@/lib/ozellik";

function sayi(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim().replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function metin(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

/** Kaydetme sonrası ekranda "kaydedildi" bildirimi göstermek için. */
function bildir(yol: string, mesaj: string): never {
  const ayrac = yol.includes("?") ? "&" : "?";
  // replace: kaydetme dönüşü geri geçmişine yeni ekran olarak yazılmaz
  redirect(`${yol}${ayrac}kaydedildi=${encodeURIComponent(mesaj)}`, RedirectType.replace);
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
    sporcu_eposta: metin(formData.get("sporcu_eposta"))?.toLowerCase() ?? null,
    aylik_aidat: sayi(formData.get("aylik_aidat")),
    durum: String(formData.get("durum") ?? "aktif"),
    notlar: metin(formData.get("notlar")),
  };

  // Esnek aidat alanları (20261031 göçü). Form bu alanları gönderdiyse yazılır.
  const esnek: Record<string, unknown> = {};
  if (formData.has("indirim_orani")) {
    esnek.indirim_orani = Math.max(0, Math.min(100, sayi(formData.get("indirim_orani"))));
    esnek.indirim_nedeni = metin(formData.get("indirim_nedeni"));
    esnek.dondurma_bas = metin(formData.get("dondurma_bas"));
    esnek.dondurma_bit = metin(formData.get("dondurma_bit"));
    if (esnek.dondurma_bas && esnek.dondurma_bit && String(esnek.dondurma_bit) < String(esnek.dondurma_bas)) {
      uyar(id ? `/yonetim/sporcular/${id}` : "/yonetim/sporcular/yeni", "Dondurma bitişi başlangıçtan önce olamaz.");
    }
  }

  const yaz = (alanlar: Record<string, unknown>) =>
    id
      ? supabase.from("spor_sporcular").update(alanlar).eq("id", id)
      : supabase.from("spor_sporcular").insert(alanlar);

  let { error } = await yaz({ ...kayit, ...esnek });
  // Göç henüz uygulanmadıysa (yeni sütunlar yok) temel alanlarla kaydet
  if (error && Object.keys(esnek).length && /column|indirim_|dondurma_|PGRST204/i.test(`${error.code} ${error.message}`)) {
    ({ error } = await yaz(kayit));
  }
  if (error) throw new Error(error.message);

  revalidatePath("/yonetim/sporcular");
  bildir("/yonetim/sporcular", id ? "Sporcu bilgileri güncellendi" : "Sporcu eklendi");
}

export async function sporcuSil(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_sporcular")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/sporcular");
  bildir("/yonetim/sporcular", "Sporcu silindi");
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
  revalidatePath("/yonetim/on-kayit");
  revalidatePath("/yonetim");
  const donus = String(formData.get("donus") ?? "") === "/yonetim/on-kayit" ? "/yonetim/on-kayit" : "/yonetim/sporcular";
  bildir(
    donus,
    durum === "aktif" ? "Sporcu onaylandı ve aktif edildi" : "Sporcu durumu güncellendi",
  );
}

export async function donemOlustur(formData: FormData) {
  const supabase = await createClient();
  const ham = String(formData.get("donem"));
  const donem = ham.length === 7 ? `${ham}-01` : ham;
  const sonOdeme = metin(formData.get("son_odeme_tarihi"));

  const { data, error } = await supabase.rpc("spor_donem_olustur", {
    p_donem: donem,
    p_son_odeme: sonOdeme,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/yonetim/aidatlar");
  const adet = typeof data === "number" ? data : 0;
  bildir(
    `/yonetim/aidatlar?donem=${donem}`,
    adet > 0 ? `${adet} sporcuya tahakkuk oluşturuldu` : "Bu dönem için yeni kayıt eklenmedi",
  );
}

export async function aidatDurumGuncelle(formData: FormData) {
  const supabase = await createClient();
  const durum = String(formData.get("durum"));
  const { error } = await supabase
    .from("spor_aidatlar")
    .update({ durum })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/aidatlar");
  bildir("/yonetim/aidatlar", durum === "muaf" ? "Muaf olarak işaretlendi" : "Kayıt güncellendi");
}

export async function aidatSil(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_aidatlar")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/aidatlar");
  bildir("/yonetim/aidatlar", "Aidat kaydı silindi");
}

export async function odemeKarar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const durum = String(formData.get("durum"));

  const { error } = await supabase
    .from("spor_odemeler")
    .update({
      durum,
      onaylayan_id: user?.id ?? null,
      onay_tarihi: new Date().toISOString(),
    })
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);

  revalidatePath("/yonetim/odemeler");
  revalidatePath("/yonetim/aidatlar");
  bildir("/yonetim/odemeler", durum === "onaylandi" ? "Ödeme onaylandı" : "Ödeme reddedildi");
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
  bildir("/yonetim/odemeler", "Ödeme kaydedildi");
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
    "kardes_indirimi",
    "kist_hesap",
    "son_odeme_gunu",
    "otomatik_tahakkuk",
    "hatirlatma",
    "bildirim_gelmedi",
    "hatirlatma_once",
    "hatirlatma_gecikme",
    "sessiz_bas",
    "sessiz_bit",
  ].filter((a) => formData.has(a));
  const degerler = Object.fromEntries(
    anahtarlar.map((a) => [a, String(formData.get(a) ?? "").trim()]),
  );

  // Gruplu kurulum: ödeme bilgileri ve aidat kuralları aktif gruba yazılır
  const { error: rpcHatasi } = await supabase.rpc("spor_ayar_kaydet", { p_ayarlar: degerler });
  if (rpcHatasi) {
    if (!gocYok(rpcHatasi)) throw new Error(rpcHatasi.message);
    const satirlar = anahtarlar.map((a) => ({
      anahtar: a,
      deger: degerler[a],
      guncellendi: new Date().toISOString(),
    }));
    const { error } = await supabase.from("spor_ayarlar").upsert(satirlar, { onConflict: "anahtar" });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/yonetim/ayarlar");
  revalidatePath("/panel/odeme-bildir");
  bildir("/yonetim/ayarlar", "Ayarlar kaydedildi");
}

export async function rolAta(formData: FormData) {
  const supabase = await createClient();
  const rol = String(formData.get("rol"));
  const id = String(formData.get("id"));
  const { error: rpcHatasi } = await supabase.rpc("spor_yetki_ver", { p_kullanici: id, p_rol: rol });
  if (rpcHatasi) {
    if (!gocYok(rpcHatasi)) uyar("/yonetim/ayarlar", rpcHatasi.message);
    const { error } = await supabase.from("spor_profiller").update({ rol }).eq("id", id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/yonetim/ayarlar");
  revalidatePath("/yonetim/gruplar");
  bildir(String(formData.get("donus") || "/yonetim/ayarlar"), `Pozisyon güncellendi: ${ROL_ADI[rol] ?? rol}`);
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
    hataIsle(error, `/yonetim/maclar/${id}`);
    revalidatePath(`/yonetim/maclar/${id}`);
    bildir(`/yonetim/maclar/${id}`, "Maç bilgileri kaydedildi");
  }

  const { data, error } = await supabase.from("spor_maclar").insert(kayit).select("id").single();
  hataIsle(error, "/yonetim/maclar");
  if (!data) throw new Error("Maç kaydedilemedi.");
  revalidatePath("/yonetim/maclar");
  bildir(`/yonetim/maclar/${data.id}`, "Maç eklendi — şimdi kadroyu girebilirsiniz");
}

export async function macSil(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_maclar")
    .delete()
    .eq("id", String(formData.get("id")));
  hataIsle(error, `/yonetim/maclar/${String(formData.get("id"))}`);
  revalidatePath("/yonetim/maclar");
  bildir("/yonetim/maclar", "Maç silindi");
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
    hataIsle(error, `/yonetim/maclar/${macId}`);
  }
  if (silinecek.length) {
    const { error } = await supabase
      .from("spor_mac_katilim")
      .delete()
      .eq("mac_id", macId)
      .in("sporcu_id", silinecek);
    hataIsle(error, `/yonetim/maclar/${macId}`);
  }

  revalidatePath(`/yonetim/maclar/${macId}`);
  revalidatePath("/yonetim/maclar");
  bildir(`/yonetim/maclar/${macId}`, `${eklenecek.length} oyuncunun süresi kaydedildi`);
}

export async function belgeSil(formData: FormData) {
  const supabase = await createClient();
  const sporcuId = String(formData.get("sporcu_id"));
  const yol = metin(formData.get("dosya_yolu"));

  const { error } = await supabase
    .from("spor_belgeler")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  if (yol) await supabase.storage.from("spor-belgeler").remove([yol]);

  revalidatePath(`/yonetim/sporcular/${sporcuId}`);
  bildir(`/yonetim/sporcular/${sporcuId}`, "Belge silindi");
}

export async function kasaEkle(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("spor_kasa_hareketleri").insert({
    tarih: String(formData.get("tarih")),
    tur: String(formData.get("tur") ?? "aktarim"),
    tutar: sayi(formData.get("tutar")),
    kategori: metin(formData.get("kategori")),
    aciklama: metin(formData.get("aciklama")),
    ekleyen_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/yonetim/kasa");
  revalidatePath("/panel/kasa");
  bildir("/yonetim/kasa", "Kasa hareketi eklendi");
}

export async function kasaAcilisKaydet(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("spor_kasa_acilis_kaydet", {
    p_tutar: sayi(formData.get("tutar")),
    p_tarih: String(formData.get("tarih") ?? ""),
  });
  if (error) {
    if (gocYok(error)) uyar("/yonetim/kasa", "Açılış bakiyesi için veritabanı güncellemesi bekleniyor (20261107).");
    uyar("/yonetim/kasa", error.message);
  }
  revalidatePath("/yonetim/kasa");
  revalidatePath("/panel/kasa");
  revalidatePath("/yonetim");
  bildir("/yonetim/kasa", "Açılış bakiyesi kaydedildi");
}

export async function kasaSil(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("spor_kasa_hareketleri")
    .delete()
    .eq("id", String(formData.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/yonetim/kasa");
  revalidatePath("/panel/kasa");
  bildir("/yonetim/kasa", "Kasa hareketi silindi");
}

export async function rolTalebiKarar(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const kullaniciId = String(formData.get("kullanici_id"));
  const talepRol = String(formData.get("talep_rol"));
  const onay = String(formData.get("karar")) === "onayla";

  const { error: rpcHatasi } = await supabase.rpc("spor_rol_talebi_karar", { p_talep: id, p_onay: onay });
  if (rpcHatasi) {
    if (!gocYok(rpcHatasi)) uyar("/yonetim/ayarlar", rpcHatasi.message);
    // Göç öncesi eski akış
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("spor_rol_talepleri")
      .update({
        durum: onay ? "onaylandi" : "reddedildi",
        karar_veren: user?.id ?? null,
        karar_tarihi: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (onay) {
      const { error: rolHatasi } = await supabase
        .from("spor_profiller")
        .update({ rol: talepRol })
        .eq("id", kullaniciId);
      if (rolHatasi) throw new Error(rolHatasi.message);
    }
  }

  revalidatePath("/yonetim/ayarlar");
  bildir(
    "/yonetim/ayarlar",
    onay ? `${ROL_ADI[talepRol] ?? talepRol} yetkisi verildi` : "Talep reddedildi",
  );
}

export async function denemeDersiPlanla(formData: FormData) {
  const supabase = await createClient();
  const tarih = String(formData.get("tarih") ?? "");
  const saat = String(formData.get("saat") ?? "") || "17:00";
  if (!tarih) uyar("/yonetim/on-kayit", "Deneme dersinin tarihini seçin.");
  const { error } = await supabase.rpc("spor_deneme_dersi_planla", {
    p_sporcu: String(formData.get("id")),
    // Türkiye saati (UTC+3, yaz saati yok)
    p_zaman: `${tarih}T${saat}:00+03:00`,
    p_yer: metin(formData.get("yer")),
    p_not: metin(formData.get("not")),
  });
  if (error) uyar("/yonetim/on-kayit", error.message);
  revalidatePath("/yonetim/on-kayit");
  bildir("/yonetim/on-kayit", "Deneme dersi planlandı, veliye bildirildi");
}

export async function adayKapat(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("spor_aday_kapat", {
    p_sporcu: String(formData.get("id")),
    p_neden: String(formData.get("neden") ?? ""),
  });
  if (error) uyar("/yonetim/on-kayit", error.message);
  revalidatePath("/yonetim/on-kayit");
  revalidatePath("/yonetim/sporcular");
  bildir("/yonetim/on-kayit", "Başvuru kapatıldı");
}


/** Excel / CSV'den toplu sporcu aktarımı. Dönen metin ekranda gösterilir. */
export async function sporcularIceAktar(veri: string, durum: string): Promise<string> {
  const supabase = await createClient();
  let liste: Record<string, unknown>[];
  try {
    liste = JSON.parse(veri);
    if (!Array.isArray(liste)) throw new Error();
  } catch {
    return "Liste okunamadı.";
  }
  if (liste.length === 0) return "Aktarılacak kayıt yok.";
  if (liste.length > 1000) return "Tek seferde en fazla 1000 sporcu aktarılabilir.";

  const kirp = (v: unknown, n: number) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, n) : null;
  };
  const temiz = liste
    .map((k) => ({
      ad: kirp(k.ad, 60),
      soyad: kirp(k.soyad, 60),
      dogum_tarihi: /^\d{4}-\d{2}-\d{2}$/.test(String(k.dogum_tarihi ?? "")) ? String(k.dogum_tarihi) : null,
      yas_grubu: kirp(k.yas_grubu, 20),
      mevki: kirp(k.mevki, 40),
      forma_no: Number.isInteger(k.forma_no) && Number(k.forma_no) >= 0 && Number(k.forma_no) < 1000 ? Number(k.forma_no) : null,
      okul: kirp(k.okul, 120),
      veli_ad_soyad: kirp(k.veli_ad_soyad, 80),
      veli_telefon: kirp(k.veli_telefon, 30),
      veli_eposta: kirp(k.veli_eposta, 120)?.toLowerCase() ?? null,
      aylik_aidat: Math.max(0, Math.min(100000, Number(k.aylik_aidat) || 0)),
      notlar: kirp(k.notlar, 500),
      durum: durum === "pasif" ? "pasif" : "aktif",
    }))
    .filter((k) => k.ad && k.soyad);

  // Tekrarları atla: aynı ad + soyad + doğum tarihi
  const { data: mevcut, error: okumaHatasi } = await supabase.from("spor_sporcular").select("ad, soyad, dogum_tarihi");
  if (okumaHatasi) return `Kayıtlar okunamadı: ${okumaHatasi.message}`;
  const anahtar = (k: { ad: unknown; soyad: unknown; dogum_tarihi: unknown }) =>
    `${String(k.ad).toLocaleLowerCase("tr-TR")}|${String(k.soyad).toLocaleLowerCase("tr-TR")}|${k.dogum_tarihi ?? ""}`;
  const var_ = new Set((mevcut ?? []).map(anahtar));
  const yeni: typeof temiz = [];
  for (const k of temiz) {
    const a = anahtar(k);
    if (var_.has(a)) continue;
    var_.add(a);
    yeni.push(k);
  }
  const atlanan = temiz.length - yeni.length;

  for (let i = 0; i < yeni.length; i += 200) {
    const { error } = await supabase.from("spor_sporcular").insert(yeni.slice(i, i + 200));
    if (error) return `${i} kayıt aktarıldı, sonra hata: ${error.message}`;
  }
  revalidatePath("/yonetim/sporcular");
  revalidatePath("/yonetim");
  return `✓ ${yeni.length} sporcu aktarıldı${atlanan ? `, ${atlanan} kayıt zaten vardı (atlandı)` : ""}.`;
}

// ------------------------------------------------------------------ zimmet
function zimmetDonus(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s.startsWith("/yonetim/") && !s.startsWith("//") ? s : "/yonetim/zimmet";
}

export async function zimmetEkle(formData: FormData) {
  const supabase = await createClient();
  const donus = zimmetDonus(formData.get("donus"));
  const adet = Math.round(sayi(formData.get("adet")) || 1);
  const { error } = await supabase.from("spor_zimmetler").insert({
    sporcu_id: String(formData.get("sporcu_id")),
    esya: metin(formData.get("esya")),
    beden: metin(formData.get("beden")),
    adet: Math.min(99, Math.max(1, adet)),
    verilis: metin(formData.get("verilis")) ?? undefined,
    iade_beklenen: metin(formData.get("iade_beklenen")),
    notlar: metin(formData.get("notlar")),
  });
  if (error) {
    if (/check constraint/i.test(error.message)) uyar(donus, "Tarihleri kontrol edin: iade tarihi verilişten önce olamaz.");
    hataIsle(error, donus);
  }
  revalidatePath(donus);
  revalidatePath("/yonetim/zimmet");
  bildir(donus, "Zimmete eklendi");
}

export async function zimmetIade(formData: FormData) {
  const supabase = await createClient();
  const donus = zimmetDonus(formData.get("donus"));
  const bugun = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const { error } = await supabase
    .from("spor_zimmetler")
    .update({ iade_edildi: bugun })
    .eq("id", String(formData.get("id")))
    .is("iade_edildi", null);
  hataIsle(error, donus);
  revalidatePath(donus);
  revalidatePath("/yonetim/zimmet");
  bildir(donus, "İade alındı");
}

export async function zimmetSil(formData: FormData) {
  const supabase = await createClient();
  const donus = zimmetDonus(formData.get("donus"));
  const { error } = await supabase.from("spor_zimmetler").delete().eq("id", String(formData.get("id")));
  hataIsle(error, donus);
  revalidatePath(donus);
  revalidatePath("/yonetim/zimmet");
  bildir(donus, "Zimmet kaydı silindi");
}
