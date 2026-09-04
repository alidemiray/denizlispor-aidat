import AltMenu, { type MenuOgesi } from "@/components/AltMenu";
import { personelGerekli } from "@/lib/yetki";

const MENU: MenuOgesi[] = [
  { yol: "/antrenor", ad: "Bugün", ikon: "ev" },
  { yol: "/antrenor/antrenmanlar", ad: "Antrenman", ikon: "takvim" },
  { yol: "/antrenor/sporcular", ad: "Sporcular", ikon: "kisiler" },
  { yol: "/panel", ad: "Veli panelim", ikon: "daha" },
];

export default async function AntrenorLayout({ children }: { children: React.ReactNode }) {
  await personelGerekli();
  return (
    <div className="min-h-dvh bg-[#f4f6f5]">
      {children}
      <AltMenu ogeler={MENU} />
    </div>
  );
}
