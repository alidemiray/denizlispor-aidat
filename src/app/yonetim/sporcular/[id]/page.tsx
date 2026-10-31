import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuForm from "@/components/SporcuForm";
import { AidatRozeti, OdemeRozeti } from "@/components/Rozet";
import { yoneticiGerekli } from "@/lib/yetki";
import { kulupGeneliMi } from "@/lib/roller";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import { gruplarim } from "@/lib/grup";
import { sporcuGrupDegistir } from "@/app/yonetim/gruplar/actions";
import { belgeSil } from "@/app/yonetim/actions";
import { donemAdi, gunAdi, tl } from "@/lib/format";
import ZimmetForm from "@/components/ZimmetForm";
import ZimmetListesi from "@/components/ZimmetListesi";
import { bugunTR } from "@/lib/sezon";
import type { Zimmet } from "@/lib/zimmet";
import { BELGE_ADI, type Aidat, type Belge, type Odeme, type Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SporcuDuzenle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, rol } = await yoneticiGerekli();

  const { data } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const sporcu = data as Sporcu;

  const [{ data: aidatData }, { data: odemeData }, { data: belgeData }, zimmetSonuc] = await Promise.all([
    supabase.from("spor_aidatlar").select("*").eq("sporcu_id", id)
      .order("donem", { ascending: false }),
    supabase.from("spor_odemeler").select("*").eq("sporcu_id", id)
      .order("odeme_tarihi", { ascending: false }),
    supabase.from("spor_belgeler").select("*").eq("sporcu_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("spor_zimmetler").select("*").eq("sporcu_id", id)
      .order("verilis", { ascending: false }),
  ]);
  const zimmetVar = !zimmetSonuc.error;
  const zimmetler = (zimmetSonuc.data ?? []) as Zimmet[];
  const bugun = bugunTR();
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
  // Grubu değiştirme: admin ve kulüp başkanı (birden çok grup varsa)
  const gruplar = kulupGeneliMi(rol) ? await gruplarim(supabase) : [];
  const sporcuGrubu = (sporcu as Sporcu & { grup_id?: string }).grup_id;

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={sporcu.veli_id ? "Veli hesabı bağlı ✓" : "Veli henüz kaydolmadı"}
        geri="/yonetim/sporcular"
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        {fotoUrl ? (
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoUrl} alt="Sporcu fotoğrafı"
              className="h-24 w-24 rounded-full object-cover ring-4 ring-white" />
          </div>
        ) : null}

        {sporcu.durum === "onay_bekliyor" ? (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-500/20">
            <p className="text-sm font-semibold text-neutral-900">
              Bu kayıt veli tarafından girildi ve onay bekliyor
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Yaş grubu ve aylık aidatı belirleyip durumu <b>Aktif</b> yapın.
            </p>
          </div>
        ) : null}

        <SporcuForm sporcu={sporcu} />

        {gruplar.length > 1 && sporcuGrubu ? (
          <form action={sporcuGrupDegistir} className="kart mt-4 space-y-2 px-4 py-4">
            <input type="hidden" name="sporcu" value={sporcu.id} />
            <label className="etiket" htmlFor="grup">Grubu</label>
            <div className="flex gap-2">
              <select id="grup" name="grup" className="alan flex-1" defaultValue={sporcuGrubu}>
                {gruplar.map((g) => (
                  <option key={g.id} value={g.id}>{g.ad}</option>
                ))}
              </select>
              <KaydetDugmesi bekleyen="…" className="btn-ikincil shrink-0 px-4">Taşı</KaydetDugmesi>
            </div>
            <p className="text-xs leading-relaxed text-neutral-500">
              Sporcu yeni grubun antrenman, aidat ve kasasına geçer. Geçmiş aidat ve ödemeleri eski
              grubun kasasında kalır.
            </p>
          </form>
        ) : null}

        <h2 className="mb-2 mt-8 px-1 bolum-basligi">
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

        {zimmetVar ? (
          <>
            <h2 className="mb-2 mt-8 px-1 bolum-basligi">
              Zimmet ({zimmetler.filter((z) => !z.iade_edildi).length} açık)
            </h2>
            <ZimmetListesi liste={zimmetler} bugun={bugun} donus={`/yonetim/sporcular/${id}`} bos="Bu sporcuda kulübe ait eşya yok." />
            <details className="kart mt-2 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-neutral-800">+ Eşya ver</summary>
              <div className="mt-3">
                <ZimmetForm bugun={bugun} donus={`/yonetim/sporcular/${id}`} sporcuId={id} />
              </div>
            </details>
          </>
        ) : null}

        <h2 className="mb-2 mt-8 px-1 bolum-basligi">
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

        <h2 className="mb-2 mt-8 px-1 bolum-basligi">
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
