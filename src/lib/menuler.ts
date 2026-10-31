import type { IkonAdi } from "@/components/ui/Ikon";

/**
 * Rol menüleri tek yerde. Telefonda alt sekme çubuğu (en fazla 5 öğe),
 * geniş ekranda (≥1024 px) sol kenar menüsü kullanılır. Kenar menüsünde yer
 * olduğu için "Daha" altındaki bölümler doğrudan listelenir.
 */
export type MenuOgesi = { yol: string; ad: string; ikon: IkonAdi; rozet?: number };
export type MenuGrubu = { baslik?: string; ogeler: MenuOgesi[] };
export type Menu = { alt: MenuOgesi[]; yan: MenuGrubu[] };

export const VELI_MENUSU: Menu = {
  alt: [
    { yol: "/panel", ad: "Bugün", ikon: "ev" },
    { yol: "/panel/antrenman", ad: "Antrenman", ikon: "takvim" },
    { yol: "/panel/maclar", ad: "Maçlar", ikon: "futbol" },
    { yol: "/panel/arsiv", ad: "Arşiv", ikon: "arsiv" },
    { yol: "/panel/hesap", ad: "Hesabım", ikon: "kisiler" },
  ],
  yan: [
    {
      ogeler: [
        { yol: "/panel", ad: "Bugün", ikon: "ev" },
        { yol: "/panel/antrenman", ad: "Antrenmanlar", ikon: "takvim" },
        { yol: "/panel/maclar", ad: "Maçlar", ikon: "futbol" },
        { yol: "/panel/bildirimler", ad: "Bildirimler", ikon: "zil" },
        { yol: "/panel/duyurular", ad: "Duyurular", ikon: "megafon" },
        { yol: "/panel/arsiv", ad: "Altyapı arşivi", ikon: "arsiv" },
      ],
    },
    {
      baslik: "Hesap",
      ogeler: [
        { yol: "/panel/aidat", ad: "Aidat", ikon: "cuzdan" },
        { yol: "/panel/kasa", ad: "Şeffaf kasa", ikon: "pano" },
        { yol: "/panel/hesap", ad: "Hesabım", ikon: "kisiler" },
      ],
    },
  ],
};

/** Sporcu hesabı para ekranlarını görmez. */
export const SPORCU_MENUSU: Menu = {
  alt: VELI_MENUSU.alt,
  yan: [
    VELI_MENUSU.yan[0],
    { baslik: "Hesap", ogeler: [{ yol: "/panel/hesap", ad: "Hesabım", ikon: "kisiler" }] },
  ],
};

export const ANTRENOR_MENUSU: Menu = {
  alt: [
    { yol: "/antrenor", ad: "Bugün", ikon: "ev" },
    { yol: "/antrenor/antrenmanlar", ad: "Antrenman", ikon: "takvim" },
    { yol: "/antrenor/sporcular", ad: "Sporcular", ikon: "kisiler" },
    { yol: "/panel", ad: "Veli panelim", ikon: "daha" },
  ],
  yan: [
    {
      ogeler: [
        { yol: "/antrenor", ad: "Bugün", ikon: "ev" },
        { yol: "/antrenor/bildirimler", ad: "Bildirimler", ikon: "zil" },
        { yol: "/antrenor/antrenmanlar", ad: "Antrenman günlüğü", ikon: "takvim" },
        { yol: "/antrenor/sporcular", ad: "Sporcular ve gelişim", ikon: "grafik" },
        { yol: "/antrenor/duyurular", ad: "Duyurular", ikon: "megafon" },
        { yol: "/panel/arsiv", ad: "Altyapı arşivi", ikon: "arsiv" },
      ],
    },
    { baslik: "Kişisel", ogeler: [{ yol: "/panel", ad: "Veli panelim", ikon: "kisiler" }] },
  ],
};

