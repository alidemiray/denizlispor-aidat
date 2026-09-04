import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import { createClient } from "@/lib/supabase/server";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import type { Aidat, Odeme, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const [{ data: aidatData }, { data: odemeData }] = await Promise.all([
    supabase
      .from("spor_aidatlar")
      .select("*")
      .eq("sporcu_id", id)
      .order("donem", { ascending: false }),
    supabase
      .from("spor_odemeler")
      .select("*")
      .eq("sporcu_id", id)
      .order("odeme_tarihi", { ascending: false }),
  ]);

  const aidatlar = (aidatData ?? []) as Aidat[];
  const odemeler = (odemeData ?? []) as Odeme[];

  const borc = aidatlar
    .filter((a) => a.durum === "bekliyor")
    .reduce((t, a) => t + Number(a.tutar), 0);
  const odenen = odemeler
    .filter((o) => o.durum === "onaylandi")
    .reduce((t, o) => t + Number(o.tutar), 0);

  const bilgiler: [string, string][] = [
    ["Yaş grubu", sporcu.yas_grubu || "-"],
    ["Mevki", sporcu.mevki || "-"],
    ["Forma no", sporcu.forma_no ? String(sporcu.forma_no) : "-"],
    ["Doğum tarihi", sporcu.dogum_tarihi ? gunAdi(sporcu.dogum_tarihi) : "-"],
    ["Kayıt tarihi", gunAdi(sporcu.kayit_tarihi)],
    ["Aylık aidat", tl(sporcu.aylik_aidat)],
  ];

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={
          [sporcu.yas_grubu, sporcu.mevki].filter(Boolean).join(" · ") ||
          "Denizlispor Altyapı"
        }
        geri="/panel"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24">
        <section className="-mt-3 grid grid-cols-2 gap-3">
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

        <Link href="/panel/odeme-bildir" className="btn-birincil mt-3 w-full">
          Bu sporcu için ödeme bildir
        </Link>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Sporcu bilgileri
        </h2>
        <div className="kart divide-y divide-neutral-100">
          {bilgiler.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-neutral-500">{k}</span>
              <span className="text-sm font-semibold text-neutral-900">{v}</span>
            </div>
          ))}
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
      </div>
    </>
  );
}
