"use client";

import { useRouter } from "next/navigation";

export default function GeriDugmesi({ hedef }: { hedef: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      aria-label="Geri"
      onClick={() => {
        // Geçmişte sayfa varsa geri git; böylece cihazın geri tuşuyla
        // uygulama içi geri tuşu aynı yolu izler.
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(hedef);
        }
      }}
      className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg leading-none text-white active:scale-95"
    >
      ‹
    </button>
  );
}
