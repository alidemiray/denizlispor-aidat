import UstBaslik from "@/components/UstBaslik";
import { benimSporcularim } from "@/lib/veli";
import DuyuruKarti from "@/components/DuyuruKarti";
import OkunduIsaretle from "@/components/OkunduIsaretle";
import Ikon from "@/components/ui/Ikon";
import { oturum } from "@/lib/yetki";
import { duyurulariGetir } from "@/lib/duyuru";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Duyurular" };

export default async function Duyurular() {
  const { supabase, user, rol } = await oturum();
  const { data: sporcular } = await benimSporcularim<{ yas_grubu: string | null }>(supabase, user.id, "yas_grubu");

  const sonuc = await duyurulariGetir(supabase, {
    rol,
    kullaniciId: user.id,
    yasGruplari: (sporcular ?? []).map((s) => s.yas_grubu),
  });
  if (sonuc === null) notFound();

  const okunmamis = sonuc.duyurular.filter((d) => !sonuc.okunan.has(d.id)).map((d) => d.id);

  return (
    <>
      <UstBaslik baslik="Duyurular" altBaslik="Kulüpten haberler" geri="/panel" />
      <div className="mx-auto w-full max-w-3xl space-y-2.5 px-4 pb-28 pt-4">
        {sonuc.duyurular.length === 0 ? (
          <div className="kart px-5 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yesil-50 text-yesil-700">
              <Ikon ad="megafon" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-neutral-800">Şu an duyuru yok</p>
            <p className="mt-1.5 text-sm text-neutral-500">Kulüpten bir haber olduğunda burada göreceksiniz.</p>
          </div>
        ) : (
          sonuc.duyurular.map((d) => <DuyuruKarti key={d.id} d={d} yeni={!sonuc.okunan.has(d.id)} />)
        )}
      </div>
      <OkunduIsaretle idler={okunmamis} />
    </>
  );
}
