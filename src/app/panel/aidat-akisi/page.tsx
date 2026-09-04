import Link from "next/link";
import { redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import { createClient } from "@/lib/supabase/server";
import { donemAdi, gunAdi, tl } from "@/lib/format";

export const dynamic = "force-dynamic";

type DonemOzet = {
  donem: string;
  sporcu_sayisi: number;
  toplam: number;
  odenen: number;
  bekleyen: number;
  odeyen_sayisi: number;
};

type AkisSatir = {
  aidat_id: string;
  ad: string;
  soyad: string;
  yas_grubu: string | null;
  tutar: number;
  durum: "bekliyor" | "odendi" | "muaf";
  son_odeme_tarihi: string | null;
  benim: boolean;
};

export default async function AidatAkisi({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const sp = await searchParams;

  const { data: donemData } = await supabase.rpc("spor_aidat_donemleri");
  const donemler = (donemData ?? []) as DonemOzet[];
  const secili = sp.donem ?? donemler[0]?.donem ?? null;
  const ozet = donemler.find((d) => d.donem === secili) ?? null;

  const { data: akisData } = secili
    ? await supabase.rpc("spor_aidat_akisi", { p_donem: secili })
    : { data: [] as AkisSatir[] };
  const satirlar = (akisData ?? []) as AkisSatir[];

  const yuzde = ozet && Number(ozet.toplam) > 0
    ? Math.round((Number(ozet.odenen) / Number(ozet.toplam)) * 100)
    : 0;

  const gruplar = Array.from(
    satirlar.reduce((m, s) => {
      const g = s.yas_grubu ?? "Grup belirtilmemiş";
      m.set(g, [...(m.get(g) ?? []), s]);
      return m;
    }, new Map<string, AkisSatir[]>()),
  );

  return (
    <>
      <UstBaslik
        baslik="Aidat akış tablosu"
        altBaslik="Kulüp geneli aylık aidat durumu"
        geri="/panel"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24">
        {donemler.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center">
            <p className="text-4xl">📋</p>
            <p className="mt-3 font-semibold text-neutral-800">Henüz aidat dönemi yok</p>
            <p className="mt-1.5 text-sm text-neutral-500">
              Kulüp ilk dönem tahakkukunu oluşturduğunda tablo burada görünecek.
            </p>
          </div>
        ) : (
          <>
            <div className="-mx-4 mt-3 overflow-x-auto px-4">
              <div className="flex gap-2 pb-1">
                {donemler.map((d) => {
                  const aktif = d.donem === secili;
                  return (
                    <Link
                      key={d.donem}
                      href={`/panel/aidat-akisi?donem=${d.donem}`}
                      scroll={false}
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
                        aktif
                          ? "bg-yesil-600 text-white shadow-sm"
                          : "bg-white text-neutral-600 ring-1 ring-black/5"
                      }`}
                    >
                      {donemAdi(d.donem)}
                    </Link>
                  );
                })}
              </div>
            </div>

            {ozet ? (
              <div className="kart mt-3 px-5 py-5">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-bold text-neutral-900">{donemAdi(ozet.donem)}</p>
                  <p className="text-xs text-neutral-500">
                    {ozet.odeyen_sayisi} / {ozet.sporcu_sayisi} sporcu ödedi
                  </p>
                </div>

                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className="h-full rounded-full bg-yesil-600 transition-all"
                    style={{ width: `${yuzde}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Tahsilat oranı %{yuzde}
                </p>

                <div className="mt-4 grid grid-cols-3 divide-x divide-neutral-100 border-t border-neutral-100 pt-4">
                  <div className="px-1 text-center">
                    <p className="text-sm font-extrabold text-neutral-900">{tl(ozet.toplam)}</p>
                    <p className="text-[11px] text-neutral-500">Tahakkuk</p>
                  </div>
                  <div className="px-1 text-center">
                    <p className="text-sm font-extrabold text-emerald-700">{tl(ozet.odenen)}</p>
                    <p className="text-[11px] text-neutral-500">Tahsil edilen</p>
                  </div>
                  <div className="px-1 text-center">
                    <p className="text-sm font-extrabold text-neutral-900">{tl(ozet.bekleyen)}</p>
                    <p className="text-[11px] text-neutral-500">Bekleyen</p>
                  </div>
                </div>
              </div>
            ) : null}

            {gruplar.map(([grup, liste]) => (
              <div key={grup}>
                <h2 className="mb-2 mt-6 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
                  {grup}
                  <span className="ml-2 font-medium normal-case text-neutral-400">
                    ({liste.length})
                  </span>
                </h2>
                <div className="kart divide-y divide-neutral-100">
                  {liste.map((s) => (
                    <div
                      key={s.aidat_id}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        s.benim ? "bg-yesil-50/60" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium tracking-wide text-neutral-900">
                          {s.ad} {s.soyad}
                          {s.benim ? (
                            <span className="ml-2 rozet bg-yesil-100 text-yesil-800">
                              sporcunuz
                            </span>
                          ) : null}
                        </p>
                        {s.son_odeme_tarihi ? (
                          <p className="text-xs text-neutral-500">
                            Son ödeme: {gunAdi(s.son_odeme_tarihi)}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-sm font-bold text-neutral-900">{tl(s.tutar)}</span>
                      {s.durum === "odendi" ? (
                        <span className="rozet bg-emerald-100 text-emerald-800">Ödendi</span>
                      ) : s.durum === "muaf" ? (
                        <span className="rozet bg-neutral-200 text-neutral-700">Muaf</span>
                      ) : (
                        <span className="rozet bg-amber-100 text-amber-900">Bekliyor</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="mt-6 px-1 text-center text-[11px] leading-relaxed text-neutral-400">
              Gizlilik için sporcu isimleri kısaltılarak gösterilir.
              <br />
              Kendi sporcunuzun ayrıntılı dökümünü sporcu sayfasından görebilirsiniz.
            </p>
          </>
        )}
      </div>
    </>
  );
}
