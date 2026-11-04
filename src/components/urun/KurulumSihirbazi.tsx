"use client";

import { useMemo, useState } from "react";
import { BRANSLAR } from "@/lib/brans";
import { kontrast, markaPaleti, notrPalet } from "@/kulup";

/**
 * Kulüp kurulum sihirbazı: adı ve iki rengi girince telefon önizlemesi anında o kulübe
 * bürünür; sonunda kulüp yapılandırması (kulup.json) hazır çıkar.
 * Önizleme yalnızca kendi kapsayıcısının CSS değişkenlerini değiştirir.
 */

const HAZIR: { ad: string; ana: string; koyu: string }[] = [
  { ad: "Yeşil", ana: "#00A650", koyu: "#231F20" },
  { ad: "Kırmızı", ana: "#D4202C", koyu: "#1E1A1B" },
  { ad: "Lacivert", ana: "#2F6BD8", koyu: "#121827" },
  { ad: "Sarı", ana: "#F2C200", koyu: "#16161A" },
  { ad: "Bordo", ana: "#8E1B3B", koyu: "#1B1517" },
];

function rgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function kod(ad: string) {
  return (
    ad
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "kulup"
  );
}

const gecerliHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

export default function KurulumSihirbazi() {
  const [ad, setAd] = useState("Pamukkale Gençlik");
  const [sehir, setSehir] = useState("Denizli");
  const [kurulus, setKurulus] = useState("1998");
  const [ana, setAna] = useState("#D4202C");
  const [koyu, setKoyu] = useState("#1E1A1B");
  const [brans, setBrans] = useState("futbol");
  const [kopyalandi, setKopyalandi] = useState(false);

  const anaG = gecerliHex(ana) ? ana : "#00A650";
  const koyuG = gecerliHex(koyu) ? koyu : "#231F20";
  const kisaAd = ad.trim() || "Kulübünüz";

  const { stil, metinRengi, oran } = useMemo(() => {
    const beyazOran = kontrast(anaG, "#FFFFFF");
    const koyuOran = kontrast(anaG, koyuG);
    const metin = koyuOran >= beyazOran ? koyuG : "#FFFFFF";
    const m = markaPaleti(anaG, koyuG);
    const n = notrPalet(koyuG);
    const s: Record<string, string> = {
      "--koyu": rgb(koyuG),
      "--yuzey": rgb(n["50"]),
      "--ana-metin": rgb(metin),
      "--marka": anaG,
    };
    for (const [t, v] of Object.entries(m)) s[`--marka-${t}`] = rgb(v);
    for (const [t, v] of Object.entries(n)) s[`--notr-${t}`] = rgb(v);
    return { stil: s as React.CSSProperties, metinRengi: metin, oran: Math.max(beyazOran, koyuOran) };
  }, [anaG, koyuG]);

  const json = JSON.stringify(
    {
      kod: kod(kisaAd),
      ad: `${kisaAd} Altyapı`,
      kisaAd,
      resmiAd: `${kisaAd} Spor Kulübü Derneği`,
      sehir,
      kurulus: Number(kurulus) || null,
      etiket: "Altyapı · Sporcu Takip",
      brans,
      arma: `/kulupler/${kod(kisaAd)}/arma.svg`,
      renkler: { ana: anaG, koyu: koyuG, acik: "#FFFFFF", anaUzerindeMetin: metinRengi },
      yayin: { adres: `https://${kod(kisaAd)}-altyapi.vercel.app` },
      supabase: { proje: "[kurulumda-acilacak]", yayinAnahtari: "" },
    },
    null,
    2,
  );

  const harf = kisaAd.charAt(0).toLocaleUpperCase("tr-TR");

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
      {/* Ayarlar */}
      <form className="order-2 min-w-0 space-y-5 lg:order-1" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className="etiket" htmlFor="s-ad">Kulübün kısa adı</label>
          <input id="s-ad" className="alan" value={ad} maxLength={28} onChange={(e) => setAd(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="s-sehir">Şehir</label>
            <input id="s-sehir" className="alan" value={sehir} onChange={(e) => setSehir(e.target.value)} />
          </div>
          <div>
            <label className="etiket" htmlFor="s-yil">Kuruluş yılı</label>
            <input id="s-yil" className="alan" inputMode="numeric" maxLength={4} value={kurulus}
              onChange={(e) => setKurulus(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <div>
          <label className="etiket" htmlFor="s-brans">Branş</label>
          <select id="s-brans" className="alan" value={brans} onChange={(e) => setBrans(e.target.value)}>
            {Object.values(BRANSLAR).map((b) => (
              <option key={b.kod} value={b.kod}>{b.ad}</option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="etiket">Renkler</legend>
          <div className="flex flex-wrap gap-2">
            {HAZIR.map((h) => {
              const secili = h.ana === ana && h.koyu === koyu;
              return (
                <button
                  key={h.ad}
                  type="button"
                  onClick={() => { setAna(h.ana); setKoyu(h.koyu); }}
                  aria-pressed={secili}
                  className={`flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm ring-1 transition ${
                    secili ? "bg-white/10 ring-white/40" : "ring-white/10 hover:ring-white/25"
                  }`}
                >
                  <span className="flex h-6 w-6 overflow-hidden rounded-full ring-1 ring-white/20">
                    <span className="w-1/2" style={{ background: h.ana }} />
                    <span className="w-1/2" style={{ background: h.koyu }} />
                  </span>
                  {h.ad}
                </button>
              );
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { id: "s-ana", ad: "Ana renk", deger: ana, ayarla: setAna },
              { id: "s-koyu", ad: "Zemin rengi", deger: koyu, ayarla: setKoyu },
            ].map((r) => (
              <div key={r.id}>
                <label className="mb-1.5 block text-xs text-neutral-500" htmlFor={r.id}>{r.ad}</label>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-neutral-50 px-2 py-1.5">
                  <input
                    type="color"
                    aria-label={`${r.ad} seç`}
                    value={gecerliHex(r.deger) ? r.deger : "#000000"}
                    onChange={(e) => r.ayarla(e.target.value.toUpperCase())}
                    className="h-9 w-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    id={r.id}
                    value={r.deger}
                    maxLength={7}
                    onChange={(e) => r.ayarla(e.target.value.toUpperCase())}
                    className="w-full bg-transparent font-mono text-[15px] text-white outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
          <p className={`mt-3 text-sm ${oran >= 4.5 ? "text-neutral-600" : "text-amber-700"}`}>
            Ana renk üzerindeki yazı {metinRengi === "#FFFFFF" ? "beyaz" : "zemin renginde"} seçildi
            (kontrast {oran.toFixed(1)}:1
            {oran >= 4.5 ? ", okunaklı)." : ". Okunurluk zayıf: ana rengi koyulaştırın ya da açın)."}
          </p>
        </fieldset>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="etiket mb-0">Kulüp yapılandırması</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(json);
                  setKopyalandi(true);
                  setTimeout(() => setKopyalandi(false), 1800);
                } catch {
                  /* pano izni yoksa kullanıcı elle seçer */
                }
              }}
              className="text-sm font-semibold text-yesil-700"
            >
              {kopyalandi ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
          <pre className="max-h-56 overflow-auto rounded-xl bg-black/30 p-3 font-mono text-[12px] leading-relaxed text-neutral-700 ring-1 ring-white/10">
            {json}
          </pre>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Kurulumda bu dosya ve arma eklenir; ekranlar, roller ve veritabanı şeması her kulüpte aynıdır.
          </p>
        </div>
      </form>

      {/* Canlı önizleme: bir telefon */}
      <div className="order-1 lg:order-2 lg:sticky lg:top-6" style={stil}>
        <div className="mx-auto w-[300px] rounded-[44px] bg-[#0d0d0d] p-[10px] shadow-2xl shadow-black/50 ring-1 ring-white/10">
          <div className="relative h-[600px] overflow-hidden rounded-[34px] bg-zemin text-white">
            <div className="rounded-b-[24px] bg-siyah px-4 pb-4 pt-7">
              <div className="flex items-center gap-2.5">
                <svg viewBox="0 0 40 46" className="h-9 w-8 shrink-0" aria-hidden>
                  <path d="M20 1 38 7v15c0 11-7.6 19-18 23C9.6 41 2 33 2 22V7z" fill="var(--marka)" />
                  <text x="20" y="29" textAnchor="middle" fontSize="17" fontWeight="900" fill="rgb(var(--ana-metin))"
                    fontFamily="var(--font-manset)">{harf}</text>
                </svg>
                <div className="min-w-0">
                  <p className="manset truncate text-[22px]">Merhaba, Ayşe</p>
                  <p className="truncate text-[11px] text-yesil-500">{kisaAd} Altyapı</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {[["2", "Sporcu"], ["%92", "Devam"], ["3", "Bu hafta"]].map(([d, e]) => (
                  <div key={e} className="rounded-xl bg-white/[0.07] px-2 py-2 ring-1 ring-white/10">
                    <p className="font-manset text-[22px] font-extrabold leading-none">{d}</p>
                    <p className="mt-1 text-[9px] text-white/60">{e}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 px-3 pt-3">
              <div className="rounded-[18px] bg-yesil-500 px-4 py-4 text-anametin">
                <p className="text-[10px] font-semibold opacity-80">Sıradaki antrenman</p>
                <p className="manset mt-1.5 text-[38px] leading-[0.9]">Yarın 17:30</p>
                <p className="mt-1.5 text-[12px] font-medium">{sehir || "Şehir"} stadı · 90 dk · Pas oyunu</p>
              </div>
              <div className="flex items-center gap-3 rounded-[16px] bg-yuzey px-3 py-3 ring-1 ring-white/[0.06]">
                <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90" aria-hidden>
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(var(--notr-200))" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--marka)" strokeWidth="4"
                    strokeDasharray="86.7 94.2" strokeLinecap="round" />
                </svg>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">Can · U12</p>
                  <p className="text-[11px] text-neutral-500">Son 4 haftada 11/12 antrenman</p>
                </div>
              </div>
              <div className="rounded-[16px] bg-yuzey px-3 py-3 ring-1 ring-yesil-500/40">
                <p className="text-[11px] text-yesil-500">Kulüpten duyuru</p>
                <p className="mt-0.5 text-[13px] font-semibold">Sezon kartları basıldı</p>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 flex justify-around border-t border-white/10 bg-siyah/95 px-2 pb-4 pt-2.5">
              {["Bugün", "Antrenman", "Maçlar", "Arşiv"].map((m, i) => (
                <span key={m} className={`text-[10px] font-semibold ${i === 0 ? "text-yesil-500" : "text-neutral-500"}`}>{m}</span>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-neutral-500">
          {kisaAd} · {sehir || "şehir"} · {kurulus || "kuruluş"}
        </p>
      </div>
    </div>
  );
}
