import Link from "next/link";
import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import Pasaport, { type YolculukAdimi } from "@/components/Pasaport";
import BelgeYukle from "@/components/BelgeYukle";
import GelisimBolumu from "@/components/GelisimBolumu";
import Ikon from "@/components/ui/Ikon";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import { oturum } from "@/lib/yetki";
import { paraGorebilirMi } from "@/lib/roller";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import { KART_ADI, MAC_TURU, macBasligi, skorMetni } from "@/lib/mac";
import { DEGERLENDIRME_ALANLARI, YOKLAMA_DURUMU } from "@/lib/antrenman";
import {
  BELGE_ADI,
  type Aidat,
  type Belge,
  type Degerlendirme,
  type Mac,
  type Odeme,
  type Olcum,
  type Sporcu,
  type SporcuNotu,
} from "@/lib/types";
import { KULUP } from "@/kulup";
import { ZIMMET_DURUMU, zimmetDurumu, zimmetSirala, type Zimmet } from "@/lib/zimmet";
import { bugunTR } from "@/lib/sezon";

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

type YoklamaKayit = {
  durum: string;
  spor_antrenmanlar: { tarih: string; baslik: string } | null;
};

export default async function SporcuDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user, rol } = await oturum();
  const paraGorunur = paraGorebilirMi(rol);

  const { data: sporcuData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sporcuData) notFound();
  const sporcu = sporcuData as Sporcu;

  const [
    { data: aidatData },
    { data: odemeData },
    { data: katilimData },
    { data: belgeData },
    { data: yoklamaData },
    { data: degData },
    { data: olcumData },
    { data: notData },
  ] = await Promise.all([
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
    supabase
      .from("spor_yoklama")
      .select("durum, spor_antrenmanlar(tarih, baslik)")
      .eq("sporcu_id", id),
    supabase.from("spor_degerlendirmeler").select("*").eq("sporcu_id", id).order("donem"),
    supabase.from("spor_olcumler").select("*").eq("sporcu_id", id).order("tarih"),
    supabase
      .from("spor_sporcu_notlari")
      .select("*")
      .eq("sporcu_id", id)
      .order("tarih", { ascending: false })
      .limit(20),
  ]);
  // Zimmet (göç 20261103 yoksa boş kalır); yalnızca iade edilmemiş eşyalar
  const { data: zimmetData } = await supabase
    .from("spor_zimmetler")
    .select("*")
    .eq("sporcu_id", id)
    .is("iade_edildi", null);
  const zimmetler = (zimmetData ?? []) as Zimmet[];
  const bugunZ = bugunTR();

  const aidatlar = (aidatData ?? []) as Aidat[];
  const odemeler = (odemeData ?? []) as Odeme[];
  const belgeler = (belgeData ?? []) as Belge[];
  const degerlendirmeler = (degData ?? []) as Degerlendirme[];
  const olcumler = (olcumData ?? []) as Olcum[];
  const notlar = (notData ?? []) as SporcuNotu[];

  const katilimlar = ((katilimData ?? []) as unknown as KatilimSatir[])
    .filter((k) => k.spor_maclar)
    .sort((a, b) => (a.spor_maclar!.tarih < b.spor_maclar!.tarih ? 1 : -1));

  const yoklamaKayitlari = ((yoklamaData ?? []) as unknown as YoklamaKayit[])
    .filter((y) => y.spor_antrenmanlar)
    .map((y) => ({
      tarih: y.spor_antrenmanlar!.tarih,
      baslik: y.spor_antrenmanlar!.baslik,
      durum: y.durum,
    }))
    .sort((a, b) => (a.tarih < b.tarih ? 1 : -1));

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

  const macSatirlari = katilimlar.map((k) => ({
    tarih: k.spor_maclar!.tarih,
    yas_grubu: k.spor_maclar!.yas_grubu,
    dakika: k.dakika,
    ilk_kadro: k.ilk_onbir,
  }));

  // Pasaport: yolculuk adımları (gerçek kayıtlardan türetilir)
  const yolculuk: YolculukAdimi[] = [];
  yolculuk.push({ tarih: sporcu.kayit_tarihi, baslik: `${KULUP.kisaAd} ailesine katıldı`, ayrinti: sporcu.yas_grubu ?? undefined });
  const katildigi = [...yoklamaKayitlari]
    .filter((y) => y.durum === "geldi" || y.durum === "gec")
    .sort((a, b) => (a.tarih < b.tarih ? -1 : 1));
  if (katildigi[0]) yolculuk.push({ tarih: katildigi[0].tarih, baslik: "İlk antrenman", ayrinti: katildigi[0].baslik });
  const oynadigi = [...katilimlar].filter((k) => k.dakika > 0).reverse();
  if (oynadigi[0]) {
    const m = oynadigi[0].spor_maclar!;
    yolculuk.push({ tarih: m.tarih, baslik: "İlk maç", ayrinti: `${macBasligi(m)} · ${oynadigi[0].dakika}′` });
  }
  const golAttigi = oynadigi.find((k) => k.gol > 0);
  if (golAttigi) {
    const m = golAttigi.spor_maclar!;
    yolculuk.push({ tarih: m.tarih, baslik: "İlk gol", ayrinti: macBasligi(m), vurgu: true });
  }
  for (const d of degerlendirmeler) {
    const puanlar = DEGERLENDIRME_ALANLARI.map((a) => d[a.anahtar as keyof typeof d] as number | null).filter(
      (v): v is number => typeof v === "number",
    );
    if (!puanlar.length) continue;
    const ort = puanlar.reduce((t, v) => t + v, 0) / puanlar.length;
    yolculuk.push({
      tarih: d.donem.length >= 10 ? d.donem : d.created_at.slice(0, 10),
      baslik: `Dönem değerlendirmesi · ${ort.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`,
      ayrinti: donemAdi(d.donem),
    });
  }
  yolculuk.sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
  const antrenmanSayisi = katildigi.length;

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
    ...(paraGorunur
      ? ([
          [
            "Aylık aidat",
            sporcu.durum === "onay_bekliyor" ? "Kulüp belirleyecek" : tl(sporcu.aylik_aidat),
          ],
        ] as [string, string][])
      : []),
  ];

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={
          [sporcu.yas_grubu, sporcu.mevki].filter(Boolean).join(" · ") || KULUP.ad
        }
        geri="/panel"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {sporcu.durum === "onay_bekliyor" ? (
          <div className="kart mt-4 border-l-4 border-amber-400 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">Kayıt onay bekliyor</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              Kulüp yönetimi kaydı inceleyip onayladığında sporcunuz aktif hale gelir.
            </p>
          </div>
        ) : null}

        <Pasaport
          sporcu={sporcu}
          fotoUrl={sporcu.foto_yolu ? (linkler.get(sporcu.foto_yolu) ?? null) : null}
          sayilar={{ antrenman: antrenmanSayisi, mac: macSayisi, dakika: toplamDakika, gol }}
          yolculuk={yolculuk}
        />

        {paraGorunur ? (
        <>
        <h2 className="mb-2 mt-7 px-1 bolum-basligi">Aidat</h2>
        <section className="grid grid-cols-2 gap-3">
          <div className="kart px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Kalan borç</p>
            <p
              className={`mt-0.5 text-xl font-extrabold ${
                borc > 0 ? "text-neutral-900" : "text-emerald-700"
              }`}
            >
              {tl(borc)}
            </p>
          </div>
          <div className="kart px-4 py-4">
            <p className="text-xs font-medium text-neutral-500">Toplam ödenen</p>
            <p className="mt-0.5 text-xl font-extrabold text-neutral-900">{tl(odenen)}</p>
          </div>
        </section>

        {sporcu.durum !== "onay_bekliyor" ? (
          <Link href="/panel/odeme-bildir" className="btn-ikincil mt-3 w-full">
            Bu sporcu için ödeme bildir
          </Link>
        ) : null}
        </>
        ) : null}

        {zimmetler.length ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">Kulübün eşyaları</h2>
            <ul className="kart divide-y divide-neutral-100">
              {zimmetSirala(zimmetler, bugunZ).map((z) => {
                const d = zimmetDurumu(z, bugunZ);
                return (
                  <li key={z.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">
                        {z.adet > 1 ? `${z.adet} × ` : ""}{z.esya}{z.beden ? ` · ${z.beden}` : ""}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {z.iade_beklenen ? `İade: ${gunAdi(z.iade_beklenen)}` : "Sezon boyunca sizde"}
                      </p>
                    </div>
                    <span className={`rozet shrink-0 ${ZIMMET_DURUMU[d].sinif}`}>{ZIMMET_DURUMU[d].ad}</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        <h2 className="mb-2 mt-7 px-1 bolum-basligi">
          Gelişim
        </h2>
        <GelisimBolumu
          yoklamalar={yoklamaKayitlari}
          degerlendirmeler={degerlendirmeler}
          olcumler={olcumler}
          maclar={macSatirlari}
        />

        {notlar.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">
              Antrenör notları
            </h2>
            <div className="kart divide-y divide-neutral-100">
              {notlar.map((n) => (
                <div key={n.id} className="px-4 py-3.5">
                  <p className="text-xs font-semibold text-neutral-500">{gunAdi(n.tarih)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                    {n.icerik}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {yoklamaKayitlari.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">
              Devam çizelgesi
            </h2>
            <div className="kart divide-y divide-neutral-100">
              {yoklamaKayitlari.slice(0, 15).map((y, i) => {
                const d = YOKLAMA_DURUMU[y.durum];
                return (
                  <div key={`${y.tarih}-${i}`} className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.nokta}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-900">{y.baslik}</p>
                      <p className="text-xs text-neutral-500">{gunAdi(y.tarih)}</p>
                    </div>
                    <span className={`rozet ${d.stil}`}>{d.ad}</span>
                  </div>
                );
              })}
            </div>
            {yoklamaKayitlari.length > 15 ? (
              <p className="mt-2 px-1 text-center text-xs text-neutral-400">
                Son 15 antrenman gösteriliyor · toplam {yoklamaKayitlari.length} kayıt
              </p>
            ) : null}
          </>
        ) : null}

        <div className="mb-2 mt-7 flex items-center justify-between px-1">
          <h2 className="bolum-basligi">
            Sporcu bilgileri
          </h2>
          <Link
            href={`/panel/sporcu/${sporcu.id}/duzenle`}
            className="flex items-center gap-1 text-sm font-semibold text-yesil-700"
          >
            <Ikon ad="kalem" className="h-4 w-4" />
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

        {katilimlar.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">
              Maçlar
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

        <h2 className="mb-2 mt-7 px-1 bolum-basligi">
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
                  <a
                    href={linkler.get(b.dosya_yolu)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700"
                  >
                    Aç
                  </a>
                ) : null}
              </div>
            ))
          )}
          <BelgeYukle sporcuId={sporcu.id} kullaniciId={user.id} />
        </div>

        {paraGorunur ? (
        <>
        <h2 className="mb-2 mt-7 px-1 bolum-basligi">
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

        <h2 className="mb-2 mt-7 px-1 bolum-basligi">
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
                    {o.yontem === "havale"
                      ? "Havale / EFT"
                      : o.yontem === "nakit"
                        ? "Nakit"
                        : o.yontem === "kart"
                          ? "Kart"
                          : "Diğer"}
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
        </>
        ) : null}
      </div>
    </>
  );
}
