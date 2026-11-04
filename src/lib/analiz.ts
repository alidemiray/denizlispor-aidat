/**
 * Sporcu analizleri: girilen yoklama, maç ve değerlendirme verisinden anlam çıkarır.
 * Saf fonksiyonlar (veritabanına dokunmaz); sayfalar RLS ile okuduğu satırları verir.
 *
 * İlke: veli ve sporcu ekranında kıyas yalnızca sporcunun KENDİ geçmişiyledir;
 * takım içi sıralama yalnızca antrenör ekranında, gelişim amaçlı görünür.
 */
import { oynanabilirSure, type Brans } from "@/lib/brans";
import { haftaBasi } from "@/lib/antrenman";

const KATILDI = new Set(["geldi", "gec"]);

function gunEkle(tarih: string, gun: number) {
  const d = new Date(tarih + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

/* --------------------------------- dakika payı -------------------------------- */

export type MacSatiri = {
  tarih: string;
  yas_grubu: string | null;
  dakika: number;
  ilk_kadro: boolean;
};

export type DakikaPayi = {
  /** Kadroya girdiği maç */
  kadroda: number;
  /** Süre aldığı maç */
  oynadigi: number;
  ilkKadro: number;
  toplamDakika: number;
  oynanabilir: number;
  /** 0–100; süresiz branşta ya da maç yoksa null */
  yuzde: number | null;
  /** Eskiden yeniye son maçlar: o maçta oynanabilir sürenin yüzdesi */
  sonMaclar: { tarih: string; dakika: number; yuzde: number; ilkKadro: boolean }[];
  gidis: "artiyor" | "azaliyor" | "sabit" | null;
};

/** Bir maçın oynanabilir süresi: branş ayarı, ama sporcu ondan fazla oynadıysa (uzatma) o. */
function macSuresi(brans: Brans, m: MacSatiri, bugunYil?: number) {
  return Math.max(oynanabilirSure(brans, m.yas_grubu, bugunYil), m.dakika);
}

export function dakikaPayi(maclar: MacSatiri[], brans: Brans, bugunYil?: number): DakikaPayi {
  const sirali = [...maclar].sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
  const toplamDakika = sirali.reduce((t, m) => t + m.dakika, 0);
  const oynanabilir = brans.sureli ? sirali.reduce((t, m) => t + macSuresi(brans, m, bugunYil), 0) : 0;
  const sonMaclar = brans.sureli
    ? sirali.slice(-8).map((m) => {
        const s = macSuresi(brans, m, bugunYil);
        return { tarih: m.tarih, dakika: m.dakika, ilkKadro: m.ilk_kadro, yuzde: s ? Math.round((m.dakika / s) * 100) : 0 };
      })
    : [];

  let gidis: DakikaPayi["gidis"] = null;
  if (sonMaclar.length >= 4) {
    const son = sonMaclar.slice(-3);
    const once = sonMaclar.slice(-6, -3);
    const ort = (x: typeof son) => x.reduce((t, m) => t + m.yuzde, 0) / x.length;
    const fark = ort(son) - ort(once);
    gidis = fark >= 10 ? "artiyor" : fark <= -10 ? "azaliyor" : "sabit";
  }

  return {
    kadroda: sirali.length,
    oynadigi: sirali.filter((m) => m.dakika > 0).length,
    ilkKadro: sirali.filter((m) => m.ilk_kadro).length,
    toplamDakika,
    oynanabilir,
    yuzde: oynanabilir > 0 ? Math.round((toplamDakika / oynanabilir) * 100) : null,
    sonMaclar,
    gidis,
  };
}

/* ------------------------------- devam (son 4 hafta) ------------------------------- */

export function sonDevam(yoklamalar: { tarih: string; durum: string }[], bugun: string, gun = 28) {
  const bas = gunEkle(bugun, -gun);
  const pencere = yoklamalar.filter((y) => y.tarih > bas && y.tarih <= bugun);
  if (!pencere.length) return null;
  const katilan = pencere.filter((y) => KATILDI.has(y.durum)).length;
  return { yuzde: Math.round((katilan / pencere.length) * 100), katilan, toplam: pencere.length };
}

/* ------------------------------ dönemden döneme kıyas ------------------------------ */

export type AlanKiyasi = { anahtar: string; ad: string; simdi: number | null; once: number | null; fark: number | null };

export function donemKiyasi<T extends { donem: string }>(
  degerlendirmeler: T[],
  alanlar: readonly { anahtar: string; ad: string }[],
): { simdi: T; once: T | null; alanlar: AlanKiyasi[] } | null {
  const sirali = [...degerlendirmeler].sort((a, b) => (a.donem < b.donem ? -1 : 1));
  const simdi = sirali[sirali.length - 1];
  if (!simdi) return null;
  const once = sirali.length > 1 ? sirali[sirali.length - 2] : null;
  const oku = (d: T | null, k: string) => {
    const v = d ? (d as Record<string, unknown>)[k] : null;
    return typeof v === "number" ? v : null;
  };
  return {
    simdi,
    once,
    alanlar: alanlar.map((a) => {
      const s = oku(simdi, a.anahtar);
      const o = oku(once, a.anahtar);
      return { anahtar: a.anahtar, ad: a.ad, simdi: s, once: o, fark: s !== null && o !== null ? Number((s - o).toFixed(1)) : null };
    }),
  };
}

/* ---------------------------------- kişisel rekorlar ---------------------------------- */

export type Rekor = { ad: string; deger: string; tarih: string };

export function kisiselRekorlar(
  olcumler: { tarih: string; sprint_20m: number | null; dikey_sicrama_cm?: number | null; dayaniklilik_dk?: number | null }[],
  maclar: MacSatiri[],
): Rekor[] {
  const r: Rekor[] = [];
  const enIyi = <K extends "sprint_20m" | "dikey_sicrama_cm" | "dayaniklilik_dk">(alan: K, kucukIyi: boolean) =>
    olcumler
      .filter((o) => typeof o[alan] === "number")
      .sort((a, b) => (kucukIyi ? Number(a[alan]) - Number(b[alan]) : Number(b[alan]) - Number(a[alan])))[0];
  const sprint = enIyi("sprint_20m", true);
  if (sprint) r.push({ ad: "20 m sprint", deger: `${Number(sprint.sprint_20m).toFixed(2)} sn`, tarih: sprint.tarih });
  const sicrama = enIyi("dikey_sicrama_cm", false);
  if (sicrama) r.push({ ad: "Dikey sıçrama", deger: `${sicrama.dikey_sicrama_cm} cm`, tarih: sicrama.tarih });
  const dayan = enIyi("dayaniklilik_dk", false);
  if (dayan) r.push({ ad: "Dayanıklılık", deger: `${dayan.dayaniklilik_dk} dk`, tarih: dayan.tarih });
  const enUzun = [...maclar].sort((a, b) => b.dakika - a.dakika)[0];
  if (enUzun && enUzun.dakika > 0) r.push({ ad: "En uzun maç", deger: `${enUzun.dakika}′`, tarih: enUzun.tarih });
  return r;
}

/* ------------------------------- antrenör: haftalık uyarılar ------------------------------- */

export type UyariSporcu = { id: string; ad: string; soyad: string; yas_grubu: string | null };

export type UyariGirdisi = {
  sporcular: UyariSporcu[];
  /** Sezonun maçları */
  maclar: { id: string; tarih: string; yas_grubu: string | null }[];
  /** O maçların katılım satırları */
  katilimlar: { mac_id: string; sporcu_id: string; dakika: number }[];
  /** Son ~6 haftanın yoklamaları (antrenman tarihi ve süresiyle) */
  yoklamalar: { sporcu_id: string; tarih: string; durum: string; sure_dk: number | null }[];
  /** Sporcu başına en son değerlendirme dönemi (YYYY-AA-GG) */
  sonDegerlendirme: Record<string, string | undefined>;
  bugun: string;
};

export type HaftalikUyarilar = {
  azOynayanlar: (UyariSporcu & { yuzde: number; mac: number })[];
  devamsizlar: (UyariSporcu & { arka: number })[];
  yukuArtanlar: (UyariSporcu & { buHafta: number; ortalama: number })[];
  degerlendirmesiEksik: UyariSporcu[];
};

/** Antrenörün "Bu hafta dikkat" kartı. Eşikler sahada işe yarayan sade kurallar. */
export function haftalikUyarilar(g: UyariGirdisi, brans: Brans): HaftalikUyarilar {
  const bugunYil = Number(g.bugun.slice(0, 4));

  // 1) Az oynayanlar: kendi yaş grubunun sezon maçlarında oynanabilir sürenin eşik altında kalanlar.
  //    Kadroya hiç alınmadığı maç da 0 dakika sayılır: altyapıda asıl görülmesi gereken budur.
  const azOynayanlar: HaftalikUyarilar["azOynayanlar"] = [];
  if (brans.sureli && brans.azOynamaEsigi > 0) {
    const dakika = new Map<string, number>();
    for (const k of g.katilimlar) dakika.set(`${k.mac_id}:${k.sporcu_id}`, k.dakika);
    for (const s of g.sporcular) {
      const grubun = g.maclar.filter((m) => !m.yas_grubu || !s.yas_grubu || m.yas_grubu === s.yas_grubu);
      if (grubun.length < 3) continue;
      let oynadi = 0;
      let oynanabilir = 0;
      for (const m of grubun) {
        const d = dakika.get(`${m.id}:${s.id}`) ?? 0;
        oynadi += d;
        oynanabilir += Math.max(oynanabilirSure(brans, m.yas_grubu ?? s.yas_grubu, bugunYil), d);
      }
      const oran = oynanabilir ? oynadi / oynanabilir : 0;
      if (oran < brans.azOynamaEsigi) azOynayanlar.push({ ...s, yuzde: Math.round(oran * 100), mac: grubun.length });
    }
    azOynayanlar.sort((a, b) => a.yuzde - b.yuzde);
  }

  // 2) Devamsızlar: son kayıtları üst üste en az 3 "gelmedi" (izinli zinciri bozmaz, saymaz da).
  const devamsizlar: HaftalikUyarilar["devamsizlar"] = [];
  const kisiYoklama = new Map<string, { tarih: string; durum: string }[]>();
  for (const y of g.yoklamalar) {
    const l = kisiYoklama.get(y.sporcu_id) ?? [];
    l.push(y);
    kisiYoklama.set(y.sporcu_id, l);
  }
  for (const s of g.sporcular) {
    const l = (kisiYoklama.get(s.id) ?? []).sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
    let arka = 0;
    for (const y of l) {
      if (y.durum === "gelmedi") arka += 1;
      else if (y.durum === "izinli") continue;
      else break;
    }
    if (arka >= 3) devamsizlar.push({ ...s, arka });
  }
  devamsizlar.sort((a, b) => b.arka - a.arka);

  // 3) Yükü ani artanlar: bu haftaki antrenman + maç dakikası, önceki 4 haftanın ortalamasının
  //    1,5 katını geçiyorsa (ve anlamlı bir hacimse). Sakatlık riskinin en bilinen işareti.
  const yukuArtanlar: HaftalikUyarilar["yukuArtanlar"] = [];
  const buHafta = haftaBasi(g.bugun);
  const onceki = [1, 2, 3, 4].map((i) => gunEkle(buHafta, -7 * i));
  const yuk = new Map<string, Map<string, number>>();
  const ekle = (sid: string, tarih: string, dk: number) => {
    const h = haftaBasi(tarih);
    const m = yuk.get(sid) ?? new Map<string, number>();
    m.set(h, (m.get(h) ?? 0) + dk);
    yuk.set(sid, m);
  };
  for (const y of g.yoklamalar) if (KATILDI.has(y.durum)) ekle(y.sporcu_id, y.tarih, y.sure_dk ?? 0);
  const macTarihi = new Map(g.maclar.map((m) => [m.id, m.tarih]));
  for (const k of g.katilimlar) {
    const t = macTarihi.get(k.mac_id);
    if (t && k.dakika > 0) ekle(k.sporcu_id, t, k.dakika);
  }
  for (const s of g.sporcular) {
    const m = yuk.get(s.id);
    if (!m) continue;
    const simdi = m.get(buHafta) ?? 0;
    const ort = onceki.reduce((t, h) => t + (m.get(h) ?? 0), 0) / onceki.length;
    if (ort > 0 && simdi >= 120 && simdi >= ort * 1.5) {
      yukuArtanlar.push({ ...s, buHafta: simdi, ortalama: Math.round(ort) });
    }
  }
  yukuArtanlar.sort((a, b) => b.buHafta / b.ortalama - a.buHafta / a.ortalama);

  // 4) Son 3 ayda değerlendirmesi yapılmamış sporcular.
  const sinir = gunEkle(g.bugun, -92);
  const degerlendirmesiEksik = g.sporcular.filter((s) => {
    const d = g.sonDegerlendirme[s.id];
    return !d || d < sinir;
  });

  return { azOynayanlar, devamsizlar, yukuArtanlar, degerlendirmesiEksik };
}
