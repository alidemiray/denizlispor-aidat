import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { ayarKaydet, rolAta, rolTalebiKarar } from "@/app/yonetim/actions";
import { ROL_ADI } from "@/lib/roller";
import { gunAdi } from "@/lib/format";
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
    .limit(200);

  const { data: talepData } = await supabase
    .from("spor_rol_talepleri")
    .select("id, kullanici_id, talep_rol, created_at")
    .eq("durum", "bekliyor")
    .order("created_at", { ascending: false });
  const talepler = (talepData ?? []) as {
    id: string;
    kullanici_id: string;
    talep_rol: string;
    created_at: string;
  }[];
  const kisiler = new Map(
    (kullanicilar ?? []).map((k) => [k.id, k as { ad_soyad: string | null; eposta: string | null }]),
  );

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
          Bekleyen yetki talepleri
        </h2>
        {talepler.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Onay bekleyen yetki talebi yok. Antrenör, yardımcı antrenör veya başkan olarak
            kaydolan kişiler burada listelenir.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {talepler.map((t) => {
              const k = kisiler.get(t.kullanici_id);
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {k?.ad_soyad || "İsimsiz"}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {k?.eposta} · {gunAdi(t.created_at)}
                    </p>
                  </div>
                  <span className="rozet bg-amber-100 text-amber-900">
                    {ROL_ADI[t.talep_rol] ?? t.talep_rol}
                  </span>
                  <form action={rolTalebiKarar}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="kullanici_id" value={t.kullanici_id} />
                    <input type="hidden" name="talep_rol" value={t.talep_rol} />
                    <input type="hidden" name="karar" value="onayla" />
                    <button className="rounded-lg bg-yesil-600 px-3 py-1.5 text-xs font-semibold text-white">
                      Onayla
                    </button>
                  </form>
                  <form action={rolTalebiKarar}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="kullanici_id" value={t.kullanici_id} />
                    <input type="hidden" name="talep_rol" value={t.talep_rol} />
                    <input type="hidden" name="karar" value="reddet" />
                    <button className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">
                      Reddet
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        <h2 className="mb-2 mt-8 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Kullanıcılar ve yetkiler
        </h2>
        <div className="kart mb-3 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-neutral-600">
            <b>Veli</b> yalnızca kendi sporcusunu görür. <b>Sporcu</b> kendi kaydını görür,
            aidat ve kasa ekranlarına hiç giremez. <b>Antrenör</b> ve <b>yardımcı antrenör</b>{" "}
            tüm sporcuları görür, antrenman günlüğü ve yoklama girer, gelişim notu yazar —
            aidat ve ödeme bilgilerine erişemez. <b>Başkan</b> ve <b>yönetici</b> her şeye
            erişir ve kayıt silebilir.
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
                <span className="rozet bg-yesil-100 text-yesil-800">
                  {ROL_ADI[k.rol] ?? k.rol} (siz)
                </span>
              ) : (
                <form action={rolAta} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={k.id} />
                  <select
                    name="rol"
                    defaultValue={k.rol}
                    aria-label="Rol"
                    className="alan w-auto px-2 py-1.5 text-xs"
                  >
                    {Object.entries(ROL_ADI).map(([deger, ad]) => (
                      <option key={deger} value={deger}>{ad}</option>
                    ))}
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
