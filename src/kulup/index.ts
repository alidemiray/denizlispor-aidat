/**
 * Beyaz etiket: kulübe özgü her şey bu modülden okunur.
 *
 * Kulüp `NEXT_PUBLIC_KULUP` ortam değişkeniyle seçilir (varsayılan: denizlispor).
 * Yeni kulüp = `kulupler/<kod>.json` + `public/kulupler/<kod>/arma.*` + aşağıdaki
 * KULUPLER sözlüğüne bir satır. Kodda kulüp adı, renk, arma veya alan adı yazılmaz.
 *
 * JSON dosyaları derleme anında içe alınır (statik import): böylece kenar (edge)
 * çalışma ortamında da, tarayıcıda da aynı yapılandırma kullanılır.
 */
import denizlispor from "./kulupler/denizlispor.json";
import ornek from "./kulupler/ornek.json";
import { bransCoz, type Brans, type BransGirdisi } from "@/lib/brans";

type Ton = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
export type Palet = Record<Ton, string>;

export type KulupYapilandirmasi = {
  kod: string;
  ad: string;
  kisaAd: string;
  resmiAd: string;
  sehir: string;
  kurulus: number;
  etiket: string;
  arma: string;
  renkler: { ana: string; koyu: string; acik: string; anaUzerindeMetin: string };
  /** Verilmezse ana renkten türetilir. */
  palet?: Partial<Palet>;
  /** Verilmezse koyu renkten türetilir. */
  notr?: Partial<Palet>;
  yayin: { adres: string };
  supabase: { proje: string; yayinAnahtari: string };
  /** Branş (futbol, basketbol, voleybol…). Verilmezse futbol. Bkz. src/lib/brans.ts */
  brans?: BransGirdisi;
};

const KULUPLER: Record<string, KulupYapilandirmasi> = {
  denizlispor: denizlispor as KulupYapilandirmasi,
  ornek: ornek as KulupYapilandirmasi,
};

export const KULUP_KODLARI = Object.keys(KULUPLER);

const secili = (process.env.NEXT_PUBLIC_KULUP ?? "denizlispor").trim().toLowerCase();

export const KULUP: KulupYapilandirmasi = KULUPLER[secili] ?? KULUPLER.denizlispor;

/** Kulübün branşı: maç süreleri ve kadro terimleri. */
export const BRANS: Brans = bransCoz(KULUP.brans);

/* ----------------------------- renk yardımcıları ---------------------------- */

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const tam = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(tam, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** a'dan b'ye t oranında karışım (0 = a, 1 = b) */
export function karistir(a: string, b: string, t: number) {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return rgbHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as [number, number, number]);
}

/** WCAG göreli parlaklık */
function parlaklik(hex: string) {
  const [r, g, b] = hexRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG kontrast oranı (1–21). Kurulum sihirbazı ana renkte okunacak metni bununla seçer. */
export function kontrast(a: string, b: string) {
  const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * Koyu tema için marka ölçeği: 50–200 koyu zemine karışmış yüzey tonları,
 * 300–900 koyu zeminde okunan açık tonlar. (Ölçek bilerek koyu temaya göre.)
 */
export function markaPaleti(ana: string, koyu: string): Palet {
  const beyaz = "#FFFFFF";
  return {
    50: karistir(koyu, ana, 0.1),
    100: karistir(koyu, ana, 0.17),
    200: karistir(koyu, ana, 0.3),
    300: karistir(ana, beyaz, 0.4),
    400: karistir(ana, beyaz, 0.17),
    500: ana,
    600: karistir(ana, beyaz, 0.17),
    700: karistir(ana, beyaz, 0.2),
    800: karistir(ana, beyaz, 0.4),
    900: karistir(ana, beyaz, 0.64),
  };
}

/** Nötr ölçek bilerek TERS: 50 = en koyu yüzey, 900 = beyaz metin. */
export function notrPalet(koyu: string): Palet {
  const beyaz = "#FFFFFF";
  const oranlar: [Ton, number][] = [
    ["50", 0.045], ["100", 0.085], ["200", 0.125], ["300", 0.19], ["400", 0.45],
    ["500", 0.63], ["600", 0.78], ["700", 0.86], ["800", 0.94], ["900", 1],
  ];
  return Object.fromEntries(oranlar.map(([t, o]) => [t, karistir(koyu, beyaz, o)])) as Palet;
}

function rgbUclu(hex: string) {
  return hexRgb(hex).join(" ");
}

/** Kulübün renklerinden kök CSS değişkenleri (tailwind bu değişkenleri okur). */
export function temaDegiskenleri(k: KulupYapilandirmasi = KULUP) {
  const marka = { ...markaPaleti(k.renkler.ana, k.renkler.koyu), ...(k.palet ?? {}) };
  const notr = { ...notrPalet(k.renkler.koyu), ...(k.notr ?? {}) };
  const satirlar: string[] = [];
  for (const [t, v] of Object.entries(marka)) satirlar.push(`--marka-${t}:${rgbUclu(v)}`);
  for (const [t, v] of Object.entries(notr)) satirlar.push(`--notr-${t}:${rgbUclu(v)}`);
  satirlar.push(`--koyu:${rgbUclu(k.renkler.koyu)}`);
  satirlar.push(`--yuzey:${rgbUclu(notr["50"])}`);
  satirlar.push(`--ana-metin:${rgbUclu(k.renkler.anaUzerindeMetin)}`);
  // SVG ve satır içi stiller için düz değerler
  satirlar.push(`--marka:${k.renkler.ana}`);
  satirlar.push(`--marka-soluk:${k.renkler.ana}29`);
  satirlar.push(`--marka-yari:${k.renkler.ana}73`);
  satirlar.push(`--zemin-hex:${k.renkler.koyu}`);
  satirlar.push(`--izgara:${notr["200"]}`);
  satirlar.push(`--grafik-yazi:${notr["500"]}`);
  return `:root{${satirlar.join(";")}}`;
}

/** Büyük harfli kısa ad (Türkçe büyük harf kuralıyla: i → İ). */
export const KULUP_MANSET = KULUP.kisaAd.toLocaleUpperCase("tr-TR");
