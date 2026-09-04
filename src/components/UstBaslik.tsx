import Image from "next/image";
import GeriDugmesi from "@/components/GeriDugmesi";

export default function UstBaslik({
  baslik,
  altBaslik,
  geri,
  sag,
  genis,
  children,
}: {
  baslik: string;
  altBaslik?: string;
  geri?: string;
  sag?: React.ReactNode;
  genis?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-yesil-600 via-yesil-700 to-neutral-900 px-4 pb-6 pt-[max(0.9rem,env(safe-area-inset-top))] text-white shadow-lg shadow-yesil-900/15">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-white/[0.07]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 top-12 h-32 w-32 rounded-full bg-white/[0.05]"
      />

      <div className={`relative mx-auto flex w-full items-center gap-3 ${genis ? "max-w-5xl" : "max-w-3xl"}`}>
        {geri ? (
          <GeriDugmesi hedef={geri} />
        ) : (
          <Image
            src="/icons/icon-512.png"
            alt="Denizlispor"
            width={40}
            height={40}
            priority
            className="drop-shadow"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold leading-tight tracking-tight">{baslik}</h1>
          {altBaslik ? (
            <p className="truncate text-xs font-medium text-white/60">{altBaslik}</p>
          ) : null}
        </div>
        {sag}
      </div>

      {children ? (
        <div className={`relative mx-auto mt-5 w-full ${genis ? "max-w-5xl" : "max-w-3xl"}`}>
          {children}
        </div>
      ) : null}
    </header>
  );
}
