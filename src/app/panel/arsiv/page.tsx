import Link from "next/link";
import { benimSporcularim } from "@/lib/veli";
import UstBaslik from "@/components/UstBaslik";
import AniEkle from "@/components/AniEkle";
import { oturum } from "@/lib/yetki";
import { personelMi, yoneticiMi } from "@/lib/roller";
import { gunAdi } from "@/lib/format";
import { MAC_TURU, macBasligi, skorMetni } from "@/lib/mac";
import { bugunkuSezon, sezonAdi, sezonYili } from "@/lib/sezon";
import { arsivFotolari, arsivGetir, ozetVarMi, SEZON_DURUM_ADI, sezonDurumu, type SezonOzeti } from "@/lib/arsiv";
import type { Mac } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Arsiv({ searchParams }: { searchParams: Promise<{ sezon?: string }> }) {
  const { supabase, user, rol } = await oturum();
  const { sezon: secim } = await searchParams;

  const [{ data: macData }, { data: antData }, { data: cocukData }, arsiv] = await Promise.all([
    supabase.from("spor_maclar").select("*").order("tarih", { ascending: false }).limit(1000),
    supabase.from("spor_antrenmanlar").select("tarih, yas_grubu").limit(5000),
    benimSporcularim(supabase, user.id, "id, ad"),
    arsivGetir(supabase),
  ]);
  const maclar = (macData ?? []) as Mac[];
  const antrenmanlar = (antData ?? []) as { tarih: string; yas_grubu: string | null }[];
  const cocuklar = (cocukData ?? []) as { id: string; ad: string }[];

  const buSezon = bugunkuSezon();
  const yillar = new Set<number>([buSezon]);
  for (const m of maclar) yillar.add(sezonYili(m.tarih));
  for (const a of antrenmanlar) yillar.add(sezonYili(a.tarih));
  for (const y of arsiv?.sezonlar.keys() ?? []) yillar.add(y);
  for (const a of arsiv?.anilar ?? []) yillar.add(a.sezon_yil);
  const sezonlar = [...yillar].sort((a, b) => b - a);

  const secili = secim && sezonlar.includes(Number(secim)) ? Number(secim) : buSezon;
  const kayit = arsiv?.sezonlar.get(secili);
  const durum = arsiv ? sezonDurumu(secili, kayit) : secili === buSezon ? "suruyor" : "muhurlu";
  const muhurluOzet: SezonOzeti | null = durum === "muhurlu" && ozetVarMi(kayit?.ozet) ? kayit!.ozet : null;

  const sezonMaclari = maclar.filter((m) => sezonYili(m.tarih) === secili);
  const sonuclu = sezonMaclari.filter((m) => m.skor_biz !== null && m.skor_rakip !== null);
  const sayilar = muhurluOzet ?? {
    mac: sezonMaclari.length,
    galibiyet: sonuclu.filter((m) => m.skor_biz! > m.skor_rakip!).length,
    beraberlik: sonuclu.filter((m) => m.skor_biz === m.skor_rakip).length,
    maglubiyet: sonuclu.filter((m) => m.skor_biz! < m.skor_rakip!).length,
    gol_atilan: sonuclu.reduce((t, m) => t + (m.skor_biz ?? 0), 0),
    antrenman: antrenmanlar.filter((a) => sezonYili(a.tarih) === secili).length,
    yas_gruplari: [
      ...new Set(
        [...sezonMaclari.map((m) => m.yas_grubu), ...antrenmanlar.filter((a) => sezonYili(a.tarih) === secili).map((a) => a.yas_grubu)].filter(
          Boolean,
        ) as string[],
      ),
    ],
  };
  const sonucluSayisi = sayilar.galibiyet + sayilar.beraberlik + sayilar.maglubiyet;

  // Vitrin: sezonun en farklı galibiyeti; yoksa en son maç
  const vitrin =
    [...sonuclu]
      .filter((m) => m.skor_biz! > m.skor_rakip!)
      .sort((a, b) => b.skor_biz! - b.skor_rakip! - (a.skor_biz! - a.skor_rakip!))[0] ?? sezonMaclari[0];

  // Kendi çocuğunun mühürlü sezon satırı (özette yalnızca kimlik ve sayılar var)
  const cocukSatirlari = muhurluOzet
    ? cocuklar
        .map((c) => ({ c, k: muhurluOzet.kadro.find((k) => k.sporcu_id === c.id) }))
        .filter((x): x is { c: (typeof cocuklar)[number]; k: NonNullable<typeof x.k> } => !!x.k)
    : [];

  const anilar = (arsiv?.anilar ?? []).filter((a) => a.sezon_yil === secili);
  const yukselenler = arsiv?.yukselenler ?? [];
  const fotolar = await arsivFotolari(supabase, [...anilar.map((a) => a.foto_yolu), ...yukselenler.map((y) => y.foto_yolu)]);

  const aciklama =
    kayit?.kapanis_notu ??
    (durum === "suruyor"
      ? "Her antrenman, maç ve gol bu rafa işleniyor. Sezon kapanınca maçlar, kadrolar ve kartlar kalıcı olarak arşivde kalır."
      : durum === "kapanis_bekliyor"
        ? "Sezon bitti; kulüp kayıtları kontrol edip sezonu mühürleyecek."
        : "Bu sezon mühürlendi. Maçlar, antrenmanlar ve sezon kartları kulüp arşivinde saklanıyor.");

  return (
    <>
      <UstBaslik baslik="Altyapı arşivi" altBaslik="Kulübün yaşayan hafızası" />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <nav aria-label="Sezonlar" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {sezonlar.map((y) => {
            const aktif = y === secili;
            return (
              <Link
                key={y}
                href={`/panel/arsiv?sezon=${y}`}
                replace
                aria-current={aktif ? "page" : undefined}
                className={`flex h-10 shrink-0 items-center rounded-full px-4 text-[13px] ${
                  aktif
                    ? "bg-yesil-500 font-extrabold text-anametin"
                    : "bg-yuzey font-semibold text-white ring-1 ring-white/10"
                }`}
              >
                {sezonAdi(y)}
              </Link>
            );
          })}
        </nav>

        <article className="mt-4 overflow-hidden rounded-[22px] bg-[#FFFFFF] text-siyah">
          <div className="relative bg-[#E6E3E3] px-5 pb-5 pt-12">
            <span className="absolute left-4 top-4 flex h-6 items-center rounded-full bg-siyah px-2.5 text-[11px] font-bold text-[#FFFFFF]">
              {SEZON_DURUM_ADI[durum]}
            </span>
            <p className="font-mono text-[11px] tracking-[0.06em] text-[#5E5859]">
              VİTRİN · {sezonAdi(secili)}
            </p>
            {vitrin ? (
              <>
                <h2 className="manset mt-1.5 text-[30px] leading-[0.92]">{macBasligi(vitrin)}</h2>
                <p className="mt-2 text-[15px] text-[#4A4546]">
                  {[skorMetni(vitrin), gunAdi(vitrin.tarih), MAC_TURU[vitrin.tur] ?? vitrin.tur, vitrin.yas_grubu]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : (
              <h2 className="manset mt-1.5 text-[30px] leading-[0.92]">
                {durum === "suruyor" ? "Sezon yazılıyor" : "Bu sezonun kaydı yok"}
              </h2>
            )}
          </div>
          <p className="whitespace-pre-line px-5 py-4 text-sm leading-relaxed text-[#4A4546]">{aciklama}</p>
        </article>

        {cocukSatirlari.length ? (
          <section className="mt-3 space-y-2">
            {cocukSatirlari.map(({ c, k }) => (
              <div key={c.id} className="kart flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{c.ad} · sezon</p>
                <p className="shrink-0 font-mono text-[12px] text-neutral-500">
                  {k.mac} maç · {k.dakika} dk · {k.gol} gol
                  {k.antrenman_sayilan ? ` · %${Math.round((100 * k.antrenman_geldi) / k.antrenman_sayilan)} devam` : ""}
                </p>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mt-3 grid grid-cols-3 gap-2.5">
          {[
            ["maç", sayilar.mac],
            ["antrenman", sayilar.antrenman],
            ["yaş grubu", sayilar.yas_gruplari.length],
          ].map(([ad, deger]) => (
            <div key={String(ad)} className="kart px-3 py-3">
              <p className="font-manset text-[28px] font-extrabold leading-none text-white">{String(deger)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{String(ad)}</p>
            </div>
          ))}
        </section>

        {sonucluSayisi > 0 ? (
          <section className="kart mt-2.5 grid grid-cols-4 px-1 py-3 text-center">
            {[
              ["G", sayilar.galibiyet],
              ["B", sayilar.beraberlik],
              ["M", sayilar.maglubiyet],
              ["gol", sayilar.gol_atilan],
            ].map(([ad, deger]) => (
              <div key={String(ad)}>
                <p className={`font-manset text-[24px] font-extrabold leading-none ${ad === "G" ? "text-yesil-500" : "text-white"}`}>
                  {String(deger)}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-neutral-500">{String(ad)}</p>
              </div>
            ))}
          </section>
        ) : null}

        {anilar.length || (arsiv && personelMi(rol)) ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">Anılar</h2>
            {anilar.length ? (
              <div className="grid grid-cols-2 gap-2.5">
                {anilar.map((a) => {
                  const foto = a.foto_yolu ? fotolar.get(a.foto_yolu) : null;
                  return (
                    <figure key={a.id} className="kart overflow-hidden">
                      {foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={foto} alt={a.baslik} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      ) : null}
                      <figcaption className="px-3 py-2.5">
                        <p className="line-clamp-2 text-sm font-semibold text-white">{a.baslik}</p>
                        {a.aciklama ? <p className="mt-0.5 line-clamp-3 text-xs text-neutral-500">{a.aciklama}</p> : null}
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-neutral-500">
                          {[a.tarih ? gunAdi(a.tarih) : null, a.yas_grubu].filter(Boolean).join(" · ")}
                        </p>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : null}
            {arsiv && personelMi(rol) ? (
              <div className="mt-2.5">
                <AniEkle yil={secili} />
              </div>
            ) : null}
          </>
        ) : null}

        {sezonMaclari.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">Sezonun maçları</h2>
            <div className="kart divide-y divide-white/[0.06]">
              {sezonMaclari.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{macBasligi(m)}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {gunAdi(m.tarih)} · {MAC_TURU[m.tur] ?? m.tur}
                      {m.yas_grubu ? ` · ${m.yas_grubu}` : ""}
                    </p>
                  </div>
                  <span className="font-manset text-xl font-extrabold text-white">{skorMetni(m) ?? "–"}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {yukselenler.length ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">Kulüpten yükselenler</h2>
            <div className="kart divide-y divide-white/[0.06]">
              {yukselenler.map((y) => {
                const foto = y.foto_yolu ? fotolar.get(y.foto_yolu) : null;
                return (
                  <div key={y.id} className="flex items-center gap-3 px-4 py-3">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-yesil-500 font-manset text-base font-extrabold text-anametin">
                        {y.ad_soyad.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{y.ad_soyad}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {y.hedef}{y.mevki ? ` · ${y.mevki}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-neutral-500">{sezonAdi(y.sezon_yil)}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {arsiv && yoneticiMi(rol) ? (
          <Link href={`/yonetim/sezonlar/${secili}`} className="btn-ikincil mt-6 w-full">
            Sezonu yönet
          </Link>
        ) : null}
      </div>
    </>
  );
}
