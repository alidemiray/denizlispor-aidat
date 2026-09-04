"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";
import { MEVKILER, type Sporcu } from "@/lib/types";

export default function SporcuVeliForm({ sporcu }: { sporcu?: Sporcu }) {
  const router = useRouter();
  const duzenleme = Boolean(sporcu);

  const [ad, setAd] = useState(sporcu?.ad ?? "");
  const [soyad, setSoyad] = useState(sporcu?.soyad ?? "");
  const [dogum, setDogum] = useState(sporcu?.dogum_tarihi ?? "");
  const [mevki, setMevki] = useState(sporcu?.mevki ?? "");
  const [okul, setOkul] = useState(sporcu?.okul ?? "");
  const [ayak, setAyak] = useState(sporcu?.ayak ?? "");
  const [veliAd, setVeliAd] = useState(sporcu?.veli_ad_soyad ?? "");
  const [veliTel, setVeliTel] = useState(sporcu?.veli_telefon ?? "");
  const [acilKisi, setAcilKisi] = useState(sporcu?.acil_kisi ?? "");
  const [acilTel, setAcilTel] = useState(sporcu?.acil_telefon ?? "");
  const [notlar, setNotlar] = useState(sporcu?.notlar ?? "");
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekle(true);
    const supabase = createClient();

    const ortak = {
      p_ad: ad,
      p_soyad: soyad,
      p_dogum_tarihi: dogum || null,
      p_mevki: mevki,
      p_okul: okul,
      p_ayak: ayak,
      p_veli_ad_soyad: veliAd,
      p_veli_telefon: veliTel,
      p_acil_kisi: acilKisi,
      p_acil_telefon: acilTel,
      p_notlar: notlar,
    };

    const { error } = duzenleme
      ? await supabase.rpc("spor_sporcu_veli_guncelle", { p_id: sporcu!.id, ...ortak })
      : await supabase.rpc("spor_sporcu_on_kayit", ortak);

    if (error) {
      setBekle(false);
      setHata(error.message);
      return;
    }

    router.push(duzenleme ? `/panel/sporcu/${sporcu!.id}` : "/panel");
    router.refresh();
  }

  return (
    <form onSubmit={gonder} className="space-y-5">
      {hata ? <Uyari>{hata}</Uyari> : null}

      {!duzenleme ? (
        <Uyari tip="bilgi">
          Girdiğiniz kayıt <b>onay bekliyor</b> olarak kulübe iletilir. Kulüp onaylayana
          kadar aidat tahakkuku yapılmaz.
        </Uyari>
      ) : null}

      <div className="kart space-y-4 px-4 py-5">
        <p className="text-sm font-bold text-neutral-900">Sporcu bilgileri</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="ad">Ad *</label>
            <input id="ad" className="alan" required value={ad}
              onChange={(e) => setAd(e.target.value)} />
          </div>
          <div>
            <label className="etiket" htmlFor="soyad">Soyad *</label>
            <input id="soyad" className="alan" required value={soyad}
              onChange={(e) => setSoyad(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="dogum">Doğum tarihi</label>
            <input id="dogum" type="date" className="alan" value={dogum}
              onChange={(e) => setDogum(e.target.value)} />
          </div>
          <div>
            <label className="etiket" htmlFor="ayak">Kullandığı ayak</label>
            <select id="ayak" className="alan" value={ayak}
              onChange={(e) => setAyak(e.target.value)}>
              <option value="">Belirtilmedi</option>
              <option value="Sağ">Sağ</option>
              <option value="Sol">Sol</option>
              <option value="Çift ayak">Çift ayak</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="mevki">Mevki</label>
            <select id="mevki" className="alan" value={mevki}
              onChange={(e) => setMevki(e.target.value)}>
              <option value="">Belirtilmedi</option>
              {MEVKILER.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="etiket" htmlFor="okul">Okulu</label>
            <input id="okul" className="alan" value={okul}
              onChange={(e) => setOkul(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="kart space-y-4 px-4 py-5">
        <p className="text-sm font-bold text-neutral-900">İletişim</p>

        <div>
          <label className="etiket" htmlFor="veliAd">Veli adı soyadı</label>
          <input id="veliAd" className="alan" value={veliAd}
            onChange={(e) => setVeliAd(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="veliTel">Veli telefonu</label>
            <input id="veliTel" type="tel" className="alan" value={veliTel}
              onChange={(e) => setVeliTel(e.target.value)} placeholder="05xx xxx xx xx" />
          </div>
          <div>
            <label className="etiket" htmlFor="acilTel">Acil durum telefonu</label>
            <input id="acilTel" type="tel" className="alan" value={acilTel}
              onChange={(e) => setAcilTel(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="etiket" htmlFor="acilKisi">Acil durumda aranacak kişi</label>
          <input id="acilKisi" className="alan" value={acilKisi}
            onChange={(e) => setAcilKisi(e.target.value)}
            placeholder="Adı ve yakınlığı" />
        </div>

        <div>
          <label className="etiket" htmlFor="notlar">Kulübe not</label>
          <textarea id="notlar" className="alan min-h-20 resize-y" value={notlar}
            onChange={(e) => setNotlar(e.target.value)} />
        </div>
      </div>

      <p className="px-1 text-xs leading-relaxed text-neutral-500">
        Yaş grubu, forma numarası, aidat tutarı ve kayıt durumu kulüp tarafından belirlenir.
      </p>

      <button className="btn-birincil w-full" disabled={bekle}>
        {bekle ? "Kaydediliyor…" : duzenleme ? "Değişiklikleri kaydet" : "Kaydı gönder"}
      </button>
    </form>
  );
}
