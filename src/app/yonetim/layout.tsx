import Kabuk from "@/components/Kabuk";
import { yoneticiGerekli } from "@/lib/yetki";
import { rizaGerekli } from "@/lib/riza";
import { KULUP_GENELI_YOLLARI, YONETIM_MENUSU, menuSuz } from "@/lib/menuler";
import { kulupGeneliMi } from "@/lib/roller";

export default async function YonetimLayout({ children }: { children: React.ReactNode }) {
  const { rol, profil, user } = await yoneticiGerekli();
  await rizaGerekli();
  return (
    <Kabuk menu={kulupGeneliMi(rol) ? YONETIM_MENUSU : menuSuz(YONETIM_MENUSU, KULUP_GENELI_YOLLARI)} rol={rol} kullanici={profil?.ad_soyad ?? user.email ?? ""}>
      {children}
    </Kabuk>
  );
}
