import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import CikisDugmesi from "@/components/CikisDugmesi";
import Ikon, { type IkonAdi } from "@/components/ui/Ikon";
import { yoneticiGerekli } from "@/lib/yetki";

export const dynamic = "force-dynamic";

const BOLUMLER: { yol: string; ad: string; aciklama: string; ikon: IkonAdi }[] = [
  { yol: "/yonetim/maclar", ad: "Maçlar", aciklama: "Fikstür, skor ve oynanan süreler", ikon: "futbol" },
  {
    yol: "/antrenor/antrenmanlar",
    ad: "Antrenman günlüğü",
    aciklama: "Haftalık kayıtlar ve günlük yoklama",
    ikon: "takvim",
  },
  {
    yol: "/antrenor/sporcular",
    ad: "Gelişim takibi",
    aciklama: "Değerlendirme, ölçüm, antrenör notları",
    ikon: "grafik",
  },
  {
    yol: "/yonetim/ayarlar",
    ad: "Ayarlar ve yetkiler",
    aciklama: "IBAN, iletişim, kullanıcı rolleri",
    ikon: "ayar",
  },
  {
    yol: "/yonetim/arsiv",
    ad: "Kayıt arşivi",
    aciklama: "Değiştirilen ve silinen kayıtların geçmişi",
    ikon: "arsiv",
  },
  { yol: "/panel", ad: "Veli panelim", aciklama: "Kendi çocuğunuzun ekranı", ikon: "kisiler" },
];

export default async function Daha() {
  const { profil } = await yoneticiGerekli();

  return (
    <>
      <UstBaslik baslik="Daha fazlası" altBaslik={profil?.ad_soyad ?? "Kulüp yöneticisi"} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="kart -mt-3 divide-y divide-neutral-100">
          {BOLUMLER.map((b) => (
            <Link key={b.yol} href={b.yol} className="flex items-center gap-3.5 px-4 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yesil-50 text-yesil-700">
                <Ikon ad={b.ikon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-neutral-900">{b.ad}</p>
                <p className="truncate text-xs text-neutral-500">{b.aciklama}</p>
              </div>
              <span className="text-neutral-300">›</span>
            </Link>
          ))}
        </div>

        <div className="mt-4">
          <CikisDugmesi tam />
        </div>
      </div>
    </>
  );
}
