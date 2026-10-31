import Image from "next/image";
import GeriDugmesi from "@/components/GeriDugmesi";
import { KULUP } from "@/kulup";

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
    <header className="ust-baslik relative overflow-hidden rounded-b-[28px] bg-siyah px-4 pb-6 pt-[max(0.9rem,env(safe-area-inset-top))] text-white shadow-lg shadow-black/20">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full border border-yesil-500/25"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-6 h-24 w-24 rounded-full border border-yesil-500/20"
      />

      <div className={`relative mx-auto flex w-full items-center gap-3 ${genis ? "max-w-5xl" : "max-w-3xl"}`}>
        {geri ? (
          <GeriDugmesi hedef={geri} />
        ) : (
          <Image
            src={KULUP.arma} unoptimized={KULUP.arma.endsWith(".svg")}
            alt={`${KULUP.kisaAd} arması`}
            width={40}
            height={40}
            priority
            className="ust-arma drop-shadow"
          />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="manset truncate text-[26px]">{baslik}</h1>
          {altBaslik ? (
            <p className="mt-1 truncate font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-yesil-500">{altBaslik}</p>
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
