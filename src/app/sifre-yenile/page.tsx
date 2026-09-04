"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthKabuk from "@/components/AuthKabuk";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";

export default function SifreYenile() {
  const router = useRouter();
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setHata(null);
    if (sifre.length < 8) return setHata("Şifre en az 8 karakter olmalı.");
    if (sifre !== sifre2) return setHata("Şifreler eşleşmiyor.");
    setBekle(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: sifre });
    if (error) {
      setBekle(false);
      setHata(
        error.message.includes("session")
          ? "Bağlantının süresi dolmuş görünüyor. Yeni bir şifre yenileme bağlantısı isteyin."
          : error.message,
      );
      return;
    }
    router.replace("/panel");
    router.refresh();
  }

  return (
    <AuthKabuk baslik="Yeni şifre belirle" altBaslik="Hesabınız için yeni bir şifre girin.">
      <form onSubmit={gonder} className="space-y-4">
        {hata ? <Uyari>{hata}</Uyari> : null}
        <div>
          <label className="etiket" htmlFor="s1">Yeni şifre</label>
          <input id="s1" className="alan" type="password" autoComplete="new-password"
            required value={sifre} onChange={(e) => setSifre(e.target.value)} />
        </div>
        <div>
          <label className="etiket" htmlFor="s2">Yeni şifre (tekrar)</label>
          <input id="s2" className="alan" type="password" autoComplete="new-password"
            required value={sifre2} onChange={(e) => setSifre2(e.target.value)} />
        </div>
        <button className="btn-birincil w-full" disabled={bekle}>
          {bekle ? "Kaydediliyor…" : "Şifreyi güncelle"}
        </button>
      </form>
    </AuthKabuk>
  );
}
