import { ayarlariOku } from "@/lib/grup";
import { benimSporcularim } from "@/lib/veli";
import UstBaslik from "@/components/UstBaslik";
import OdemeBildirForm from "@/components/OdemeBildirForm";
import { paraEkraniGerekli } from "@/lib/yetki";
import { redirect } from "next/navigation";
import type { Aidat, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OdemeBildirSayfasi() {
  const { supabase, user } = await paraEkraniGerekli();

  const { data: sporcularData } = await benimSporcularim(supabase, user.id, "*", { sporcuDahil: false });
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

  const ayarlar = await ayarlariOku(supabase);


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
