import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuForm from "@/components/SporcuForm";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import { yoneticiGerekli } from "@/lib/yetki";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import type { Aidat, Odeme, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SporcuDuzenle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await yoneticiGerekli();

  const { data } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const sporcu = data as Sporcu;

  const [{ data: aidatData }, { data: odemeData }] = await Promise.all([
    supabase.from("spor_aidatlar").select("*").eq("sporcu_id", id)
      .order("donem", { ascending: false }),
    supabase.from("spor_odemeler").select("*").eq("sporcu_id", id)
      .order("odeme_tarihi", { ascending: false }),
  ]);
  const aidatlar = (aidatData ?? []) as Aidat[];
  const odemeler = (odemeData ?? []) as Odeme[];

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={sporcu.veli_id ? "Veli hesabı bağlı ✓" : "Veli henüz kaydolmadı"}
        geri="/yonetim/sporcular"
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
        <SporcuForm sporcu={sporcu} />

        <h2 className="mb-2 mt-8 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Aidat dönemleri ({aidatlar.length})
        </h2>
        {aidatlar.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Tahakkuk kaydı yok.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {aidatlar.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 font-medium text-neutral-800">
                  {donemAdi(a.donem)}
                </span>
                <span className="text-sm font-bold">{tl(a.tutar)}</span>
                <AidatRozeti durum={a.durum} sonOdeme={a.son_odeme_tarihi} />
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-2 mt-8 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Ödemeler ({odemeler.length})
        </h2>
        {odemeler.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Ödeme kaydı yok.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {odemeler.map((o) => (
              <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex-1 text-sm text-neutral-700">
                  {gunAdi(o.odeme_tarihi)}
                </span>
                <span className="text-sm font-bold">{tl(o.tutar)}</span>
                <OdemeRozeti durum={o.durum} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
