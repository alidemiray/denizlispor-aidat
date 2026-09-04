import KaydetDugmesi from "@/components/KaydetDugmesi";

export default function CikisDugmesi({ tam }: { tam?: boolean }) {
  return (
    <form action="/cikis" method="post" className={tam ? "w-full" : undefined}>
      <KaydetDugmesi
        bekleyen="Çıkılıyor…"
        className={
          tam
            ? "btn w-full bg-white text-red-600 ring-1 ring-red-600/20"
            : "rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/90 active:scale-95"
        }
      >
        Çıkış
      </KaydetDugmesi>
    </form>
  );
}
