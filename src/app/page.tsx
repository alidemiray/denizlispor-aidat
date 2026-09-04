"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AcilisEkrani() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Supabase e-posta bağlantıları (şifre sıfırlama, doğrulama) site köküne düşer.
    // Adresteki bilgiyi ilgili ekrana taşıyoruz.
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const parcalar = new URLSearchParams(hash);
    const sorgu = new URLSearchParams(window.location.search);
    const oku = (a: string) => parcalar.get(a) ?? sorgu.get(a);

    const hataKodu = oku("error_code");
    if (hataKodu) {
      const mesaj =
        hataKodu === "otp_expired"
          ? "Bağlantının süresi dolmuş veya daha önce kullanılmış. Yeni bir şifre yenileme bağlantısı isteyin."
          : (oku("error_description") ?? "Bağlantı geçersiz.").replace(/\+/g, " ");
      router.replace(`/sifremi-unuttum?hata=${encodeURIComponent(mesaj)}`);
      return;
    }

    const tur = oku("type");
    const kod = oku("code");
    const jeton = oku("access_token");
    if (tur === "recovery" || jeton || kod) {
      const ek = window.location.hash || window.location.search;
      router.replace(`/sifre-yenile${ek}`);
      return;
    }

    const t = setTimeout(() => router.replace("/git"), 1800);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main
      onClick={() => router.replace("/git")}
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-yesil-700 via-yesil-800 to-neutral-900 px-6 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
      />
      <div className="arma-giris relative">
        <Image
          src="/icons/icon-512.png"
          alt="Denizlispor arması"
          width={180}
          height={180}
          priority
          className="drop-shadow-2xl"
        />
      </div>

      <div className="yazi-giris mt-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">DENİZLİSPOR</h1>
        <p className="mt-1.5 text-sm font-medium tracking-[0.2em] text-white/70">SPORCU TAKİP</p>
      </div>

      <div className="yazi-giris absolute bottom-10 flex flex-col items-center gap-3">
        <div className="h-1 w-24 overflow-hidden rounded-full bg-white/20">
          <div className="h-full w-1/3 animate-[yaziGiris_1.4s_ease-in-out_infinite_alternate] rounded-full bg-white/80" />
        </div>
        <p className="text-[11px] text-white/50">1966</p>
      </div>
    </main>
  );
}
