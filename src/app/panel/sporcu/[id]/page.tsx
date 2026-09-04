import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import FotoYukle from "@/components/FotoYukle";
import BelgeYukle from "@/components/BelgeYukle";
import GelisimBolumu from "@/components/GelisimBolumu";
import Ikon from "@/components/ui/Ikon";
import { createClient } from "@/lib/supabase/server";
import { gunAdi, tl } from "@/lib/format";
import { KART_ADI, MAC_TURU, macBasligi, skorMetni } from "@/lib/mac";
import { YOKLAMA_DURUMU } from "@/lib/antrenman";
import {
  BELGE_ADI,
  type Aidat,
  type Belge,
  type Degerlendirme,
  type Mac,
  type Olcum,
  type Sporcu,
  type SporcuNotu,
} from "@/lib/types";

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

  const [
    { data: aidatData },
    { data: katilimData },
    { data: belgeData },
    { data: yoklamaData },
    { data: degData },
    { data: olcumData },
    { data: notData },
  ] = await Promise.all([
    supabase.from("spor_aidatlar").select("*").eq("sporcu_id", id),
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

  const aidatlar = (aidatData ?? []) as Aidat[];
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

  const macSayisi = katilimlar.filter((k) => k.dakika > 0).length;
  const toplamDakika = katilimlar.reduce((t, k) => t + k.dakika, 0);
  const gol = katilimlar.reduce((t, k) => t + k.gol, 0);
  const asist = katilimlar.reduce((t, k) => t + k.asist, 0);

  const macDakikalari = [...katilimlar]
    .reverse()
    .slice(-8)
    .map((k) => ({
      etiket: new Date(k.spor_maclar!.tarih + "T00:00:00")
        .toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
        .replace(".", ""),
      deger: k.dakika,
    }));

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

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="-mt-9 flex justify-center">
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

        <section className="mt-4 grid grid-cols-4 gap-2">
          {[
            ["Maç", String(macSayisi)],
            ["Dakika", String(toplamDakika)],
            ["Gol", String(gol)],
            ["Asist", String(asist)],
          ].map(([k, v]) => (
            <div key={k} className="kart px-1 py-3 text-center">
              <p className="text-lg font-extrabold text-neutral-900">{v}</p>
              <p className="text-[10px] text-neutral-500">{k}</p>
            </div>
          ))}
        </section>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Gelişim
        </h2>
        <GelisimBolumu
          yoklamalar={yoklamaKayitlari}
          degerlendirmeler={degerlendirmeler}
          olcumler={olcumler}
          macDakikalari={macDakikalari}
        />

        {notlar.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
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
            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
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

        {katilimlar.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
              Maçlar
            </h2>
            <div className="kart divide-y divide-neutral-100">
              {katilimlar.slice(0, 12).map((k) => {
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

        <Link href="/panel/aidat" className="mt-3 block">
          <div className="kart flex items-center gap-3 px-4 py-3.5 active:scale-[.99]">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
              <Ikon ad="cuzdan" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">Aidat durumu</p>
              <p className="text-xs text-neutral-500">
                {borc > 0 ? `${tl(borc)} bekleyen ödeme` : "Bu sporcu için borç yok"}
              </p>
            </div>
            <span className="text-neutral-300">›</span>
          </div>
        </Link>

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
      </div>
    </>
  );
}
