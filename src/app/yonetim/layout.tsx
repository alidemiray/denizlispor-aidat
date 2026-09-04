import Link from "next/link";
import { yoneticiGerekli } from "@/lib/yetki";

const SEKMELER = [
  { yol: "/yonetim", ad: "Özet" },
  { yol: "/yonetim/sporcular", ad: "Sporcular" },
  { yol: "/yonetim/aidatlar", ad: "Aidatlar" },
  { yol: "/yonetim/odemeler", ad: "Ödemeler" },
  { yol: "/yonetim/maclar", ad: "Maçlar" },
  { yol: "/yonetim/ayarlar", ad: "Ayarlar" },
];

export default async function YonetimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await yoneticiGerekli();
  return (
    <div className="min-h-dvh bg-[#f4f6f5]">
      <nav className="sticky top-0 z-30 -mt-px overflow-x-auto border-b border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl gap-1 px-3 py-2">
          <Link
            href="/panel"
            className="whitespace-nowrap rounded-full bg-yesil-50 px-3.5 py-1.5 text-sm font-semibold text-yesil-700"
          >
            ‹ Veli panelim
          </Link>
          {SEKMELER.map((s) => (
            <Link
              key={s.yol}
              href={s.yol}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-yesil-50 hover:text-yesil-700"
            >
              {s.ad}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
