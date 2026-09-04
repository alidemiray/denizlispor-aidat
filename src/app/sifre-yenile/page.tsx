"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import AuthKabuk from "@/components/AuthKabuk";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";

function Form() {
  const router = useRouter();
  const [hazir, setHazir] = useState(false);
  const [oturumVar, setOturumVar] = useState(false);
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  useEffect(() => {
    let iptal = false;

    (async () => {
      const supabase = createClient();

      // PKCE akışı: adreste ?code=... varsa oturuma çevir.
      const sorgu = new URLSearchParams(window.location.search);
      const kod = sorgu.get("code");
      if (kod) {
        await supabase.auth.exchangeCodeForSession(kod).catch(() => null);
      }

      // Hash akışında istemci adresteki jetonu kendisi okur; birkaç yüz ms verelim.
      await new Promise((r) => setTimeout(r, 350));
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (iptal) return;
      setOturumVar(Boolean(session));
      setHazir(true);

      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();

    return () => {
      iptal = true;
    };
  }, []);

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
        error.message.toLowerCase().includes("session")
          ? "Bağlantının süresi dolmuş görünüyor. Yeni bir şifre yenileme bağlantısı isteyin."
          : error.message,
      );
      return;
    }
    router.replace("/git");
    router.refresh();
  }

  if (!hazir) {
    return <p className="text-sm text-neutral-500">Bağlantı doğrulanıyor…</p>;
  }

  if (!oturumVar) {
    return (
      <div className="space-y-4">
        <Uyari>
          Şifre yenileme bağlantısı geçersiz ya da süresi dolmuş. Bağlantılar bir kez ve kısa
          süre için geçerlidir.
        </Uyari>
        <Link href="/sifremi-unuttum" className="btn-birincil w-full">
          Yeni bağlantı iste
        </Link>
        <Link href="/giris" className="btn-ikincil w-full">
          Girişe dön
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={gonder} className="space-y-4">
      {hata ? <Uyari>{hata}</Uyari> : null}
      <div>
        <label className="etiket" htmlFor="s1">Yeni şifre</label>
        <input id="s1" className="alan" type="password" autoComplete="new-password" required
          value={sifre} onChange={(e) => setSifre(e.target.value)} placeholder="En az 8 karakter" />
      </div>
      <div>
        <label className="etiket" htmlFor="s2">Yeni şifre (tekrar)</label>
        <input id="s2" className="alan" type="password" autoComplete="new-password" required
          value={sifre2} onChange={(e) => setSifre2(e.target.value)} />
      </div>
      <button className="btn-birincil w-full" disabled={bekle}>
        {bekle ? "Kaydediliyor…" : "Şifreyi güncelle"}
      </button>
    </form>
  );
}

export default function SifreYenile() {
  return (
    <AuthKabuk baslik="Yeni şifre belirle" altBaslik="Hesabınız için yeni bir şifre girin.">
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </AuthKabuk>
  );
}