export const YONETIM_MENUSU: Menu = {
  alt: [
    { yol: "/yonetim", ad: "Özet", ikon: "ev" },
    { yol: "/yonetim/sporcular", ad: "Sporcular", ikon: "kisiler" },
    { yol: "/yonetim/aidatlar", ad: "Aidatlar", ikon: "cuzdan" },
    { yol: "/yonetim/odemeler", ad: "Ödemeler", ikon: "grafik" },
    { yol: "/yonetim/daha", ad: "Daha", ikon: "daha" },
  ],
  yan: [
    {
      ogeler: [
        { yol: "/yonetim", ad: "Özet", ikon: "ev" },
        { yol: "/yonetim/bildirimler", ad: "Bildirimler", ikon: "zil" },
        { yol: "/yonetim/sporcular", ad: "Sporcular", ikon: "kisiler" },
        { yol: "/yonetim/on-kayit", ad: "Ön kayıt ve adaylar", ikon: "artı" },
        { yol: "/yonetim/zimmet", ad: "Zimmet", ikon: "kalkan" },
      ],
    },
    {
      baslik: "Para",
      ogeler: [
        { yol: "/yonetim/aidatlar", ad: "Aidatlar", ikon: "cuzdan" },
        { yol: "/yonetim/odemeler", ad: "Ödemeler", ikon: "kontrol" },
        { yol: "/yonetim/kasa", ad: "Kasa", ikon: "pano" },
      ],
    },
    {
      baslik: "Saha",
      ogeler: [
        { yol: "/antrenor/antrenmanlar", ad: "Antrenman günlüğü", ikon: "takvim" },
        { yol: "/yonetim/maclar", ad: "Maçlar", ikon: "futbol" },
        { yol: "/antrenor/sporcular", ad: "Gelişim takibi", ikon: "grafik" },
        { yol: "/antrenor/duyurular", ad: "Duyurular", ikon: "megafon" },
      ],
    },
    {
      baslik: "Arşiv",
      ogeler: [
        { yol: "/yonetim/sezonlar", ad: "Sezonlar ve arşiv", ikon: "kalkan" },
        { yol: "/yonetim/arsiv", ad: "Kayıt geçmişi", ikon: "arsiv" },
      ],
    },
    {
      baslik: "Kulüp",
      ogeler: [
        { yol: "/yonetim/gruplar", ad: "Gruplar", ikon: "kisiler" },
        { yol: "/yonetim/ayarlar", ad: "Ayarlar ve yetkiler", ikon: "ayar" },
        { yol: "/yonetim/disa-aktar", ad: "Dışa aktar", ikon: "indir" },
        { yol: "/panel", ad: "Veli panelim", ikon: "kisiler" },
      ],
    },
  ],
};

/** Verilen yol için en uzun eşleşen menü öğesi (ör. /panel/sporcu/x → /panel). */
export function aktifYol(yol: string, yollar: string[]) {
  let enIyi: string | null = null;
  for (const y of yollar) {
    if ((yol === y || yol.startsWith(`${y}/`)) && (!enIyi || y.length > enIyi.length)) enIyi = y;
  }
  return enIyi;
}

/** Kenar menüsündeki Bildirimler öğesine okunmamış sayısını ekler. */
export function rozetEkle(menu: Menu, okunmamis: number): Menu {
  if (!okunmamis) return menu;
  return {
    ...menu,
    yan: menu.yan.map((g) => ({
      ...g,
      ogeler: g.ogeler.map((o) => (o.yol.endsWith("/bildirimler") ? { ...o, rozet: okunmamis } : o)),
    })),
  };
}

/** Yalnızca admin ve kulüp başkanının gördüğü menü öğeleri */
export const KULUP_GENELI_YOLLARI = ["/yonetim/gruplar"];

export function menuSuz(menu: Menu, cikar: string[]): Menu {
  if (!cikar.length) return menu;
  return {
    alt: menu.alt.filter((o) => !cikar.includes(o.yol)),
    yan: menu.yan.map((g) => ({ ...g, ogeler: g.ogeler.filter((o) => !cikar.includes(o.yol)) })),
  };
}
