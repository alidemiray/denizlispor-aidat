"use client";

import Link from "next/link";
import { useState } from "react";
import AuthKabuk from "@/components/AuthKabuk";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";

export default function SifremiUnuttum() {
  const [eposta, setEposta] = useState("");
  const [durum, setDurum] = useState<"bos" | "bekle" | "tamam">("bos");
  const [hata, setHata] = useState<string | null>(null);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setDurum("bekle");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      eposta.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/sifre-yenile` },
    );
    if (error) {
      setHata(error.message);
      setDurum("bos");
      return;
    }
    setDurum("tamam");
  }

  return (
    <AuthKabuk
      baslik="Şifremi unuttum"
      altBaslik="E-posta adresinizi girin, şifre yenileme bağlantısı gönderelim."
    >
      {durum === "tamam" ? (
        <div className="space-y-4">
          <Uyari tip="basari">
            Bağlantı gönderildi. E-postanızdaki bağlantıya tıklayarak yeni şifrenizi
            belirleyebilirsiniz.
          </Uyari>
          <Link href="/giris" className="btn-ikincil w-full">Girişe dön</Link>
        </div>
      ) : (
        <form onSubmit={gonder} className="space-y-4">
          {hata ? <Uyari>{hata}</Uyari> : null}
          <div>
            <label className="etiket" htmlFor="eposta">E-posta</label>
            <input id="eposta" className="alan" type="email" required value={eposta}
              onChange={(e) => setEposta(e.target.value)} placeholder="veli@ornek.com" />
          </div>
          <button className="btn-birincil w-full" disabled={durum === "bekle"}>
            {durum === "bekle" ? "Gönderiliyor…" : "Bağlantı gönder"}
          </button>
          <p className="pt-1 text-center text-sm">
            <Link href="/giris" className="font-medium text-yesil-700">Girişe dön</Link>
          </p>
        </form>
      )}
    </AuthKabuk>
  );
}
