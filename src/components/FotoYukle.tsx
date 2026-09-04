"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function FotoYukle({
  sporcuId,
  basHarfler,
  fotoUrl,
}: {
  sporcuId: string;
  basHarfler: string;
  fotoUrl: string | null;
}) {
  const router = useRouter();
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function sec(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setHata(null);
    setBekle(true);

    const supabase = createClient();
    const uzanti = dosya.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const yol = `${sporcuId}/foto-${crypto.randomUUID()}.${uzanti}`;

    const { error: yuklemeHatasi } = await supabase.storage
      .from("spor-belgeler")
      .upload(yol, dosya, { contentType: dosya.type || undefined });
    if (yuklemeHatasi) {
      setBekle(false);
      setHata("Fotoğraf yüklenemedi.");
      return;
    }

    const { error } = await supabase.rpc("spor_sporcu_foto_kaydet", {
      p_id: sporcuId,
      p_yol: yol,
    });
    setBekle(false);
    if (error) {
      setHata(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <label className="relative cursor-pointer">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoUrl}
            alt="Sporcu fotoğrafı"
            className="h-24 w-24 rounded-full object-cover ring-4 ring-white/70"
          />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-yesil-600 text-2xl font-bold text-white ring-4 ring-white/70">
            {basHarfler}
          </span>
        )}
        <span className="absolute bottom-0 right-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-yesil-700 shadow">
          {bekle ? "…" : fotoUrl ? "değiştir" : "ekle"}
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={sec} disabled={bekle} />
      </label>
      {hata ? <p className="text-xs text-red-600">{hata}</p> : null}
    </div>
  );
}
