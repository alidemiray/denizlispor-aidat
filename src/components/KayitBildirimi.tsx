"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function KayitBildirimi() {
  const params = useSearchParams();
  const router = useRouter();
  const yol = usePathname();
  const mesaj = params.get("kaydedildi");
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => {
    if (!mesaj) {
      setGorunur(false);
      return;
    }
    setGorunur(true);
    const t = setTimeout(() => {
      setGorunur(false);
      router.replace(yol);
    }, 3200);
    return () => clearTimeout(t);
  }, [mesaj, router, yol]);

  if (!mesaj || !gorunur) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
    >
      <div className="yazi-giris flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px]">
          ✓
        </span>
        {mesaj}
      </div>
    </div>
  );
}
