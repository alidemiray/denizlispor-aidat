"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthKabuk from "@/components/AuthKabuk";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    setBekle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: eposta.trim().toLowerCase(),
      password: sifre,
    });
    if (error) {
      setBekle(false);
      setHata(
        error.message.includes("Invalid login")
          ? "E-posta veya şifre hatalı."
          : error.message.includes("Email not confirmed")
            ? "E-posta adresiniz henüz doğrulanmamış. Gelen kutunuzu kontrol edin."
            : error.message,
      );
      return;
    }
    const devam = params.get("devam");
    router.replace(devam && devam.startsWith("/") ? devam : "/panel");
    router.refresh();
  }

  return (
    <form onSubmit={gonder} className="space-y-4">
      {hata ? <Uyari>{hata}</Uyari> : null}

      <div>
        <label className="etiket" htmlFor="eposta">E-posta</label>
        <input
          id="eposta"
          className="alan"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={eposta}
          onChange={(e) => setEposta(e.target.value)}
          placeholder="veli@ornek.com"
        />
      </div>

      <div>
        <label className="etiket" htmlFor="sifre">Şifre</label>
        <input
          id="sifre"
          className="alan"
          type="password"
          autoComplete="current-password"
          required
          value={sifre}
          onChange={(e) => setSifre(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <button className="btn-birincil w-full" disabled={bekle}>
        {bekle ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>

      <div className="flex items-center justify-between pt-1 text-sm">
        <Link href="/sifremi-unuttum" className="font-medium text-yesil-700">
          Şifremi unuttum
        </Link>
        <Link href="/kayit" className="font-medium text-yesil-700">
          Hesap oluştur
        </Link>
      </div>
    </form>
  );
}

export default function GirisSayfasi() {
  return (
    <AuthKabuk
      baslik="Veli girişi"
      altBaslik="Sporcunuzun bilgilerini ve aidat durumunu görmek için giriş yapın."
    >
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </AuthKabuk>
  );
}
