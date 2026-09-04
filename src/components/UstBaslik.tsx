import Image from "next/image";
import GeriDugmesi from "@/components/GeriDugmesi";

export default function UstBaslik({
  baslik,
  altBaslik,
  geri,
  sag,
}: {
  baslik: string;
  altBaslik?: string;
  geri?: string;
  sag?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-gradient-to-b from-yesil-700 to-yesil-800 px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] text-white shadow-lg shadow-yesil-900/10">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        {geri ? (
          <GeriDugmesi hedef={geri} />
        ) : (
          <Image src="/icons/icon-512.png" alt="Denizlispor" width={38} height={38} priority />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight">{baslik}</h1>
          {altBaslik ? (
            <p className="truncate text-xs text-white/65">{altBaslik}</p>
          ) : null}
        </div>
        {sag}
      </div>
    </header>
  );
}
