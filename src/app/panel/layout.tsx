import AltMenu, { type MenuOgesi } from "@/components/AltMenu";

const MENU: MenuOgesi[] = [
  { yol: "/panel", ad: "Ana sayfa", ikon: "ev" },
  { yol: "/panel/antrenman", ad: "Antrenman", ikon: "takvim" },
  { yol: "/panel/maclar", ad: "Maçlar", ikon: "futbol" },
  { yol: "/panel/hesap", ad: "Hesabım", ikon: "kisiler" },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f4f6f5]">
      {children}
      <AltMenu ogeler={MENU} />
    </div>
  );
}
