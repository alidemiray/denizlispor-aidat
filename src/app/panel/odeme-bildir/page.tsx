import UstBaslik from "@/components/UstBaslik";
import OdemeBildirForm from "@/components/OdemeBildirForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Aidat, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OdemeBildirSayfasi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: sporcularData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("veli_id", user.id)
    .order("ad");
  const sporcular = (sporcularData ?? []) as Sporcu[];

  const idler = sporcular.map((s) => s.id);
  const { data: aidatData } = idler.length
    ? await supabase
        .from("spor_aidatlar")
        .select("*")
        .in("sporcu_id", idler)
        .eq("durum", "bekliyor")
        .order("donem")
    : { data: [] as Aidat[] };

  const { data: ayarData } = await supabase.from("spor_ayarlar").select("*");
  const ayarlar = Object.fromEntries(
    (ayarData ?? []).map((a: { anahtar: string; deger: string | null }) => [
      a.anahtar,
      a.deger ?? "",
    ]),
  );

  return (
    <>
      <UstBaslik baslik="Ödeme bildir" altBaslik="Havale/EFT dekontunuzu yükleyin" geri="/panel" />
      <div className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4">
        <OdemeBildirForm
          sporcular={sporcular}
          aidatlar={(aidatData ?? []) as Aidat[]}
          ayarlar={ayarlar}
          kullaniciId={user.id}
        />
      </div>
    </>
  );
}
