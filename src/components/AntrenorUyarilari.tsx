import Link from "next/link";
import type { HaftalikUyarilar, UyariSporcu } from "@/lib/analiz";

type Bolum = {
  anahtar: string;
  baslik: string;
  aciklama: string;
  nokta: string;
  satirlar: { sporcu: UyariSporcu; sag: string }[];
};

const GOSTERILEN = 4;

/** Antrenör ana sayfası: "Bu hafta dikkat". Boş bölümler hiç görünmez. */
export default function AntrenorUyarilari({
  uyarilar,
  azOynamaEsigi,
  sureli,
}: {
  uyarilar: HaftalikUyarilar;
  azOynamaEsigi: number;
  sureli: boolean;
}) {
  const bolumler: Bolum[] = [
    {
      anahtar: "az",
      baslik: "Az oynayanlar",
      aciklama: `Sezonda oynanabilir sürenin %${Math.round(azOynamaEsigi * 100)}'inden azını aldı`,
      nokta: "bg-amber-500",
      satirlar: uyarilar.azOynayanlar.map((s) => ({ sporcu: s, sag: `%${s.yuzde} · ${s.mac} maç` })),
    },
    {
      anahtar: "devam",
      baslik: "Antrenmana gelmeyenler",
      aciklama: "Üst üste en az 3 antrenmana gelmedi, bir arayın",
      nokta: "bg-red-600",
      satirlar: uyarilar.devamsizlar.map((s) => ({ sporcu: s, sag: `${s.arka} antrenman` })),
    },
    {
      anahtar: "yuk",
      baslik: "Yükü ani artanlar",
      aciklama: sureli
        ? "Bu hafta antrenman + maç süresi, son 4 haftanın 1,5 katından fazla"
        : "Bu hafta antrenman süresi, son 4 haftanın 1,5 katından fazla",
      nokta: "bg-sky-600",
      satirlar: uyarilar.yukuArtanlar.map((s) => ({ sporcu: s, sag: `${s.buHafta}′ / ort. ${s.ortalama}′` })),
    },
    {
      anahtar: "deg",
      baslik: "Değerlendirmesi eksik",
      aciklama: "Son 3 ayda dönem değerlendirmesi girilmedi",
      nokta: "bg-neutral-400",
      satirlar: uyarilar.degerlendirmesiEksik.map((s) => ({ sporcu: s, sag: s.yas_grubu ?? "" })),
    },
  ].filter((b) => b.satirlar.length > 0);

  if (bolumler.length === 0) {
    return (
      <div className="kart px-4 py-4">
        <p className="text-sm font-semibold text-neutral-900">Bu hafta her şey yolunda</p>
        <p className="mt-1 text-xs text-neutral-500">
          Az oynayan, üst üste gelmeyen ya da yükü ani artan sporcu yok.
        </p>
      </div>
    );
  }

  return (
    <div className="kart divide-y divide-neutral-100">
      {bolumler.map((b) => (
        <details key={b.anahtar} className="group px-4 py-3.5" open={b.anahtar !== "deg"}>
          <summary className="flex cursor-pointer list-none items-center gap-2.5">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.nokta}`} />
            <span className="flex-1 text-sm font-semibold text-neutral-900">{b.baslik}</span>
            <span className="rozet bg-neutral-100 text-neutral-700">{b.satirlar.length}</span>
            <span className="text-neutral-300 transition group-open:rotate-90">›</span>
          </summary>
          <p className="mt-1 pl-5 text-[11px] text-neutral-500">{b.aciklama}</p>
          <ul className="mt-2 space-y-1 pl-5">
            {b.satirlar.slice(0, GOSTERILEN).map(({ sporcu, sag }) => (
              <li key={sporcu.id}>
                <Link href={`/antrenor/sporcular/${sporcu.id}`} className="flex items-center gap-2 py-1 text-sm">
                  <span className="min-w-0 flex-1 truncate text-neutral-800">
                    {sporcu.ad} {sporcu.soyad}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-neutral-500">{sag}</span>
                </Link>
              </li>
            ))}
            {b.satirlar.length > GOSTERILEN ? (
              <li className="pt-0.5 text-xs text-neutral-500">ve {b.satirlar.length - GOSTERILEN} sporcu daha</li>
            ) : null}
          </ul>
        </details>
      ))}
    </div>
  );
}
