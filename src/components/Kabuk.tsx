import AltMenu from "@/components/AltMenu";
import YanMenu from "@/components/YanMenu";
import CikisDugmesi from "@/components/CikisDugmesi";
import SurumNotlari from "@/components/SurumNotlari";
import { rozetEkle, type Menu } from "@/lib/menuler";
import { createClient } from "@/lib/supabase/server";
import { okunmamisSayisi } from "@/lib/bildirim";
import { rolAdi } from "@/lib/roller";
import GrupSecici from "@/components/GrupSecici";
import { gruplarim, seciliGrup } from "@/lib/grup";

/**
 * Girişli ekranların ortak kabuğu.
 * Telefon / tablet: içerik + alttaki sekme çubuğu.
 * Geniş ekran (≥1024 px): solda sabit kenar menüsü, içerik sağda; alt çubuk gizli.
 */
export default async function Kabuk({
  menu,
  rol,
  kullanici,
  children,
}: {
  menu: Menu;
  rol: string;
  kullanici: string;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const [okunmamis, gruplar] = await Promise.all([okunmamisSayisi(supabase), gruplarim(supabase)]);
  const yan = rozetEkle(menu, okunmamis).yan;
  const grup = seciliGrup(gruplar);
  const coklu = gruplar.length > 1;
  return (
    <div className={`kabuk min-h-dvh bg-zemin ${coklu ? "grup-serit-var" : ""}`}>
      <YanMenu
        gruplar={yan}
        kullanici={kullanici}
        rolAdi={rolAdi(rol) + (grup && coklu ? ` · ${grup.ad}` : "")}
        ust={<GrupSecici gruplar={gruplar} gorunum="yan" />}
        alt={<CikisDugmesi tam />}
      />
      <div className="lg:pl-64">
        <GrupSecici gruplar={gruplar} gorunum="ust" />
        {children}
      </div>
      <AltMenu ogeler={menu.alt} />
      <SurumNotlari rol={rol} />
    </div>
  );
}
