import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { ayarKaydet, rolAta } from "@/app/yonetim/actions";
import KaydetDugmesi from "@/components/KaydetDugmesi";

export const dynamic = "force-dynamic";

export default async function AyarlarSayfasi() {
  const { supabase, user } = await yoneticiGerekli();

  const { data: ayarData } = await supabase.from("spor_ayarlar").select("*");
  const a = Object.fromEntries(
    (ayarData ?? []).map((x: { anahtar: string; deger: string | null }) => [
      x.anahtar,
      x.deger ?? "",
    ]),
  );

  const { data: kullanicilar } = await supabase
    .from("spor_profiller")
    .select("id, eposta, ad_soyad, rol")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <>
      <UstBaslik baslik="Ayarlar" altBaslik="Kulüp bilgileri ve yetkiler" geri="/yonetim/daha" />

      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <form action={ayarKaydet} className="kart space-y-4 px-4 py-5">
          <p className="text-sm font-bold text-neutral-900">
            Ödeme bilgileri (velilere gösterilir)
          </p>

          <div>
            <label className="etiket" htmlFor="kulup_adi">Kulüp adı</label>
            <input id="kulup_adi" name="kulup_adi" className="alan" defaultValue={a.kulup_adi} />
          </div>
          <div>
            <label className="etiket" htmlFor="hesap_sahibi">Hesap sahibi</label>
            <input id="hesap_sahibi" name="hesap_sahibi" className="alan"
              defaultValue={a.hesap_sahibi} placeholder="Denizlispor Kulübü Derneği" />
          </div>
          <div>
            <label className="etiket" htmlFor="banka_adi">Banka</label>
            <input id="banka_adi" name="banka_adi" className="alan" defaultValue={a.banka_adi} />
          </div>
          <div>
            <label className="etiket" htmlFor="iban">IBAN</label>
            <input id="iban" name="iban" className="alan font-mono" defaultValue={a.iban}
              placeholder="TR00 0000 0000 0000 0000 0000 00" />
          </div>
          <div>
            <label className="etiket" htmlFor="odeme_aciklamasi">Ödeme notu</label>
            <textarea id="odeme_aciklamasi" name="odeme_aciklamasi"
              className="alan min-h-20 resize-y" defaultValue={a.odeme_aciklamasi} />
          </div>

          <hr className="border-neutral-100" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiket" htmlFor="iletisim_telefon">İletişim telefonu</label>
              <input id="iletisim_telefon" name="iletisim_telefon" className="alan"
                defaultValue={a.iletisim_telefon} />
            </div>
            <div>
              <label className="etiket" htmlFor="iletisim_eposta">İletişim e-postası</label>
              <input id="iletisim_eposta" name="iletisim_eposta" className="alan"
                defaultValue={a.iletisim_eposta} />
            </div>
          </div>

          <KaydetDugmesi>Ayarları kaydet</KaydetDugmesi>
        </form>

        <h2 className="mb-2 mt-8 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Kullanıcılar ve yetkiler
        </h2>
        <div className="kart mb-3 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-neutral-600">
            <b>Veli</b> yalnızca kendi sporcusunu görür. <b>Antrenör</b> tüm sporcuları görür,
            antrenman günlüğü ve yoklama girer, gelişim notu yazar — aidat ve ödeme bilgilerine
            erişemez. <b>Yönetici</b> her şeye erişir ve kayıt silebilir.
          </p>
        </div>

        <div className="kart divide-y divide-neutral-100">
          {(kullanicilar ?? []).map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {k.ad_soyad || "İsimsiz"}
                  {k.id === user.id ? " (siz)" : ""}
                </p>
                <p className="truncate text-xs text-neutral-500">{k.eposta}</p>
              </div>
              {k.id === user.id ? (
                <span className="rozet bg-yesil-100 text-yesil-800">Yönetici (siz)</span>
              ) : (
                <form action={rolAta} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={k.id} />
                  <select
                    name="rol"
                    defaultValue={k.rol}
                    aria-label="Rol"
                    className="alan w-auto px-2 py-1.5 text-xs"
                  >
                    <option value="veli">Veli</option>
                    <option value="antrenor">Antrenör</option>
                    <option value="yonetici">Yönetici</option>
                  </select>
                  <KaydetDugmesi
                    bekleyen="…"
                    className="rounded-lg bg-neutral-100 px-2.5 py-2 text-xs font-semibold text-neutral-700 disabled:opacity-50"
                  >
                    Uygula
                  </KaydetDugmesi>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
