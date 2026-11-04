/**
 * Branş: maçın nasıl ölçüldüğü. Kulüp yapılandırmasındaki `brans` alanından okunur;
 * verilmezse futbol varsayılır. Analiz ekranları (dakika payı, az oynayanlar, yük)
 * süreyi buradan alır, böylece aynı kod futbolda da basketbolda da doğru hesaplar.
 *
 * Kulüp JSON'unda kısa biçim:   "brans": "basketbol"
 * Ya da hazır ayarı ezerek:      "brans": { "kod": "futbol", "macSuresi": 70 }
 */

export type SureBasamagi = { enCokYas: number; dakika: number };

export type Brans = {
  kod: string;
  ad: string;
  /** Maçta oynanan süre tutuluyor mu? Bireysel sporlarda ve voleybolda hayır. */
  sureli: boolean;
  /** Yaş grubu eşleşmezse kullanılan oynanabilir süre (dakika). */
  macSuresi: number;
  /** Yaşa göre maç süresi: yaş grubu adındaki sayı (U12, U-12, "12 yaş") ilk uyan basamağa düşer. */
  yasSureleri?: SureBasamagi[];
  /** İlk kadro adı: "İlk 11", "İlk 5"… Bireysel sporlarda null. */
  ilkKadro: string | null;
  /** Bu payın altında sezonu geçiren sporcu antrenöre "az oynuyor" diye gösterilir (0–1). */
  azOynamaEsigi: number;
};

export const BRANSLAR: Record<string, Brans> = {
  futbol: {
    kod: "futbol",
    ad: "Futbol",
    sureli: true,
    macSuresi: 90,
    yasSureleri: [
      { enCokYas: 8, dakika: 40 },
      { enCokYas: 10, dakika: 50 },
      { enCokYas: 12, dakika: 60 },
      { enCokYas: 14, dakika: 70 },
      { enCokYas: 16, dakika: 80 },
    ],
    ilkKadro: "İlk 11",
    azOynamaEsigi: 0.3,
  },
  futsal: { kod: "futsal", ad: "Futsal", sureli: true, macSuresi: 40, ilkKadro: "İlk 5", azOynamaEsigi: 0.25 },
  basketbol: {
    kod: "basketbol",
    ad: "Basketbol",
    sureli: true,
    macSuresi: 40,
    yasSureleri: [{ enCokYas: 12, dakika: 32 }],
    ilkKadro: "İlk 5",
    azOynamaEsigi: 0.25,
  },
  hentbol: {
    kod: "hentbol",
    ad: "Hentbol",
    sureli: true,
    macSuresi: 60,
    yasSureleri: [{ enCokYas: 12, dakika: 40 }, { enCokYas: 14, dakika: 50 }],
    ilkKadro: "İlk 7",
    azOynamaEsigi: 0.25,
  },
  sutopu: { kod: "sutopu", ad: "Sutopu", sureli: true, macSuresi: 32, ilkKadro: "İlk 7", azOynamaEsigi: 0.25 },
  voleybol: { kod: "voleybol", ad: "Voleybol", sureli: false, macSuresi: 0, ilkKadro: "İlk 6", azOynamaEsigi: 0.3 },
  bireysel: { kod: "bireysel", ad: "Bireysel spor", sureli: false, macSuresi: 0, ilkKadro: null, azOynamaEsigi: 0 },
};

export type BransGirdisi = string | (Partial<Brans> & { kod: string }) | undefined;

export function bransCoz(girdi: BransGirdisi): Brans {
  if (!girdi) return BRANSLAR.futbol;
  if (typeof girdi === "string") return BRANSLAR[girdi] ?? BRANSLAR.futbol;
  const taban = BRANSLAR[girdi.kod] ?? BRANSLAR.futbol;
  return { ...taban, ...girdi };
}

/** "U12", "U-12", "12 Yaş Altı", "2014 doğumlular"… içinden yaşı çıkarır. Doğum yılı ise bugünden hesaplar. */
export function yasGrubuYasi(yasGrubu: string | null | undefined, bugunYil = new Date().getFullYear()) {
  if (!yasGrubu) return null;
  const sayilar = yasGrubu.match(/\d+/g);
  if (!sayilar) return null;
  const n = Number(sayilar[0]);
  if (n >= 1990 && n <= bugunYil) return bugunYil - n;
  if (n > 0 && n < 30) return n;
  return null;
}

/** O yaş grubunda bir maçın oynanabilir süresi (dakika). Süresiz branşta 0. */
export function oynanabilirSure(brans: Brans, yasGrubu: string | null | undefined, bugunYil?: number) {
  if (!brans.sureli) return 0;
  const yas = yasGrubuYasi(yasGrubu, bugunYil);
  if (yas !== null && brans.yasSureleri) {
    const basamak = [...brans.yasSureleri]
      .sort((a, b) => a.enCokYas - b.enCokYas)
      .find((b) => yas <= b.enCokYas);
    if (basamak) return basamak.dakika;
  }
  return brans.macSuresi;
}
