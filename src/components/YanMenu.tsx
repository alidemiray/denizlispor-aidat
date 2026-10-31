"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Ikon from "@/components/ui/Ikon";
import { aktifYol, type MenuGrubu } from "@/lib/menuler";
import { yerDegistirIsaretle } from "@/lib/gezinme";
import { KULUP, KULUP_MANSET } from "@/kulup";

/** Geniş ekran (≥1024 px) sol kenar menüsü. Telefonda gizli; orada AltMenu çalışır. */
export default function YanMenu({
  gruplar,
  kullanici,
  rolAdi,
  ust,
  alt,
}: {
  gruplar: MenuGrubu[];
  kullanici: string;
  rolAdi: string;
  /** Logonun altında (ör. grup seçici) */
  ust?: React.ReactNode;
  alt?: React.ReactNode;
}) {
  const yol = usePathname();
  const aktif = aktifYol(
    yol,
    gruplar.flatMap((g) => g.ogeler.map((o) => o.yol)),
  );

  return (
    <aside
      aria-label="Ana menü"
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.06] bg-siyah print:hidden lg:flex"
    >
      <Link href="/git" className="flex items-center gap-3 px-5 pb-5 pt-5">
        <Image
          src={KULUP.arma}
          unoptimized={KULUP.arma.endsWith(".svg")}
          alt=""
          width={40}
          height={40}
          priority
        />
        <span className="min-w-0">
          <span className="manset block truncate text-[22px] leading-none text-white">{KULUP_MANSET}</span>
          <span className="block truncate font-mono text-[10px] tracking-[0.14em] text-yesil-500">
            {KULUP.etiket.toLocaleUpperCase("tr-TR")}
          </span>
        </span>
      </Link>

      {ust}

      <nav className="ince-kaydirma flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {gruplar.map((g, i) => (
          <div key={g.baslik ?? i}>
            {g.baslik ? <p className="bolum-basligi mb-1 px-3">{g.baslik}</p> : null}
            <ul className="space-y-0.5">
              {g.ogeler.map((o) => {
                const secili = aktif === o.yol;
                return (
                  <li key={o.yol}>
                    <Link
                      href={o.yol}
                      replace
                      aria-current={secili ? "page" : undefined}
                      onClick={() => {
                        if (yol !== o.yol) yerDegistirIsaretle();
                      }}
                      className={`flex min-h-9 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150 ${
                        secili
                          ? "bg-yesil-500/15 font-bold text-yesil-500"
                          : "font-medium text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-900"
                      }`}
                    >
                      <Ikon ad={o.ikon} className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate">{o.ad}</span>
                      {o.rozet ? (
                        <span className="ml-auto rounded-full bg-yesil-500 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none text-anametin">
                          {o.rozet > 99 ? "99+" : o.rozet}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] px-4 py-4">
        <p className="truncate text-sm font-semibold text-neutral-900">{kullanici}</p>
        <p className="mb-3 truncate text-xs text-neutral-500">{rolAdi}</p>
        {alt}
      </div>
    </aside>
  );
}
