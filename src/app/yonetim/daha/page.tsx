import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import CikisDugmesi from "@/components/CikisDugmesi";
import Ikon, { type IkonAdi } from "@/components/ui/Ikon";
import { yoneticiGerekli } from "@/lib/yetki";
import { kulupGeneliMi } from "@/lib/roller";

export const dynamic = "force-dynamic";

const BOLUMLER: { yol: string; ad: string; aciklama: string; ikon: IkonAdi }[] = [
  {
    yol: "/antrenor/duyurular",
    ad: "Duyurular",
    aciklama: "Velilere ve sporculara haber, okunma takibi",
    ikon: "megafon",
  },
  {
    yol: "/yonetim/maclar",
    ad: "Maçlar",
    aciklama: "Fikstür, skor ve oynanan süreler",
    ikon: "futbol",
  },
  {
    yol: "/antrenor/antrenmanlar",
    ad: "Antrenman günlüğü",
    aciklama: "Haftalık kayıtlar ve yoklama",
    ikon: "takvim",
  },
  {
    yol: "/antrenor/sporcular",
    ad: "Gelişim takibi",
    aciklama: "Değerlendirme, ölçüm, antrenör notları",
    ikon: "grafik",
  },
  {
    yol: "/yonetim/on-kayit",
    ad: "Ön kayıt ve adaylar",
    aciklama: "Başvuru QR'ı ve afişi, deneme dersi, kesin kayıt",
    ikon: "artı",
  },
  {
    yol: "/yonetim/zimmet",
    ad: "Zimmet",
    aciklama: "Forma, eşofman, top: kimde ne var, iadesi geciken",
    ikon: "kalkan",
  },
  {
    yol: "/yonetim/sezonlar",
    ad: "Sezonlar ve arşiv",
    aciklama: "Sezonu mühürle, anılar, kulüpten yükselenler",
    ikon: "kalkan",
  },
  {
    yol: "/yonetim/kasa",
    ad: "Kasa",
    aciklama: "Havuz, kulübe aktarım ve giderler",
    ikon: "pano",
  },
  {
    yol: "/yonetim/ayarlar",
    ad: "Ayarlar ve yetkiler",
    aciklama: "IBAN, iletişim, roller ve yetki talepleri",
    ikon: "ayar",
  },
  {
    yol: "/yonetim/disa-aktar",
    ad: "Dışa aktar",
    aciklama: "Sporcu, aidat, ödeme, kasa ve yoklama listeleri (Excel)",
    ikon: "indir",
  },
  {
    yol: "/yonetim/arsiv",
    ad: "Kayıt arşivi",
    aciklama: "Değiştirilen ve silinen kayıtların geçmişi",
    ikon: "arsiv",
  },
  {
    yol: "/panel",
    ad: "Veli panelim",
    aciklama: "Kendi çocuğunuzun ekranı",
    ikon: "kisiler",
  },
];

export default async function Daha() {
  const { profil, rol } = await yoneticiGerekli();
  const bolumler = kulupGeneliMi(rol)
    ? [
        {
          yol: "/yonetim/gruplar",
          ad: "Gruplar",
          aciklama: "U11, U12… grupları, kayıt bağlantıları, sezon sonu üst klasmana geçiş",
          ikon: "kisiler" as IkonAdi,
        },
        ...BOLUMLER,
      ]
    : BOLUMLER;

  return (
    <>
      <UstBaslik baslik="Daha fazlası" altBaslik={profil?.ad_soyad ?? "Kulüp yöneticisi"} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="kart -mt-3 divide-y divide-neutral-100">
          {bolumler.map((b) => (
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
