import { notFound, redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import SporcuVeliForm from "@/components/SporcuVeliForm";
import { createClient } from "@/lib/supabase/server";
import type { Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SporcuDuzenle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const sporcu = data as Sporcu;

  return (
    <>
      <UstBaslik
        baslik="Bilgileri düzenle"
        altBaslik={`${sporcu.ad} ${sporcu.soyad}`}
        geri={`/panel/sporcu/${id}`}
      />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <SporcuVeliForm sporcu={sporcu} />
      </div>
    </>
  );
}
