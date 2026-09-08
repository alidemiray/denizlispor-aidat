import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import CikisDugmesi from "@/components/CikisDugmesi";
import Ikon, { type IkonAdi } from "@/components/ui/Ikon";
import { oturum } from "@/lib/yetki";

export const dynamic = "force-dynamic";

const ROL_ADI: Record<string, string> = {
  veli: "Veli",
  antrenor: "Antrenör",
  yonetici: "Kulüp yöneticisi",
};

export default async function Hesap() {
  const { user, profil, rol } = await oturum();

  const baglantilar: { yol: string; ad: string; aciklama: string; ikon: IkonAdi }[] = [
    { yol: "/panel", ad: "Sporcularım", aciklama: "Profil, aidat, gelişim", ikon: "kisiler" },
    {
      yol: "/panel/antrenman",
      ad: "Antrenman günlüğü",
      aciklama: "Hafta hafta yapılan çalışmalar",
      ikon: "takvim",
    },
    {
      yol: "/panel/aidat-akisi",
      ad: "Aidat akış tablosu",
      aciklama: "Kulüp geneli aylık durum",
      ikon: "grafik",
    },
  ];

  if (rol === "yonetici") {
    baglantilar.push({
      yol: "/yonetim",
      ad: "Kulüp yönetimi",
      aciklama: "Sporcular, aidatlar, maçlar",
      ikon: "kalkan",
    });
  }
  if (rol === "antrenor") {
    baglantilar.push({
      yol: "/antrenor",
      ad: "Antrenör paneli",
      aciklama: "Antrenman, yoklama, gelişim",
      ikon: "pano",
    });
  }

  return (
    <>
      <UstBaslik baslik="Hesabım" altBaslik={ROL_ADI[rol] ?? "Veli"} />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="kart -mt-3 flex items-center gap-4 px-4 py-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yesil-500 to-yesil-700 text-lg font-bold text-white">
            {(profil?.ad_soyad ?? user.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-neutral-900">
              {profil?.ad_soyad || "İsim girilmemiş"}
            </p>
            <p className="truncate text-sm text-neutral-500">{user.email}</p>
            {profil?.telefon ? (
              <p className="truncate text-xs text-neutral-400">{profil.telefon}</p>
            ) : null}
          </div>
        </div>

        <div className="kart mt-4 divide-y divide-neutral-100">
          {baglantilar.map((b) => (
            <Link key={b.yol + b.ad} href={b.yol} className="flex items-center gap-3.5 px-4 py-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
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

        <div className="kart mt-4 px-4 py-4">
          <p className="text-sm font-semibold text-neutral-900">Uygulamayı telefona ekleyin</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Tarayıcı menüsünden <b>&ldquo;Ana ekrana ekle&rdquo;</b> deyin. Denizlispor arması
            simge olur, uygulama tam ekran açılır.
          </p>
        </div>

        <div className="mt-4">
          <CikisDugmesi tam />
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-neutral-400">
          Denizlispor Altyapı · Sporcu Takip
        </p>
      </div>
    </>
  );
}
