import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import YazdirDugmesi from "@/components/YazdirDugmesi";
import KartPaylas from "@/components/KartPaylas";
import { oturum } from "@/lib/yetki";
import { DEGERLENDIRME_ALANLARI } from "@/lib/antrenman";
import { donemAdi } from "@/lib/format";
import type { Degerlendirme, Sporcu } from "@/lib/types";
import { BRANS, KULUP } from "@/kulup";
import { dakikaPayi, donemKiyasi } from "@/lib/analiz";
import { sezonAraligi, sezonYili } from "@/lib/sezon";

export const dynamic = "force-dynamic";

/** "2026-03-01" → "2025–26" (sezon Eylül'de başlar) */
function sezonAdi(tarih: string) {
  const d = new Date(tarih + "T00:00:00");
  const bas = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${bas}–${String(bas + 1).slice(2)}`;
}

function puan(v: number | null) {
  return typeof v === "number" ? v.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "–";
}

export default async function SezonKarti({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await oturum();

  const { data: sporcuData } = await supabase.from("spor_sporcular").select("*").eq("id", id).maybeSingle();
  if (!sporcuData) notFound();
  const sporcu = sporcuData as Sporcu;

  const { data: degData } = await supabase
    .from("spor_degerlendirmeler")
    .select("*")
    .eq("sporcu_id", id)
    .order("donem", { ascending: false })
    .limit(2);
  const degler = (degData ?? []) as Degerlendirme[];
  const deg = degler[0] ?? null;
  const kiyas = donemKiyasi(degler, DEGERLENDIRME_ALANLARI);
  const farklar = new Map((kiyas?.once ? kiyas.alanlar : []).map((a) => [a.ad, a.fark]));

  // Sezonun maç özeti (kartın sezonu: son değerlendirmenin sezonu, yoksa bugünkü)
  const kartSezonu = sezonYili(deg?.donem ?? new Date().toISOString().slice(0, 10));
  const { bas, bit } = sezonAraligi(kartSezonu);
  const { data: katData } = await supabase
    .from("spor_mac_katilim")
    .select("dakika, ilk_onbir, spor_maclar!inner(tarih, yas_grubu)")
    .eq("sporcu_id", id)
    .gte("spor_maclar.tarih", bas)
    .lte("spor_maclar.tarih", bit);
  const sezonPayi = dakikaPayi(
    ((katData ?? []) as unknown as { dakika: number; ilk_onbir: boolean; spor_maclar: { tarih: string; yas_grubu: string | null } | null }[])
      .filter((k) => k.spor_maclar)
      .map((k) => ({ tarih: k.spor_maclar!.tarih, yas_grubu: k.spor_maclar!.yas_grubu, dakika: k.dakika, ilk_kadro: k.ilk_onbir })),
    BRANS,
    kartSezonu + 1,
  );

  let foto: string | null = null;
  if (sporcu.foto_yolu) {
    const { data } = await supabase.storage.from("spor-belgeler").createSignedUrl(sporcu.foto_yolu, 60 * 60);
    foto = data?.signedUrl ?? null;
  }

  const puanlar = deg
    ? DEGERLENDIRME_ALANLARI.map((a) => ({ ad: a.ad, deger: deg[a.anahtar as keyof Degerlendirme] as number | null }))
    : [];
  const dolu = puanlar.map((p) => p.deger).filter((v): v is number => typeof v === "number");
  const ortalama = dolu.length ? dolu.reduce((t, v) => t + v, 0) / dolu.length : null;
  const sezon = deg ? sezonAdi(deg.donem) : sezonAdi(new Date().toISOString().slice(0, 10));
  const no = sporcu.id.slice(0, 4).toUpperCase();
  const satir = [sporcu.mevki, sporcu.ayak ? `${sporcu.ayak} ayak` : null, ortalama ? `ortalama ${puan(ortalama)}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="print:hidden">
        <UstBaslik baslik="Sezon kartı" altBaslik={`${sporcu.ad} ${sporcu.soyad}`} geri={`/panel/sporcu/${sporcu.id}`} />
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5 print:max-w-none print:p-0">
        <article id="sezon-karti" className="rounded-[26px] bg-yesil-500 p-[3px] print:break-inside-avoid">
          <div className="relative flex flex-col overflow-hidden rounded-[23px] bg-siyah px-6 pb-6 pt-6 text-white">
            <svg aria-hidden viewBox="0 0 560 560" className="pointer-events-none absolute left-0 top-16 w-full opacity-[0.14]">
              <rect x="40" y="40" width="480" height="480" fill="none" stroke="#FFFFFF" strokeWidth="2" />
              <line x1="40" y1="280" x2="520" y2="280" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx="280" cy="280" r="70" fill="none" stroke="#FFFFFF" strokeWidth="2" />
              <rect x="170" y="40" width="220" height="90" fill="none" stroke="#FFFFFF" strokeWidth="2" />
              <rect x="170" y="430" width="220" height="90" fill="none" stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            <div className="relative flex items-start justify-between">
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] text-yesil-500">SEZON KARTI</p>
                <p className="manset mt-1 text-xl">
                  {sezon}
                  {sporcu.yas_grubu ? ` · ${sporcu.yas_grubu}` : ""}
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={KULUP.arma} alt={`${KULUP.kisaAd} arması`} className="h-14 w-14" />
            </div>

            <div className="relative mt-5 flex items-end gap-4">
              <span className="font-manset text-[132px] font-black leading-[0.78] text-yesil-500">
                {sporcu.forma_no ?? "—"}
              </span>
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="" crossOrigin="anonymous" className="ml-auto h-44 w-36 rounded-2xl object-cover ring-1 ring-white/10" />
              ) : (
                <span className="manset ml-auto flex h-44 w-36 items-center justify-center rounded-2xl bg-yuzey text-5xl text-neutral-400 ring-1 ring-white/10">
                  {sporcu.ad[0]}
                  {sporcu.soyad[0]}
                </span>
              )}
            </div>

            <h1 className="manset relative mt-5 text-[54px] leading-[0.86]">
              {sporcu.ad} {sporcu.soyad}
            </h1>
            {satir ? <p className="relative mt-2 text-[15px] text-neutral-600">{satir}</p> : null}

            {deg ? (
              <div className="relative mt-5 grid grid-cols-5 gap-2">
                {puanlar.map((p) => (
                  <div key={p.ad} className="border-t-2 border-yesil-500 pt-2">
                    <p className="font-manset text-[28px] font-extrabold leading-none">{puan(p.deger)}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-neutral-500">{p.ad}</p>
                    {(() => {
                      const f = farklar.get(p.ad);
                      if (f === null || f === undefined || f === 0) return null;
                      return (
                        <p className={`mt-0.5 font-mono text-[10px] font-bold ${f > 0 ? "text-yesil-500" : "text-neutral-500"}`}>
                          {f > 0 ? `▲${puan(f)}` : `▼${puan(Math.abs(f))}`}
                        </p>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : (
              <p className="relative mt-5 rounded-xl bg-yuzey px-4 py-3 text-sm text-neutral-600">
                Antrenör dönem değerlendirmesini girince kartın puanları burada görünür.
              </p>
            )}

            {sezonPayi.kadroda > 0 ? (
              <div className="relative mt-5 grid grid-cols-3 gap-2 rounded-xl bg-yuzey px-3 py-3">
                {[
                  { ad: "Maç", deger: String(sezonPayi.kadroda) },
                  BRANS.sureli
                    ? { ad: "Süre payı", deger: sezonPayi.yuzde !== null ? `%${sezonPayi.yuzde}` : "–" }
                    : { ad: "Süre aldığı", deger: String(sezonPayi.oynadigi) },
                  BRANS.ilkKadro
                    ? { ad: BRANS.ilkKadro, deger: String(sezonPayi.ilkKadro) }
                    : { ad: "Dakika", deger: `${sezonPayi.toplamDakika}′` },
                ].map((k) => (
                  <div key={k.ad} className="text-center">
                    <p className="font-manset text-[22px] font-extrabold leading-none">{k.deger}</p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.06em] text-neutral-500">{k.ad}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {kiyas?.once ? (
              <p className="relative mt-2 font-mono text-[10px] text-neutral-500">
                ▲▼ {donemAdi(kiyas.once.donem)} değerlendirmesine göre
              </p>
            ) : null}

            {deg?.yorum ? (
              <p className="relative mt-5 text-[15px] leading-relaxed text-neutral-700">“{deg.yorum}”</p>
            ) : null}

            <div className="relative mt-6 flex items-end justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="h-px w-40 bg-yesil-500" />
                <span className="text-xs text-neutral-600">Antrenör imzası</span>
                <span className="font-mono text-[10px] tracking-[0.08em] text-neutral-500">
                  NO {no} · {deg ? donemAdi(deg.donem).toLocaleUpperCase("tr-TR") : "DEĞERLENDİRME BEKLENİYOR"}
                </span>
              </div>
              <span className="font-mono text-[10px] tracking-[0.08em] text-neutral-500">{KULUP.ad.toLocaleUpperCase("tr-TR")}</span>
            </div>
          </div>
        </article>

        <div className="mt-4 space-y-2.5">
          <KartPaylas hedef="sezon-karti" dosyaAdi={`sezon-karti-${sporcu.ad}-${sezon}`.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşıöç–-]+/g, "-")} />
          <YazdirDugmesi />
        </div>
      </div>
    </>
  );
}
