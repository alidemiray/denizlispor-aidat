import { redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuVeliForm from "@/components/SporcuVeliForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SporcuEkle() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  return (
    <>
      <UstBaslik baslik="Sporcu ekle" altBaslik="Kulüp onayına gönderilir" geri="/panel" />
      <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
        <SporcuVeliForm />
      </div>
    </>
  );
}
