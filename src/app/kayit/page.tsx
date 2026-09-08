"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthKabuk from "@/components/AuthKabuk";
import Uyari from "@/components/Uyari";
import { createClient } from "@/lib/supabase/client";
import { KAYIT_ROLLERI, type Rol } from "@/lib/roller";

export default function KayitSayfasi() {
  const router = useRouter();
  const [rol, setRol] = useState<Rol>("veli");
  const [adSoyad, setAdSoyad] = useState("");
  const [telefon, setTelefon] = useState("");
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [sifre2, setSifre2] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  const secili = KAYIT_ROLLERI.find((r) => r.deger === rol)!;

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
        data: { ad_soyad: adSoyad.trim(), telefon: telefon.trim(), talep_rol: rol },
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/git` : undefined,
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
      router.replace("/git");
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
      baslik="Hesap oluştur"
      altBaslik="Kulübe bildirdiğiniz e-posta adresini kullanın; kaydınız hesabınıza kendiliğinden bağlanır."
    >
      <form onSubmit={gonder} className="space-y-4">
        {hata ? <Uyari>{hata}</Uyari> : null}
        {bilgi ? <Uyari tip="basari">{bilgi}</Uyari> : null}

        <div>
          <p className="etiket">Kulüpteki rolünüz</p>
          <div className="mt-1 space-y-2">
            {KAYIT_ROLLERI.map((r) => (
              <label
                key={r.deger}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition ${
                  rol === r.deger
                    ? "border-yesil-600 bg-yesil-50/70"
                    : "border-neutral-200 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="rol"
                  className="mt-1 h-4 w-4 accent-[#046a38]"
                  checked={rol === r.deger}
                  onChange={() => setRol(r.deger)}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-neutral-900">
                    {r.ad}
                    {r.onay ? (
                      <span className="rozet ml-2 bg-amber-100 text-amber-900">onay gerekir</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">
                    {r.aciklama}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {secili.onay ? (
          <Uyari tip="bilgi">
            Hesabınız <b>veli yetkisiyle</b> açılır; kulüp yönetimi onayladıktan sonra{" "}
            {secili.ad.toLowerCase()} ekranları açılır.
          </Uyari>
        ) : null}

        {rol === "sporcu" ? (
          <Uyari tip="bilgi">
            Sporcu hesabı yeni sporcu kaydı oluşturamaz. Kulüp kaydınızda bu e-posta
            tanımlıysa bilgileriniz hesabınıza kendiliğinden bağlanır.
          </Uyari>
        ) : null}

        <div>
          <label className="etiket" htmlFor="ad">Ad Soyad</label>
          <input id="ad" className="alan" required value={adSoyad}
            onChange={(e) => setAdSoyad(e.target.value)} placeholder="Adınız soyadınız" />
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
            onChange={(e) => setEposta(e.target.value)} placeholder="ornek@eposta.com" />
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
