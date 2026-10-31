import Kabuk from "@/components/Kabuk";
import { oturum } from "@/lib/yetki";
import { rizaGerekli } from "@/lib/riza";
import { anaEkranYolu, kasaGorebilirMi, personelMi } from "@/lib/roller";
import { SPORCU_MENUSU, VELI_MENUSU, type Menu } from "@/lib/menuler";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { rol, profil, user } = await oturum();
  await rizaGerekli();
  const ham = rol === "sporcu" ? SPORCU_MENUSU : VELI_MENUSU;
  // Antrenör veli panelinde kulüp kasasını görmez
  const temel: Menu = kasaGorebilirMi(rol)
    ? ham
    : { ...ham, yan: ham.yan.map((g) => ({ ...g, ogeler: g.ogeler.filter((o) => o.yol !== "/panel/kasa") })) };
  // Personel kendi paneline geniş ekranda tek tıkla dönebilsin
  const menu: Menu = personelMi(rol)
    ? {
        alt: temel.alt,
        yan: [
          ...temel.yan,
          { baslik: "Kulüp", ogeler: [{ yol: anaEkranYolu(rol), ad: "Personel paneline dön", ikon: "pano" }] },
        ],
      }
    : temel;
  return (
    <Kabuk menu={menu} rol={rol} kullanici={profil?.ad_soyad ?? user.email ?? ""}>
      {children}
    </Kabuk>
  );
}
