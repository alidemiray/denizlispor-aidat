import UstBaslik from "@/components/UstBaslik";
import SporcuForm from "@/components/SporcuForm";
import { yoneticiGerekli } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function YeniSporcu() {
  await yoneticiGerekli();
  return (
    <>
      <UstBaslik baslik="Yeni sporcu" geri="/yonetim/sporcular" />
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <SporcuForm />
      </div>
    </>
  );
}
