import Link from "next/link";
import AuthKabuk from "@/components/AuthKabuk";
import { KULUP } from "@/kulup";

export const metadata = { title: `Altyapıya ön kayıt · ${KULUP.kisaAd}` };

/** QR afişinden açılan herkese açık sayfa. Veri yazmaz; veliyi hesap açma / girişe yönlendirir.
 *  ?grup=u14 → başvuru o gruba gider (kod veritabanında doğrulanır). */
export default async function Basvuru({ searchParams }: { searchParams: Promise<{ grup?: string }> }) {
  const { grup: hamGrup } = await searchParams;
  const grup = /^[a-z0-9][a-z0-9-]{0,23}$/.test(hamGrup ?? "") ? hamGrup! : null;
  const DEVAM = `/panel/sporcu-ekle${grup ? `?grup=${grup}` : ""}`;
  return (
    <AuthKabuk
      baslik="Altyapıya ön kayıt"
      altBaslik={`${KULUP.ad} altyapısına katılmak için üç kısa adım.`}
    >
      <ol className="space-y-3">
        {[
          ["Veli hesabınızı açın", "E-posta ve şifreyle, bir dakika sürer."],
          ["Çocuğunuzun bilgilerini girin", "Ad, doğum tarihi, okul ve bir acil durum kişisi."],
          ["Deneme dersine gelin", "Kulüp tarih ve yeri uygulamadan bildirir; sonra kesin kayıt."],
        ].map(([b, a], i) => (
          <li key={b} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yesil-500 font-manset text-base font-extrabold text-anametin">
              {i + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">{b}</span>
              <span className="block text-xs leading-relaxed text-neutral-500">{a}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-7 space-y-2.5">
        <Link href={`/kayit?basvuru=1${grup ? `&grup=${grup}` : ""}&devam=${encodeURIComponent(DEVAM)}`} className="btn-birincil w-full">
          Başvuruya başla
        </Link>
        <Link href={`/giris?devam=${encodeURIComponent(DEVAM)}`} className="btn-ikincil w-full">
          Hesabım var, giriş yap
        </Link>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-neutral-500">
        Bilgileriniz yalnızca kulüp yönetimi ve antrenörlerle paylaşılır.{" "}
        <Link href="/kvkk" className="underline underline-offset-2">KVKK aydınlatma metni</Link>
      </p>
    </AuthKabuk>
  );
}
