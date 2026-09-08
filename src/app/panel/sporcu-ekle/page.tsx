import { redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuVeliForm from "@/components/SporcuVeliForm";
import { oturum } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function SporcuEkle() {
  const { rol } = await oturum();
  if (rol === "sporcu") redirect("/panel");

  return (
    <>
      <UstBaslik baslik="Sporcu ekle" altBaslik="Kulüp onayına gönderilir" geri="/panel" />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <SporcuVeliForm />
      </div>
    </>
  );
}
