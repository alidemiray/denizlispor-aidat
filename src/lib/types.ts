export type Rol = "veli" | "yonetici";

export type Profil = {
  id: string;
  eposta: string | null;
  ad_soyad: string | null;
  telefon: string | null;
  rol: Rol;
};

export type SporcuDurum = "aktif" | "pasif" | "onay_bekliyor";

export type Sporcu = {
  id: string;
  ad: string;
  soyad: string;
  dogum_tarihi: string | null;
  yas_grubu: string | null;
  mevki: string | null;
  forma_no: number | null;
  okul: string | null;
  ayak: string | null;
  foto_yolu: string | null;
  acil_kisi: string | null;
  acil_telefon: string | null;
  veli_ad_soyad: string | null;
  veli_telefon: string | null;
  veli_eposta: string | null;
  veli_id: string | null;
  aylik_aidat: number;
  durum: SporcuDurum;
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

export type BelgeTuru = "lisans" | "saglik" | "kimlik" | "veli_izin" | "diger";

export type Belge = {
  id: string;
  sporcu_id: string;
  tur: BelgeTuru;
  dosya_yolu: string;
  dosya_adi: string | null;
  aciklama: string | null;
  yukleyen_id: string | null;
  created_at: string;
};

export type Mac = {
  id: string;
  tarih: string;
  saat: string | null;
  rakip: string;
  yas_grubu: string | null;
  yer: "ic" | "dis" | "notr";
  tur: "lig" | "kupa" | "hazirlik" | "turnuva";
  skor_biz: number | null;
  skor_rakip: number | null;
  aciklama: string | null;
};

export type MacKatilim = {
  id: string;
  mac_id: string;
  sporcu_id: string;
  dakika: number;
  ilk_onbir: boolean;
  gol: number;
  asist: number;
  kart: "yok" | "sari" | "cift_sari" | "kirmizi";
  notlar: string | null;
};

export const BELGE_ADI: Record<BelgeTuru, string> = {
  lisans: "Lisans",
  saglik: "Sağlık raporu",
  kimlik: "Kimlik fotokopisi",
  veli_izin: "Veli izin belgesi",
  diger: "Diğer",
};

export const MEVKILER = [
  "Kaleci",
  "Stoper",
  "Sağ bek",
  "Sol bek",
  "Ön libero",
  "Orta saha",
  "Ofansif orta saha",
  "Sağ kanat",
  "Sol kanat",
  "Forvet",
];
