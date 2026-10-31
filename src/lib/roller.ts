// Uygulamadaki roller ve rollere bağlı yetki yardımcıları.

export type Rol =
  | "veli"
  | "sporcu"
  | "antrenor"
  | "yardimci_antrenor"
  | "baskan"
  | "yonetici"
  | "admin";

export const ROL_ADI: Record<string, string> = {
  veli: "Veli",
  sporcu: "Sporcu",
  antrenor: "Antrenör",
  yardimci_antrenor: "Yardımcı antrenör",
  baskan: "Kulüp başkanı",
  yonetici: "Grup yöneticisi",
  admin: "Admin",
};

/** Hesap oluştururken seçilebilen roller. */
export const KAYIT_ROLLERI: {
  deger: Rol;
  ad: string;
  aciklama: string;
  onay: boolean;
}[] = [
  {
    deger: "veli",
    ad: "Veli",
    aciklama: "Sporcumun gelişimini, antrenmanlarını ve aidatını takip edeceğim.",
    onay: false,
  },
  {
    deger: "sporcu",
    ad: "Sporcu",
    aciklama: "Kulüpte oynuyorum; kendi gelişimimi ve antrenmanlarımı göreceğim.",
    onay: false,
  },
  {
    deger: "antrenor",
    ad: "Antrenör",
    aciklama: "Antrenman günlüğü, yoklama ve gelişim değerlendirmesi gireceğim.",
    onay: true,
  },
  {
    deger: "yardimci_antrenor",
    ad: "Yardımcı antrenör",
    aciklama: "Antrenöre yardımcı olacağım; aynı ekranları kullanacağım.",
    onay: true,
  },
  {
    deger: "baskan",
    ad: "Kulüp başkanı",
    aciklama: "Tüm yaş gruplarını yöneteceğim (admin onaylar).",
    onay: true,
  },
];

export const YONETIM_ROLLERI = ["admin", "baskan", "yonetici"];
/** Tüm gruplar arasında geçebilen roller */
export const KULUP_GENELI_ROLLERI = ["admin", "baskan"];
export const ANTRENOR_ROLLERI = ["antrenor", "yardimci_antrenor"];
export const PERSONEL_ROLLERI = [...YONETIM_ROLLERI, ...ANTRENOR_ROLLERI];

export function yoneticiMi(rol: string) {
  return YONETIM_ROLLERI.includes(rol);
}

export function antrenorMu(rol: string) {
  return ANTRENOR_ROLLERI.includes(rol);
}

export function personelMi(rol: string) {
  return PERSONEL_ROLLERI.includes(rol);
}

/** Sporcu hesapları para ile ilgili hiçbir ekranı görmez. */
export function paraGorebilirMi(rol: string) {
  return rol !== "sporcu";
}

/**
 * Kulübün parası (şeffaf kasa, aidat akışı): yalnızca yönetim ve veli.
 * Antrenör, yardımcı antrenör ve sporcu görmez (veritabanı da vermez).
 */
export function kasaGorebilirMi(rol: string) {
  return rol === "veli" || yoneticiMi(rol);
}

export function kulupGeneliMi(rol: string) {
  return KULUP_GENELI_ROLLERI.includes(rol);
}

/** Rolüne göre kişinin ana ekranı. */
export function anaEkranYolu(rol: string) {
  if (yoneticiMi(rol)) return "/yonetim";
  if (antrenorMu(rol)) return "/antrenor";
  return "/panel";
}

export function rolAdi(rol: string) {
  return ROL_ADI[rol] ?? rol;
}
