import { redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuVeliForm from "@/components/SporcuVeliForm";
import { oturum } from "@/lib/yetki";
import { kayitGruplari } from "@/lib/grup";

export const dynamic = "force-dynamic";

export default async function SporcuEkle({ searchParams }: { searchParams: Promise<{ grup?: string }> }) {
  const { rol, supabase, profil } = await oturum();
  if (rol === "sporcu") redirect("/panel");
  const { grup } = await searchParams;
  const gruplar = await kayitGruplari(supabase);

  return (
    <>
      <UstBaslik baslik="Sporcu ekle" altBaslik="Kulüp onayına gönderilir" geri="/panel" />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <SporcuVeliForm gruplar={gruplar} varsayilanGrup={grup ?? profil?.aktif_grup_id ?? null} />
      </div>
    </>
  );
}
