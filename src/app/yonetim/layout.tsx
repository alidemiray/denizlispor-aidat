import AltMenu, { type MenuOgesi } from "@/components/AltMenu";
import { yoneticiGerekli } from "@/lib/yetki";

const MENU: MenuOgesi[] = [
  { yol: "/yonetim", ad: "Özet", ikon: "ev" },
  { yol: "/yonetim/sporcular", ad: "Sporcular", ikon: "kisiler" },
  { yol: "/yonetim/aidatlar", ad: "Aidat", ikon: "cuzdan" },
  { yol: "/yonetim/odemeler", ad: "Ödeme", ikon: "grafik" },
  { yol: "/yonetim/daha", ad: "Daha", ikon: "daha" },
];

export default async function YonetimLayout({ children }: { children: React.ReactNode }) {
  await yoneticiGerekli();
  return (
    <div className="min-h-dvh bg-[#f4f6f5]">
      {children}
      <AltMenu ogeler={MENU} />
    </div>
  );
}
