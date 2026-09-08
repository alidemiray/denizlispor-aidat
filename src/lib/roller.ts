// Uygulamadaki roller ve rollere bağlı yetki yardımcıları.

export type Rol =
  | "veli"
  | "sporcu"
  | "antrenor"
  | "yardimci_antrenor"
  | "baskan"
  | "yonetici";

export const ROL_ADI: Record<string, string> = {
  veli: "Veli",
  sporcu: "Sporcu",
  antrenor: "Antrenör",
  yardimci_antrenor: "Yardımcı antrenör",
  baskan: "Başkan",
  yonetici: "Kulüp yöneticisi",
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
    ad: "Başkan / yönetim",
    aciklama: "Kulüp yönetimi ekranlarının tamamını kullanacağım.",
    onay: true,
  },
];

export const YONETIM_ROLLERI = ["yonetici", "baskan"];
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

/** Rolüne göre kişinin ana ekranı. */
export function anaEkranYolu(rol: string) {
  if (yoneticiMi(rol)) return "/yonetim";
  if (antrenorMu(rol)) return "/antrenor";
  return "/panel";
}

export function rolAdi(rol: string) {
  return ROL_ADI[rol] ?? rol;
}
