import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import Ikon from "@/components/ui/Ikon";
import { paraEkraniGerekli } from "@/lib/yetki";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import type { Aidat, Odeme, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VeliAidat() {
  const { supabase, user } = await paraEkraniGerekli();

  const { data: sporcuData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("veli_id", user.id)
    .order("ad");
  const sporcular = (sporcuData ?? []) as Sporcu[];
  const idler = sporcular.map((s) => s.id);

  const [{ data: aidatData }, { data: odemeData }] = await Promise.all([
    idler.length
      ? supabase.from("spor_aidatlar").select("*").in("sporcu_id", idler)
          .order("donem", { ascending: false })
      : Promise.resolve({ data: [] as Aidat[] }),
    idler.length
      ? supabase.from("spor_odemeler").select("*").in("sporcu_id", idler)
          .order("odeme_tarihi", { ascending: false })
      : Promise.resolve({ data: [] as Odeme[] }),
  ]);

  const aidatlar = (aidatData ?? []) as Aidat[];
  const odemeler = (odemeData ?? []) as Odeme[];

  const borc = aidatlar.filter((a) => a.durum === "bekliyor")
    .reduce((t, a) => t + Number(a.tutar), 0);
  const odenen = odemeler.filter((o) => o.durum === "onaylandi")
    .reduce((t, o) => t + Number(o.tutar), 0);
  const bekleyenBildirim = odemeler.filter((o) => o.durum === "beklemede").length;

  const sporcuAdi = new Map(sporcular.map((s) => [s.id, `${s.ad} ${s.soyad}`]));

  return (
    <>
      <UstBaslik baslik="Aidat" altBaslik="Kendi sporcularınızın durumu" geri="/panel">
        <div className="rounded-2xl bg-white/[0.14] px-4 py-4 ring-1 ring-white/10">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Toplam bekleyen
          </p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{tl(borc)}</p>
          <p className="mt-0.5 text-xs text-white/65">
            Bugüne kadar ödenen {tl(odenen)}
            {bekleyenBildirim > 0 ? ` · ${bekleyenBildirim} bildirim onayda` : ""}
          </p>
        </div>
      </UstBaslik>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Link href="/panel/odeme-bildir" className="btn-birincil">
            Ödeme bildir
          </Link>
          <Link href="/panel/aidat-akisi" className="btn-ikincil">
            Kulüp geneli akış
          </Link>
        </div>

        {sporcular.map((s) => {
          const kendi = aidatlar.filter((a) => a.sporcu_id === s.id);
          const sporcuBorc = kendi
            .filter((a) => a.durum === "bekliyor")
            .reduce((t, a) => t + Number(a.tutar), 0);
          if (kendi.length === 0) return null;

          return (
            <section key={s.id} className="mt-6">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-neutral-800">
                  {s.ad} {s.soyad}
                </h2>
                <span
                  className={`text-sm font-bold ${
                    sporcuBorc > 0 ? "text-neutral-900" : "text-emerald-700"
                  }`}
                >
                  {sporcuBorc > 0 ? tl(sporcuBorc) : "Borç yok"}
                </span>
              </div>
              <div className="kart divide-y divide-neutral-100">
                {kendi.map((a) => (
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
            </section>
          );
        })}

        {aidatlar.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yesil-50 text-yesil-700">
              <Ikon ad="cuzdan" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-neutral-800">Aidat kaydı yok</p>
            <p className="mt-1.5 text-sm text-neutral-500">
              Kulüp dönem tahakkuku oluşturduğunda burada görünecek.
            </p>
          </div>
        ) : null}

        {odemeler.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
              Ödeme geçmişi
            </h2>
            <div className="kart divide-y divide-neutral-100">
              {odemeler.map((o) => (
                <div key={o.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-neutral-900">{gunAdi(o.odeme_tarihi)}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {sporcuAdi.get(o.sporcu_id) ?? "Sporcu"}
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
          </>
        ) : null}
      </div>
    </>
  );
}
