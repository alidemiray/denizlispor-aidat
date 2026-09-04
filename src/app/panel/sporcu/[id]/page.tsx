import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import FotoYukle from "@/components/FotoYukle";
import BelgeYukle from "@/components/BelgeYukle";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import { createClient } from "@/lib/supabase/server";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import { KART_ADI, MAC_TURU, macBasligi, skorMetni } from "@/lib/mac";
import { BELGE_ADI, type Aidat, type Belge, type Mac, type Odeme, type Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

type KatilimSatir = {
  id: string;
  dakika: number;
  ilk_onbir: boolean;
  gol: number;
  asist: number;
  kart: string;
  spor_maclar: Mac | null;
};

export default async function SporcuDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: sporcuData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sporcuData) notFound();
  const sporcu = sporcuData as Sporcu;

  const [{ data: aidatData }, { data: odemeData }, { data: katilimData }, { data: belgeData }] =
    await Promise.all([
      supabase.from("spor_aidatlar").select("*").eq("sporcu_id", id)
        .order("donem", { ascending: false }),
      supabase.from("spor_odemeler").select("*").eq("sporcu_id", id)
        .order("odeme_tarihi", { ascending: false }),
      supabase
        .from("spor_mac_katilim")
        .select("id, dakika, ilk_onbir, gol, asist, kart, spor_maclar(*)")
        .eq("sporcu_id", id),
      supabase.from("spor_belgeler").select("*").eq("sporcu_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const aidatlar = (aidatData ?? []) as Aidat[];
  const odemeler = (odemeData ?? []) as Odeme[];
  const belgeler = (belgeData ?? []) as Belge[];
  const katilimlar = ((katilimData ?? []) as unknown as KatilimSatir[])
    .filter((k) => k.spor_maclar)
    .sort((a, b) => (a.spor_maclar!.tarih < b.spor_maclar!.tarih ? 1 : -1));

  // İmzalı bağlantılar (fotoğraf + belgeler)
  const yollar = [
    ...(sporcu.foto_yolu ? [sporcu.foto_yolu] : []),
    ...belgeler.map((b) => b.dosya_yolu),
  ];
  const linkler = new Map<string, string>();
  if (yollar.length) {
    const { data: imzali } = await supabase.storage
      .from("spor-belgeler")
      .createSignedUrls(yollar, 60 * 60);
    for (const l of imzali ?? []) if (l.path && l.signedUrl) linkler.set(l.path, l.signedUrl);
  }

  const borc = aidatlar.filter((a) => a.durum === "bekliyor")
    .reduce((t, a) => t + Number(a.tutar), 0);
  const odenen = odemeler.filter((o) => o.durum === "onaylandi")
    .reduce((t, o) => t + Number(o.tutar), 0);

  const macSayisi = katilimlar.filter((k) => k.dakika > 0).length;
  const toplamDakika = katilimlar.reduce((t, k) => t + k.dakika, 0);
  const gol = katilimlar.reduce((t, k) => t + k.gol, 0);
  const asist = katilimlar.reduce((t, k) => t + k.asist, 0);
  const ilkOnbir = katilimlar.filter((k) => k.ilk_onbir).length;

  const bilgiler: [string, string][] = [
    ["Yaş grubu", sporcu.yas_grubu || "-"],
    ["Mevki", sporcu.mevki || "-"],
    ["Forma no", sporcu.forma_no ? String(sporcu.forma_no) : "-"],
    ["Kullandığı ayak", sporcu.ayak || "-"],
    ["Doğum tarihi", sporcu.dogum_tarihi ? gunAdi(sporcu.dogum_tarihi) : "-"],
    ["Okulu", sporcu.okul || "-"],
    ["Veli", sporcu.veli_ad_soyad || "-"],
    ["Veli telefonu", sporcu.veli_telefon || "-"],
    ["Acil durum", [sporcu.acil_kisi, sporcu.acil_telefon].filter(Boolean).join(" · ") || "-"],
    ["Kayıt tarihi", gunAdi(sporcu.kayit_tarihi)],
    ["Aylık aidat", sporcu.durum === "onay_bekliyor" ? "Kulüp belirleyecek" : tl(sporcu.aylik_aidat)],
  ];

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={
          [sporcu.yas_grubu, sporcu.mevki].filter(Boolean).join(" · ") || "Denizlispor Altyapı"
        }
        geri="/panel"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24">
        <div className="-mt-8 flex justify-center">
          <FotoYukle
            sporcuId={sporcu.id}
            basHarfler={`${sporcu.ad[0]}${sporcu.soyad[0]}`}
            fotoUrl={sporcu.foto_yolu ? (linkler.get(sporcu.foto_yolu) ?? null) : null}
          />
        </div>

        {sporcu.durum === "onay_bekliyor" ? (
          <div className="kart mt-4 border-l-4 border-amber-400 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Kayıt onay bekliyor</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              Kulüp yönetimi kaydı inceleyip onayladığında sporcunuz aktif hale gelir.
            </p>
          </div>
        ) : null}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="kart px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Kalan borç</p>
            <p className={`mt-0.5 text-xl font-extrabold ${borc > 0 ? "text-neutral-900" : "text-emerald-700"}`}>
              {tl(borc)}
            </p>
          </div>
          <div className="kart px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Toplam ödenen</p>
            <p className="mt-0.5 text-xl font-extrabold text-neutral-900">{tl(odenen)}</p>
          </div>
        </section>

        {sporcu.durum !== "onay_bekliyor" ? (
          <Link href="/panel/odeme-bildir" className="btn-birincil mt-3 w-full">
            Bu sporcu için ödeme bildir
          </Link>
        ) : null}

        {katilimlar.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
              Sezon istatistikleri
            </h2>
            <div className="kart grid grid-cols-4 divide-x divide-neutral-100">
              {[
                ["Maç", String(macSayisi)],
                ["Dakika", String(toplamDakika)],
                ["Gol", String(gol)],
                ["Asist", String(asist)],
              ].map(([k, v]) => (
                <div key={k} className="px-2 py-4 text-center">
                  <p className="text-xl font-extrabold text-neutral-900">{v}</p>
                  <p className="text-[11px] text-neutral-500">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-1.5 px-1 text-xs text-neutral-500">
              {ilkOnbir} maça ilk on birde başladı · maç başına ortalama{" "}
              {macSayisi ? Math.round(toplamDakika / macSayisi) : 0} dakika
            </p>

            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
              Maçlar ve oynadığı süre
            </h2>
            <div className="kart divide-y divide-neutral-100">
              {katilimlar.map((k) => {
                const m = k.spor_maclar!;
                const skor = skorMetni(m);
                return (
                  <div key={k.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-900">{macBasligi(m)}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {gunAdi(m.tarih)} · {MAC_TURU[m.tur] ?? m.tur}
                        {skor ? ` · ${skor}` : ""}
                        {k.kart !== "yok" ? ` · ${KART_ADI[k.kart]}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-neutral-900">{k.dakika}′</p>
                      <p className="text-[11px] text-neutral-400">
                        {k.ilk_onbir ? "ilk 11" : k.dakika > 0 ? "yedekten" : "oynamadı"}
                        {k.gol > 0 ? ` · ${k.gol} gol` : ""}
                        {k.asist > 0 ? ` · ${k.asist} asist` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="mb-2 mt-7 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
            Sporcu bilgileri
          </h2>
          <Link href={`/panel/sporcu/${sporcu.id}/duzenle`}
            className="text-sm font-semibold text-yesil-700">
            Düzenle
          </Link>
        </div>
        <div className="kart divide-y divide-neutral-100">
          {bilgiler.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="shrink-0 text-sm text-neutral-500">{k}</span>
              <span className="text-right text-sm font-semibold text-neutral-900">{v}</span>
            </div>
          ))}
        </div>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Belgeler
        </h2>
        <div className="kart divide-y divide-neutral-100">
          {belgeler.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-neutral-500">
              Henüz belge yüklenmemiş.
            </p>
          ) : (
            belgeler.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-neutral-900">{BELGE_ADI[b.tur]}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {b.dosya_adi ?? "dosya"} · {gunAdi(b.created_at)}
                  </p>
                </div>
                {linkler.get(b.dosya_yolu) ? (
                  <a href={linkler.get(b.dosya_yolu)} target="_blank" rel="noreferrer"
                    className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700">
                    Aç
                  </a>
                ) : null}
              </div>
            ))
          )}
          <BelgeYukle sporcuId={sporcu.id} kullaniciId={user.id} />
        </div>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Aidat dönemleri
        </h2>
        {aidatlar.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Henüz aidat tahakkuku yapılmamış.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {aidatlar.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900">{donemAdi(a.donem)}</p>
                  <p className="text-xs text-neutral-500">
                    {a.son_odeme_tarihi
                      ? `Son ödeme: ${gunAdi(a.son_odeme_tarihi)}`
                      : "Son ödeme tarihi belirtilmemiş"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-bold text-neutral-900">{tl(a.tutar)}</span>
                  <AidatRozeti durum={a.durum} sonOdeme={a.son_odeme_tarihi} />
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Ödeme geçmişi
        </h2>
        {odemeler.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Henüz ödeme kaydı yok.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {odemeler.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900">{gunAdi(o.odeme_tarihi)}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {o.yontem === "havale" ? "Havale / EFT"
                      : o.yontem === "nakit" ? "Nakit"
                      : o.yontem === "kart" ? "Kart" : "Diğer"}
                    {o.aciklama ? ` · ${o.aciklama}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-sm font-bold text-neutral-900">{tl(o.tutar)}</span>
                  <OdemeRozeti durum={o.durum} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
