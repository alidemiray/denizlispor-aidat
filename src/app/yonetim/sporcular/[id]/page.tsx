import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuForm from "@/components/SporcuForm";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import { yoneticiGerekli } from "@/lib/yetki";
import { belgeSil } from "@/app/yonetim/actions";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import { BELGE_ADI, type Aidat, type Belge, type Odeme, type Sporcu } from "@/lib/types";

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

  const [{ data: aidatData }, { data: odemeData }, { data: belgeData }] = await Promise.all([
    supabase.from("spor_aidatlar").select("*").eq("sporcu_id", id)
      .order("donem", { ascending: false }),
    supabase.from("spor_odemeler").select("*").eq("sporcu_id", id)
      .order("odeme_tarihi", { ascending: false }),
    supabase.from("spor_belgeler").select("*").eq("sporcu_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const aidatlar = (aidatData ?? []) as Aidat[];
  const odemeler = (odemeData ?? []) as Odeme[];
  const belgeler = (belgeData ?? []) as Belge[];

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
  const fotoUrl = sporcu.foto_yolu ? linkler.get(sporcu.foto_yolu) : null;

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={sporcu.veli_id ? "Veli hesabı bağlı ✓" : "Veli henüz kaydolmadı"}
        geri="/yonetim/sporcular"
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
        {fotoUrl ? (
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl} alt="Sporcu fotoğrafı"
              className="h-24 w-24 rounded-full object-cover ring-4 ring-white" />
          </div>
        ) : null}

        {sporcu.durum === "onay_bekliyor" ? (
          <div className="kart mb-4 border-l-4 border-amber-400 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              Bu kayıt veli tarafından girildi ve onay bekliyor
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Yaş grubu ve aylık aidatı belirleyip durumu <b>Aktif</b> yapın.
            </p>
          </div>
        ) : null}

        <SporcuForm sporcu={sporcu} />

        <h2 className="mb-2 mt-8 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Belgeler ({belgeler.length})
        </h2>
        {belgeler.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Belge yüklenmemiş.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {belgeler.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {BELGE_ADI[b.tur]}
                  </p>
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
                <form action={belgeSil}>
                  <input type="hidden" name="id" value={b.id} />
                  <input type="hidden" name="sporcu_id" value={sporcu.id} />
                  <input type="hidden" name="dosya_yolu" value={b.dosya_yolu} />
                  <button className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                    Sil
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

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
