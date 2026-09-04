"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Ikon, { type IkonAdi } from "@/components/ui/Ikon";

export type MenuOgesi = { yol: string; ad: string; ikon: IkonAdi; tamEslesme?: boolean };

export default function AltMenu({ ogeler }: { ogeler: MenuOgesi[] }) {
  const yol = usePathname();

  // En uzun eşleşen yol aktif kabul edilir; böylece /panel/sporcu/x -> "Ana sayfa",
  // /panel/antrenman -> "Antrenman" olur.
  const aktifOge = ogeler.reduce<MenuOgesi | null>((enIyi, o) => {
    const eslesir = yol === o.yol || yol.startsWith(`${o.yol}/`);
    if (!eslesir) return enIyi;
    return !enIyi || o.yol.length > enIyi.yol.length ? o : enIyi;
  }, null);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/92 backdrop-blur-lg">
      <div
        className="mx-auto flex w-full max-w-3xl items-stretch"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        {ogeler.map((o) => {
          const aktif = aktifOge?.yol === o.yol;
          return (
            <Link
              key={o.yol}
              href={o.yol}
              className="group relative flex flex-1 flex-col items-center gap-1 px-1 pb-1.5 pt-2.5"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
                  aktif ? "bg-yesil-600/10 text-yesil-700" : "text-neutral-400"
                }`}
              >
                <Ikon ad={o.ikon} className="h-[22px] w-[22px]" />
              </span>
              <span
                className={`text-[10.5px] font-semibold leading-none tracking-tight ${
                  aktif ? "text-yesil-700" : "text-neutral-500"
                }`}
              >
                {o.ad}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
