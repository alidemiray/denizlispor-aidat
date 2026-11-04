import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import Ikon from "@/components/ui/Ikon";
import BildirimZili from "@/components/BildirimZili";
import { personelGerekli } from "@/lib/yetki";
import { gunAdi } from "@/lib/format";
import { ANTRENMAN_TURU, haftaBasi } from "@/lib/antrenman";
import type { Antrenman } from "@/lib/types";
import { kalanGunMetni, yaklasanDogumGunleri } from "@/lib/dogumGunu";
import { bugunTR, bugunkuSezon, sezonAraligi } from "@/lib/sezon";
import { haftalikUyarilar } from "@/lib/analiz";
import { BRANS } from "@/kulup";
import AntrenorUyarilari from "@/components/AntrenorUyarilari";

export const dynamic = "force-dynamic";

export default async function AntrenorAnaSayfa() {
  const { supabase, profil } = await personelGerekli();

  const bugun = new Date().toISOString().slice(0, 10);
  const buHafta = haftaBasi(bugun);

  const [{ data: antrenmanData }, { data: sporcuData }, { data: yoklamaData }] = await Promise.all([
    supabase.from("spor_antrenmanlar").select("*").order("tarih", { ascending: false }).limit(30),
    supabase.from("spor_sporcular").select("id, ad, soyad, durum, yas_grubu, dogum_tarihi"),
    supabase.from("spor_yoklama").select("antrenman_id, durum"),
  ]);

  // Analiz verisi: sezonun maçları + son 6 haftanın yoklaması + son değerlendirmeler
  const bugunT = bugunTR();
  const { bas: sezonBas } = sezonAraligi(bugunkuSezon());
  const altiHafta = new Date(Date.parse(bugunT + "T00:00:00Z") - 42 * 864e5).toISOString().slice(0, 10);
  const [{ data: macData }, { data: yukData }, { data: degData }] = await Promise.all([
    supabase.from("spor_maclar").select("id, tarih, yas_grubu").gte("tarih", sezonBas).lte("tarih", bugunT),
    supabase
      .from("spor_yoklama")
      .select("sporcu_id, durum, spor_antrenmanlar!inner(tarih, sure_dk)")
      .gte("spor_antrenmanlar.tarih", altiHafta),
    supabase.from("spor_degerlendirmeler").select("sporcu_id, donem"),
  ]);
  const sezonMaclari = (macData ?? []) as { id: string; tarih: string; yas_grubu: string | null }[];
  const { data: katData } = sezonMaclari.length
    ? await supabase
        .from("spor_mac_katilim")
        .select("mac_id, sporcu_id, dakika")
        .in("mac_id", sezonMaclari.map((m) => m.id))
    : { data: [] };
  const sonDegerlendirme: Record<string, string> = {};
  for (const d of (degData ?? []) as { sporcu_id: string; donem: string }[]) {
    if (!sonDegerlendirme[d.sporcu_id] || sonDegerlendirme[d.sporcu_id] < d.donem) sonDegerlendirme[d.sporcu_id] = d.donem;
  }

  const antrenmanlar = (antrenmanData ?? []) as Antrenman[];
  const sporcular = (sporcuData ?? []) as { id: string; ad: string; soyad: string; durum: string; yas_grubu: string | null; dogum_tarihi: string | null }[];
  const dogumGunleri = yaklasanDogumGunleri(sporcular.filter((s) => s.durum === "aktif"), bugunTR());
  const yoklamalar = (yoklamaData ?? []) as { antrenman_id: string; durum: string }[];

  const aktifSporcu = sporcular.filter((s) => s.durum === "aktif").length;
  const gruplar = Array.from(
    new Set(sporcular.filter((s) => s.durum === "aktif" && s.yas_grubu).map((s) => s.yas_grubu!)),
  ).sort();

  const haftalik = antrenmanlar.filter((a) => haftaBasi(a.tarih) === buHafta);
  const yoklamasiz = haftalik.filter(
    (a) => !yoklamalar.some((y) => y.antrenman_id === a.id),
  );
  const sonUc = antrenmanlar.slice(0, 3);

  const uyarilar = haftalikUyarilar(
    {
      sporcular: sporcular
        .filter((x) => x.durum === "aktif")
        .map(({ id, ad, soyad, yas_grubu }) => ({ id, ad, soyad, yas_grubu })),
      maclar: sezonMaclari,
      katilimlar: (katData ?? []) as { mac_id: string; sporcu_id: string; dakika: number }[],
      yoklamalar: ((yukData ?? []) as unknown as {
        sporcu_id: string;
        durum: string;
        spor_antrenmanlar: { tarih: string; sure_dk: number | null } | null;
      }[])
        .filter((y) => y.spor_antrenmanlar)
        .map((y) => ({
          sporcu_id: y.sporcu_id,
          durum: y.durum,
          tarih: y.spor_antrenmanlar!.tarih,
          sure_dk: y.spor_antrenmanlar!.sure_dk,
        })),
      sonDegerlendirme,
      bugun: bugunT,
    },
    BRANS,
  );

  return (
    <>
      <UstBaslik
        baslik="Antrenör paneli"
        altBaslik={profil?.ad_soyad ?? undefined}
        sag={
          <div className="flex items-center gap-2">
            <BildirimZili yol="/antrenor/bildirimler" />
            <Link
              href="/antrenor/antrenmanlar?yeni=1"
              className="flex h-10 items-center gap-1 rounded-full bg-yuzey px-3 text-xs font-bold text-yesil-700"
            >
              <Ikon ad="artı" className="h-4 w-4" />
              Antrenman
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { ad: "Aktif sporcu", deger: String(aktifSporcu) },
            { ad: "Bu hafta", deger: String(haftalik.length) },
            { ad: "Yaş grubu", deger: String(gruplar.length) },
          ].map((k) => (
            <div key={k.ad} className="rounded-2xl bg-white/[0.07] px-3 py-3 ring-1 ring-white/10">
              <p className="font-manset text-[30px] font-extrabold leading-none">{k.deger}</p>
              <p className="mt-1 text-[11px] text-white/60">{k.ad}</p>
            </div>
          ))}
        </div>
      </UstBaslik>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {yoklamasiz.length > 0 ? (
          <div className="kart mt-4 border-l-4 border-amber-400 px-4 py-4">
            <p className="text-sm font-semibold text-neutral-900">
              {yoklamasiz.length} antrenmanın yoklaması alınmamış
            </p>
            <div className="mt-2.5 space-y-1.5">
              {yoklamasiz.slice(0, 3).map((a) => (
                <Link
                  key={a.id}
                  href={`/antrenor/antrenmanlar/${a.id}`}
                  className="flex items-center gap-2 text-sm text-yesil-700"
                >
                  <Ikon ad="kontrol" className="h-4 w-4" />
                  <span className="truncate">
                    {gunAdi(a.tarih)} · {a.baslik}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <h2 className="mb-2 mt-6 px-1 bolum-basligi">Bu hafta dikkat</h2>
        <AntrenorUyarilari uyarilar={uyarilar} azOynamaEsigi={BRANS.azOynamaEsigi} sureli={BRANS.sureli} />

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Link
            href="/antrenor/antrenmanlar?yeni=1"
            className="kart flex items-center gap-3 px-4 py-4 active:scale-[.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yesil-50 text-yesil-700">
              <Ikon ad="artı" className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-neutral-800">Antrenman ekle</span>
          </Link>
          <Link
            href="/antrenor/sporcular"
            className="kart flex items-center gap-3 px-4 py-4 active:scale-[.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yesil-50 text-yesil-700">
              <Ikon ad="kisiler" className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-neutral-800">Sporcular</span>
          </Link>
          <Link
            href="/antrenor/duyurular"
            className="kart col-span-2 flex items-center gap-3 px-4 py-4 active:scale-[.98]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yesil-50 text-yesil-700">
              <Ikon ad="megafon" className="h-5 w-5" />
            </span>
            <span className="flex-1 text-sm font-semibold text-neutral-800">Duyuru yayınla</span>
            <span className="text-xs text-neutral-500">velilere · sporculara</span>
          </Link>
        </div>

        {dogumGunleri.length ? (
          <>
            <h2 className="mb-2 mt-7 px-1 bolum-basligi">Doğum günleri · 7 gün</h2>
            <div className="kart divide-y divide-white/[0.06]">
              {dogumGunleri.map(({ sporcu, kalan, yas }) => (
                <Link key={sporcu.id} href={`/antrenor/sporcular/${sporcu.id}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{sporcu.ad} {sporcu.soyad}</p>
                    <p className="text-xs text-neutral-500">{yas} yaşına giriyor{sporcu.yas_grubu ? ` · ${sporcu.yas_grubu}` : ""}</p>
                  </div>
                  <span className={`rozet ${kalan === 0 ? "bg-yesil-500 text-anametin" : "bg-neutral-100 text-neutral-700"}`}>
                    {kalanGunMetni(kalan)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        <div className="mb-2 mt-7 flex items-center justify-between px-1">
          <h2 className="bolum-basligi">
            Son antrenmanlar
          </h2>
          <Link href="/antrenor/antrenmanlar" className="text-sm font-semibold text-yesil-700">
            Tümü
          </Link>
        </div>

        {sonUc.length === 0 ? (
          <div className="kart px-5 py-8 text-center text-sm text-neutral-500">
            Henüz antrenman kaydı yok. Sağ üstten ilkini ekleyin.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {sonUc.map((a) => {
              const sayi = yoklamalar.filter(
                (y) => y.antrenman_id === a.id && (y.durum === "geldi" || y.durum === "gec"),
              ).length;
              return (
                <Link
                  key={a.id}
                  href={`/antrenor/antrenmanlar/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{a.baslik}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {gunAdi(a.tarih)} · {ANTRENMAN_TURU[a.tur] ?? a.tur}
                      {a.yas_grubu ? ` · ${a.yas_grubu}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">{sayi} katılım</span>
                  <span className="text-neutral-300">›</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
