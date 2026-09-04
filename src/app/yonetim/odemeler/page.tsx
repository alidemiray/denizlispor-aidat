import UstBaslik from "@/components/UstBaslik";
import { OdemeRozeti } from "@/components/Rozet";
import { yoneticiGerekli } from "@/lib/yetki";
import { odemeKarar } from "@/app/yonetim/actions";
import { donemAdi, gunAdi, tl } from "@/lib/format";

export const dynamic = "force-dynamic";

type OdemeSatir = {
  id: string;
  tutar: number;
  odeme_tarihi: string;
  yontem: string;
  durum: string;
  aciklama: string | null;
  dekont_yolu: string | null;
  created_at: string;
  spor_sporcular: { ad: string; soyad: string } | null;
  spor_aidatlar: { donem: string } | null;
};

const YONTEM: Record<string, string> = {
  havale: "Havale / EFT",
  nakit: "Nakit",
  kart: "Kart",
  diger: "Diğer",
};

export default async function OdemelerSayfasi() {
  const { supabase } = await yoneticiGerekli();

  const { data } = await supabase
    .from("spor_odemeler")
    .select(
      "id, tutar, odeme_tarihi, yontem, durum, aciklama, dekont_yolu, created_at, spor_sporcular(ad, soyad), spor_aidatlar(donem)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const odemeler = (data ?? []) as unknown as OdemeSatir[];
  const bekleyen = odemeler.filter((o) => o.durum === "beklemede");
  const digerleri = odemeler.filter((o) => o.durum !== "beklemede");

  const yollar = odemeler.map((o) => o.dekont_yolu).filter(Boolean) as string[];
  const linkler = new Map<string, string>();
  if (yollar.length) {
    const { data: imzali } = await supabase.storage
      .from("spor-dekontlar")
      .createSignedUrls(yollar, 60 * 60);
    for (const l of imzali ?? []) {
      if (l.path && l.signedUrl) linkler.set(l.path, l.signedUrl);
    }
  }

  function Satir({ o }: { o: OdemeSatir }) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-neutral-900">
            {o.spor_sporcular?.ad} {o.spor_sporcular?.soyad}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {gunAdi(o.odeme_tarihi)} · {YONTEM[o.yontem] ?? o.yontem}
            {o.spor_aidatlar?.donem ? ` · ${donemAdi(o.spor_aidatlar.donem)}` : ""}
            {o.aciklama ? ` · ${o.aciklama}` : ""}
          </p>
        </div>
        <span className="text-sm font-bold">{tl(o.tutar)}</span>
        {o.dekont_yolu && linkler.get(o.dekont_yolu) ? (
          <a
            href={linkler.get(o.dekont_yolu)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700"
          >
            Dekont
          </a>
        ) : (
          <span className="text-xs text-neutral-400">dekont yok</span>
        )}
        {o.durum === "beklemede" ? (
          <div className="flex gap-1.5">
            <form action={odemeKarar}>
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="durum" value="onaylandi" />
              <button className="rounded-lg bg-yesil-600 px-3 py-1.5 text-xs font-semibold text-white">
                Onayla
              </button>
            </form>
            <form action={odemeKarar}>
              <input type="hidden" name="id" value={o.id} />
              <input type="hidden" name="durum" value="reddedildi" />
              <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                Reddet
              </button>
            </form>
          </div>
        ) : (
          <OdemeRozeti durum={o.durum} />
        )}
      </div>
    );
  }

  return (
    <>
      <UstBaslik
        baslik="Ödemeler"
        altBaslik={`${bekleyen.length} bildirim onay bekliyor`}
        geri="/yonetim"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-24">
        <h2 className="mb-2 mt-4 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Onay bekleyenler
        </h2>
        <div className="kart divide-y divide-neutral-100">
          {bekleyen.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              Onay bekleyen ödeme bildirimi yok.
            </p>
          ) : (
            bekleyen.map((o) => <Satir key={o.id} o={o} />)
          )}
        </div>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Geçmiş kayıtlar
        </h2>
        <div className="kart divide-y divide-neutral-100">
          {digerleri.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">Kayıt yok.</p>
          ) : (
            digerleri.map((o) => <Satir key={o.id} o={o} />)
          )}
        </div>
      </div>
    </>
  );
}
