export type Rol = "veli" | "yonetici";

export type Profil = {
  id: string;
  eposta: string | null;
  ad_soyad: string | null;
  telefon: string | null;
  rol: Rol;
};

export type Sporcu = {
  id: string;
  ad: string;
  soyad: string;
  dogum_tarihi: string | null;
  yas_grubu: string | null;
  mevki: string | null;
  forma_no: number | null;
  veli_ad_soyad: string | null;
  veli_telefon: string | null;
  veli_eposta: string | null;
  veli_id: string | null;
  aylik_aidat: number;
  durum: "aktif" | "pasif";
  kayit_tarihi: string;
  notlar: string | null;
};

export type Aidat = {
  id: string;
  sporcu_id: string;
  donem: string;
  tutar: number;
  son_odeme_tarihi: string | null;
  durum: "bekliyor" | "odendi" | "muaf";
  aciklama: string | null;
};

export type Odeme = {
  id: string;
  aidat_id: string | null;
  sporcu_id: string;
  tutar: number;
  odeme_tarihi: string;
  yontem: "havale" | "nakit" | "kart" | "diger";
  dekont_yolu: string | null;
  durum: "beklemede" | "onaylandi" | "reddedildi";
  aciklama: string | null;
  created_at: string;
};
