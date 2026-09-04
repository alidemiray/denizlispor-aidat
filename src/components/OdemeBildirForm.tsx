"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";
import { donemAdi, tl } from "@/lib/format";
import type { Aidat, Sporcu } from "@/lib/types";

export default function OdemeBildirForm({
  sporcular,
  aidatlar,
  ayarlar,
  kullaniciId,
}: {
  sporcular: Sporcu[];
  aidatlar: Aidat[];
  ayarlar: Record<string, string>;
  kullaniciId: string;
}) {
  const router = useRouter();
  const [sporcuId, setSporcuId] = useState(sporcular[0]?.id ?? "");
  const [aidatId, setAidatId] = useState("");
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [yontem, setYontem] = useState("havale");
  const [aciklama, setAciklama] = useState("");
  const [dosya, setDosya] = useState<File | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);
  const [tamam, setTamam] = useState(false);

  const sporcuAidatlari = useMemo(
    () => aidatlar.filter((a) => a.sporcu_id === sporcuId),
    [aidatlar, sporcuId],
  );

  function aidatSec(id: string) {
    setAidatId(id);
    const a = sporcuAidatlari.find((x) => x.id === id);
    if (a) setTutar(String(a.tutar));
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);

    const tutarSayi = Number(tutar.replace(",", "."));
    if (!sporcuId) return setHata("Sporcu seçin.");
    if (!tutarSayi || tutarSayi <= 0) return setHata("Geçerli bir tutar girin.");

    setBekle(true);
    const supabase = createClient();

    let dekontYolu: string | null = null;
    if (dosya) {
      const uzanti = dosya.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const yol = `${sporcuId}/${crypto.randomUUID()}.${uzanti}`;
      const { error: yuklemeHatasi } = await supabase.storage
        .from("spor-dekontlar")
        .upload(yol, dosya, { upsert: false, contentType: dosya.type || undefined });
      if (yuklemeHatasi) {
        setBekle(false);
        setHata(`Dekont yüklenemedi: ${yuklemeHatasi.message}`);
        return;
      }
      dekontYolu = yol;
    }

    const { error } = await supabase.from("spor_odemeler").insert({
      sporcu_id: sporcuId,
      aidat_id: aidatId || null,
      tutar: tutarSayi,
      odeme_tarihi: tarih,
      yontem,
      aciklama: aciklama.trim() || null,
      dekont_yolu: dekontYolu,
      durum: "beklemede",
      bildiren_id: kullaniciId,
    });

    if (error) {
      setBekle(false);
      setHata(error.message);
      return;
    }

    setTamam(true);
    setBekle(false);
    router.refresh();
  }

  if (sporcular.length === 0) {
    return (
      <Uyari tip="bilgi">
        Hesabınıza tanımlı sporcu bulunmadığı için ödeme bildirimi yapamazsınız.
      </Uyari>
    );
  }

  if (tamam) {
    return (
      <div className="space-y-4">
        <Uyari tip="basari">
          Ödeme bildiriminiz alındı. Kulüp yönetimi dekontu inceledikten sonra
          onaylayacak ve aidat durumunuz güncellenecektir.
        </Uyari>
        <button className="btn-birincil w-full" onClick={() => router.push("/panel")}>
          Panele dön
        </button>
      </div>
    );
  }

  const iban = ayarlar.iban?.trim();

  return (
    <form onSubmit={gonder} className="space-y-5">
      {iban ? (
        <div className="kart px-4 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Kulüp hesap bilgileri
          </p>
          <p className="mt-2 select-all font-mono text-sm font-semibold tracking-tight text-neutral-900">
            {iban}
          </p>
          {ayarlar.hesap_sahibi ? (
            <p className="text-sm text-neutral-600">{ayarlar.hesap_sahibi}</p>
          ) : null}
          {ayarlar.banka_adi ? (
            <p className="text-xs text-neutral-500">{ayarlar.banka_adi}</p>
          ) : null}
          {ayarlar.odeme_aciklamasi ? (
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              {ayarlar.odeme_aciklamasi}
            </p>
          ) : null}
        </div>
      ) : null}

      {hata ? <Uyari>{hata}</Uyari> : null}

      <div className="kart space-y-4 px-4 py-5">
        <div>
          <label className="etiket" htmlFor="sporcu">Sporcu</label>
          <select
            id="sporcu"
            className="alan"
            value={sporcuId}
            onChange={(e) => {
              setSporcuId(e.target.value);
              setAidatId("");
            }}
          >
            {sporcular.map((s) => (
              <option key={s.id} value={s.id}>
                {s.ad} {s.soyad}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiket" htmlFor="aidat">Hangi dönem için?</label>
          <select
            id="aidat"
            className="alan"
            value={aidatId}
            onChange={(e) => aidatSec(e.target.value)}
          >
            <option value="">Belirtmek istemiyorum</option>
            {sporcuAidatlari.map((a) => (
              <option key={a.id} value={a.id}>
                {donemAdi(a.donem)} — {tl(a.tutar)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="tutar">Tutar (₺)</label>
            <input
              id="tutar"
              className="alan"
              inputMode="decimal"
              required
              value={tutar}
              onChange={(e) => setTutar(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="etiket" htmlFor="tarih">Ödeme tarihi</label>
            <input
              id="tarih"
              className="alan"
              type="date"
              required
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="etiket" htmlFor="yontem">Ödeme yöntemi</label>
          <select
            id="yontem"
            className="alan"
            value={yontem}
            onChange={(e) => setYontem(e.target.value)}
          >
            <option value="havale">Havale / EFT</option>
            <option value="nakit">Nakit</option>
            <option value="kart">Kredi kartı</option>
            <option value="diger">Diğer</option>
          </select>
        </div>

        <div>
          <label className="etiket" htmlFor="dekont">Dekont (fotoğraf veya PDF)</label>
          <input
            id="dekont"
            className="alan file:mr-3 file:rounded-lg file:border-0 file:bg-yesil-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-yesil-700"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1.5 text-xs text-neutral-500">
            En fazla 10 MB. Dekont yüklemek onay sürecini hızlandırır.
          </p>
        </div>

        <div>
          <label className="etiket" htmlFor="aciklama">Açıklama (isteğe bağlı)</label>
          <textarea
            id="aciklama"
            className="alan min-h-20 resize-y"
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="Eklemek istediğiniz not"
          />
        </div>
      </div>

      <button className="btn-birincil w-full" disabled={bekle}>
        {bekle ? "Gönderiliyor…" : "Bildirimi gönder"}
      </button>
    </form>
  );
}
