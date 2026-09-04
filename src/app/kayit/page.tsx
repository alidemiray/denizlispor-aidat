"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthKabuk from "@/components/AuthKabuk";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";

export default function KayitSayfasi() {
  const router = useRouter();
  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBilgi(null);

    if (sifre.length < 8) {
      setHata("Şifre en az 8 karakter olmalı.");
      return;
    }
    if (sifre !== sifre2) {
      setHata("Şifreler eşleşmiyor.");
      return;
    }

    setBekle(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: eposta.trim().toLowerCase(),
      password: sifre,
      options: {
        data: { ad_soyad: adSoyad.trim(), telefon: telefon.trim() },
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/panel` : undefined,
      },
    });

    if (error) {
      setBekle(false);
      setHata(
        error.message.includes("already registered")
          ? "Bu e-posta ile daha önce hesap açılmış. Giriş yapmayı deneyin."
          : error.message,
      );
      return;
    }

    if (data.session) {
      router.replace("/panel");
      router.refresh();
      return;
    }

    setBekle(false);
    setBilgi(
      "Hesabınız oluşturuldu. E-posta adresinize gönderilen doğrulama bağlantısına tıkladıktan sonra giriş yapabilirsiniz.",
    );
  }

  return (
    <AuthKabuk
      baslik="Veli hesabı oluştur"
      altBaslik="Kulübe bildirdiğiniz e-posta adresini kullanın; sporcunuz otomatik olarak hesabınıza tanımlanır."
    >
      <form onSubmit={gonder} className="space-y-4">
        {hata ? <Uyari>{hata}</Uyari> : null}
        {bilgi ? <Uyari tip="basari">{bilgi}</Uyari> : null}

        <div>
          <label className="etiket" htmlFor="ad">Ad Soyad</label>
          <input id="ad" className="alan" required value={adSoyad}
            onChange={(e) => setAdSoyad(e.target.value)} placeholder="Veli adı soyadı" />
        </div>

        <div>
          <label className="etiket" htmlFor="tel">Telefon</label>
          <input id="tel" className="alan" type="tel" inputMode="tel" value={telefon}
            onChange={(e) => setTelefon(e.target.value)} placeholder="05xx xxx xx xx" />
        </div>

        <div>
          <label className="etiket" htmlFor="eposta">E-posta</label>
          <input id="eposta" className="alan" type="email" inputMode="email"
            autoComplete="email" required value={eposta}
            onChange={(e) => setEposta(e.target.value)} placeholder="veli@ornek.com" />
        </div>

        <div>
          <label className="etiket" htmlFor="sifre">Şifre</label>
          <input id="sifre" className="alan" type="password" autoComplete="new-password"
            required value={sifre} onChange={(e) => setSifre(e.target.value)}
            placeholder="En az 8 karakter" />
        </div>

        <div>
          <label className="etiket" htmlFor="sifre2">Şifre (tekrar)</label>
          <input id="sifre2" className="alan" type="password" autoComplete="new-password"
            required value={sifre2} onChange={(e) => setSifre2(e.target.value)} />
        </div>

        <button className="btn-birincil w-full" disabled={bekle}>
          {bekle ? "Oluşturuluyor…" : "Hesabı oluştur"}
        </button>

        <p className="pt-1 text-center text-sm text-neutral-500">
          Hesabınız var mı?{" "}
          <Link href="/giris" className="font-medium text-yesil-700">Giriş yapın</Link>
        </p>
      </form>
    </AuthKabuk>
  );
}
