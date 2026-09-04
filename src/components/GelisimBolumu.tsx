import { CizgiGrafik, HalkaGrafik, SutunGrafik, YatayBarGrafik } from "@/components/ui/Grafik";
import { DEGERLENDIRME_ALANLARI, YOKLAMA_DURUMU, haftaBasi } from "@/lib/antrenman";
import { donemAdi } from "@/lib/format";
import type { Degerlendirme, Olcum } from "@/lib/types";

export type YoklamaSatiri = { tarih: string; durum: string };

export default function GelisimBolumu({
  yoklamalar,
  degerlendirmeler,
  olcumler,
  macDakikalari,
}: {
  yoklamalar: YoklamaSatiri[];
  degerlendirmeler: Degerlendirme[];
  olcumler: Olcum[];
  macDakikalari?: { etiket: string; deger: number }[];
}) {
  const katilan = yoklamalar.filter((y) => y.durum === "geldi" || y.durum === "gec").length;
  const devamYuzde = yoklamalar.length ? (katilan / yoklamalar.length) * 100 : 0;

  const sayimlar = (["geldi", "gec", "izinli", "gelmedi"] as const).map((d) => ({
    d,
    adet: yoklamalar.filter((y) => y.durum === d).length,
  }));

  const haftalik = new Map<string, { toplam: number; geldi: number }>();
  for (const y of yoklamalar) {
    const h = haftaBasi(y.tarih);
    const mevcut = haftalik.get(h) ?? { toplam: 0, geldi: 0 };
    mevcut.toplam += 1;
    if (y.durum === "geldi" || y.durum === "gec") mevcut.geldi += 1;
    haftalik.set(h, mevcut);
  }
  const haftaSeri = Array.from(haftalik)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-8)
    .map(([h, v]) => ({
      etiket: new Date(h + "T00:00:00")
        .toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
        .replace(".", ""),
      deger: Math.round((v.geldi / v.toplam) * 100),
      ipucu: `${h} haftası: ${v.geldi}/${v.toplam} katılım`,
    }));

  const siraliDeg = [...degerlendirmeler].sort((a, b) => (a.donem < b.donem ? -1 : 1));
  const sonDeg = siraliDeg[siraliDeg.length - 1];
  const ortalamaSeri = siraliDeg
    .map((d) => {
      const puanlar = DEGERLENDIRME_ALANLARI.map(
        (a) => d[a.anahtar as keyof Degerlendirme] as number | null,
      ).filter((p): p is number => typeof p === "number");
      if (!puanlar.length) return null;
      return {
        etiket: donemAdi(d.donem).split(" ")[0].slice(0, 3),
        deger: Number((puanlar.reduce((t, p) => t + p, 0) / puanlar.length).toFixed(1)),
      };
    })
    .filter(Boolean) as { etiket: string; deger: number }[];

  const siraliOlcum = [...olcumler].sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
  const seri = (alan: keyof Olcum) =>
    siraliOlcum
      .filter((o) => o[alan] !== null && o[alan] !== undefined)
      .map((o) => ({
        etiket: new Date(o.tarih + "T00:00:00")
          .toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
          .replace(".", ""),
        deger: Number(o[alan]),
      }));

  const boy = seri("boy_cm");
  const kilo = seri("kilo_kg");
  const sprint = seri("sprint_20m");

  const hicVeri =
    yoklamalar.length === 0 &&
    degerlendirmeler.length === 0 &&
    olcumler.length === 0 &&
    !(macDakikalari && macDakikalari.length);

  if (hicVeri) {
    return (
      <div className="kart px-5 py-8 text-center">
        <p className="font-semibold text-neutral-800">Gelişim verisi henüz yok</p>
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
          Antrenörler yoklama, değerlendirme ve ölçüm girdikçe grafikler burada oluşacak.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {yoklamalar.length > 0 ? (
        <div className="kart px-4 py-5">
          <p className="text-sm font-bold text-neutral-900">Antrenman devamı</p>
          <div className="mt-3 flex items-center gap-5">
            <HalkaGrafik
              yuzde={devamYuzde}
              altYazi={`${katilan}/${yoklamalar.length} antrenman`}
              boyut={104}
            />
            <div className="flex-1 space-y-1.5">
              {sayimlar.map(({ d, adet }) => (
                <div key={d} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${YOKLAMA_DURUMU[d].nokta}`} />
                  <span className="flex-1 text-xs text-neutral-600">{YOKLAMA_DURUMU[d].ad}</span>
                  <span className="text-xs font-bold text-neutral-900">{adet}</span>
                </div>
              ))}
            </div>
          </div>

          {haftaSeri.length > 1 ? (
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-neutral-600">
                Haftalık devam oranı (%)
              </p>
              <SutunGrafik veri={haftaSeri} birim="%" yukseklik={130} />
            </div>
          ) : null}
        </div>
      ) : null}

      {sonDeg ? (
        <div className="kart px-4 py-5">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold text-neutral-900">Antrenör değerlendirmesi</p>
            <p className="text-xs text-neutral-500">{donemAdi(sonDeg.donem)}</p>
          </div>
          <div className="mt-3.5">
            <YatayBarGrafik
              veri={DEGERLENDIRME_ALANLARI.map((a) => ({
                etiket: a.ad,
                deger: sonDeg[a.anahtar as keyof Degerlendirme] as number | null,
              }))}
            />
          </div>
          {sonDeg.yorum ? (
            <p className="mt-4 rounded-xl bg-neutral-50 px-3.5 py-3 text-sm leading-relaxed text-neutral-700">
              {sonDeg.yorum}
            </p>
          ) : null}
          {ortalamaSeri.length > 1 ? (
            <div className="mt-5 border-t border-neutral-100 pt-4">
              <p className="mb-1 text-xs font-semibold text-neutral-600">
                Dönemlere göre ortalama puan (10 üzerinden)
              </p>
              <CizgiGrafik veri={ortalamaSeri} enAz={0} enCok={10} yukseklik={150} />
            </div>
          ) : null}
        </div>
      ) : null}

      {macDakikalari && macDakikalari.length > 0 ? (
        <div className="kart px-4 py-5">
          <p className="text-sm font-bold text-neutral-900">Maçlarda oynadığı süre</p>
          <p className="mb-3 text-xs text-neutral-500">Son {macDakikalari.length} maç, dakika</p>
          <SutunGrafik veri={macDakikalari} birim="′" yukseklik={140} />
        </div>
      ) : null}

      {boy.length > 1 || kilo.length > 1 || sprint.length > 1 ? (
        <div className="kart space-y-5 px-4 py-5">
          <p className="text-sm font-bold text-neutral-900">Fiziksel gelişim</p>
          {boy.length > 1 ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-neutral-600">Boy (cm)</p>
              <CizgiGrafik veri={boy} birim=" cm" yukseklik={140} />
            </div>
          ) : null}
          {kilo.length > 1 ? (
            <div className="border-t border-neutral-100 pt-4">
              <p className="mb-1 text-xs font-semibold text-neutral-600">Kilo (kg)</p>
              <CizgiGrafik veri={kilo} birim=" kg" yukseklik={140} />
            </div>
          ) : null}
          {sprint.length > 1 ? (
            <div className="border-t border-neutral-100 pt-4">
              <p className="mb-1 text-xs font-semibold text-neutral-600">
                20 m sprint (sn — düştükçe iyi)
              </p>
              <CizgiGrafik veri={sprint} birim=" sn" yukseklik={140} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
