"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";
import { BELGE_ADI, type BelgeTuru } from "@/lib/types";

const TURLER: BelgeTuru[] = ["lisans", "saglik", "kimlik", "veli_izin", "diger"];

export default function BelgeYukle({
  sporcuId,
  kullaniciId,
}: {
  sporcuId: string;
  kullaniciId: string;
}) {
  const router = useRouter();
  const yol = usePathname();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [tur, setTur] = useState<BelgeTuru>("lisans");
  const [dosya, setDosya] = useState<File | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!dosya) return setHata("Bir dosya seçin.");
    setHata(null);
    setBekle(true);

    const supabase = createClient();
    const uzanti = dosya.name.split(".").pop()?.toLowerCase() ?? "pdf";
    const yol = `${sporcuId}/${crypto.randomUUID()}.${uzanti}`;

    const { error: yuklemeHatasi } = await supabase.storage
      .from("spor-belgeler")
      .upload(yol, dosya, { contentType: dosya.type || undefined });

    if (yuklemeHatasi) {
      setBekle(false);
      setHata(`Dosya yüklenemedi: ${yuklemeHatasi.message}`);
      return;
    }

    const { error } = await supabase.from("spor_belgeler").insert({
      sporcu_id: sporcuId,
      tur,
      dosya_yolu: yol,
      dosya_adi: dosya.name,
      yukleyen_id: kullaniciId,
    });

    setBekle(false);
    if (error) {
      setHata(error.message);
      return;
    }
    setDosya(null);
    if (dosyaRef.current) dosyaRef.current.value = "";
    router.replace(`${yol}?kaydedildi=${encodeURIComponent("Belge yüklendi")}`);
    router.refresh();
  }

  return (
    <form onSubmit={gonder} className="space-y-3 px-4 py-4">
      {hata ? <Uyari>{hata}</Uyari> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiket" htmlFor="belgeTur">Belge türü</label>
          <select id="belgeTur" className="alan" value={tur}
            onChange={(e) => setTur(e.target.value as BelgeTuru)}>
            {TURLER.map((t) => (
              <option key={t} value={t}>{BELGE_ADI[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiket" htmlFor="belgeDosya">Dosya</label>
          <input
            id="belgeDosya"
            ref={dosyaRef}
            type="file"
            accept="image/*,application/pdf"
            className="alan file:mr-3 file:rounded-lg file:border-0 file:bg-yesil-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-yesil-700"
            onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <button className="btn-ikincil w-full" disabled={bekle || !dosya}>
        {bekle ? "Yükleniyor…" : "Belgeyi yükle"}
      </button>
      <p className="text-xs text-neutral-500">
        En fazla 10 MB. Belgeleri yalnızca siz ve kulüp yönetimi görebilir.
      </p>
    </form>
  );
}
