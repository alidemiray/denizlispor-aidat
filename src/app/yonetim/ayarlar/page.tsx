import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { ayarKaydet, rolAta, rolTalebiKarar } from "@/app/yonetim/actions";
import { ROL_ADI, kulupGeneliMi } from "@/lib/roller";
import { ayarlariOku, gruplarim, seciliGrup } from "@/lib/grup";
import { gocYok } from "@/lib/ozellik";
import { gunAdi } from "@/lib/format";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import { KULUP } from "@/kulup";

export const dynamic = "force-dynamic";

export default async function AyarlarSayfasi() {
  const { supabase, user, rol } = await yoneticiGerekli();
  const gruplar = await gruplarim(supabase);
  const gruplu = gruplar.length > 0; // 20261104 göçü uygulanmış
  const grup = seciliGrup(gruplar);
  const cokGrup = gruplar.length > 1;

  // Ayarlar: aktif grubun değerleri (gruba özel olan kulüp genelini ezer)
  const a = await ayarlariOku(supabase);

  // Kullanıcılar: aktif gruptaki rolleriyle
  const kRpc = await supabase.rpc("spor_grup_kullanicilari");
  const kullanicilar = (
    kRpc.error && gocYok(kRpc.error)
      ? (await supabase
          .from("spor_profiller")
          .select("id, eposta, ad_soyad, rol")
          .order("created_at", { ascending: false })
          .limit(200)).data
      : kRpc.data
  ) as { id: string; eposta: string | null; ad_soyad: string | null; rol: string; temel_rol?: string }[] | null;

  // Pozisyonları admin ve kulüp başkanı belirler (göç öncesi eski kurulumda yönetici de)
  const yetkiVerebilir = gruplu ? kulupGeneliMi(rol) : true;
  const rolSecenekleri = Object.entries(ROL_ADI).filter(([deger]) =>
    deger === "admin" || deger === "baskan" ? rol === "admin" || !gruplu : true,
  );
  const grupEki = cokGrup && grup ? ` · ${grup.ad}` : "";

  const { data: talepData } = await supabase
    .from("spor_rol_talepleri")
    .select("id, kullanici_id, talep_rol, created_at")
    // Veritabanı kuralı: beklemede | onaylandi | reddedildi
    .eq("durum", "beklemede")
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
      <UstBaslik baslik="Ayarlar" altBaslik={`Kulüp bilgileri ve yetkiler${grupEki}`} geri="/yonetim/daha" />

      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <form action={ayarKaydet} className="kart space-y-4 px-4 py-5">
          <p className="text-sm font-bold text-neutral-900">
            Ödeme bilgileri (velilere gösterilir)
          </p>
          {cokGrup && grup ? (
            <p className="-mt-2 text-xs leading-relaxed text-neutral-500">
              Banka, IBAN, iletişim ve aidat kuralları <b>{grup.ad}</b> grubuna özeldir; her grubun
              kasası ayrıdır. Kulüp adını yalnızca admin ve kulüp başkanı değiştirir.
            </p>
          ) : null}

          <div>
            <label className="etiket" htmlFor="kulup_adi">Kulüp adı</label>
            <input id="kulup_adi" name="kulup_adi" className="alan" defaultValue={a.kulup_adi}
              readOnly={cokGrup && !kulupGeneliMi(rol)} />
          </div>
          <div>
            <label className="etiket" htmlFor="hesap_sahibi">Hesap sahibi</label>
            <input id="hesap_sahibi" name="hesap_sahibi" className="alan"
              defaultValue={a.hesap_sahibi} placeholder={KULUP.resmiAd} />
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

        <form action={ayarKaydet} className="kart mt-4 space-y-4 px-4 py-5">
          <div>
            <p className="text-sm font-bold text-neutral-900">Aidat kuralları</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Her ayın başında aktif sporculara borç kendiliğinden açılır. Tutar sporcunun aylık
              aidatından hesaplanır; indirim ve dondurma sporcu kartından girilir.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiket" htmlFor="otomatik_tahakkuk">Ay başında otomatik borç</label>
              <select id="otomatik_tahakkuk" name="otomatik_tahakkuk" className="alan"
                defaultValue={a.otomatik_tahakkuk || "acik"}>
                <option value="acik">Açık</option>
                <option value="kapali">Kapalı (elle oluştur)</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="son_odeme_gunu">Son ödeme günü</label>
              <input id="son_odeme_gunu" name="son_odeme_gunu" type="number" min={1} max={28}
                className="alan" defaultValue={a.son_odeme_gunu || "10"} />
            </div>
            <div>
              <label className="etiket" htmlFor="kardes_indirimi">Kardeş indirimi (%)</label>
              <input id="kardes_indirimi" name="kardes_indirimi" type="number" min={0} max={100}
                className="alan" defaultValue={a.kardes_indirimi || "0"} />
            </div>
            <div>
              <label className="etiket" htmlFor="kist_hesap">Ay ortası kayıtta kıst</label>
              <select id="kist_hesap" name="kist_hesap" className="alan" defaultValue={a.kist_hesap || "kapali"}>
                <option value="kapali">Kapalı (tam ay)</option>
                <option value="acik">Açık (kalan gün kadar)</option>
              </select>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            Kardeş indirimi aynı velinin ikinci ve sonraki aktif sporcusuna uygulanır. Kıst açıkken ay
            ortasında aktif yapılan sporcu yalnızca kalan günler kadar öder (tam TL&apos;ye yuvarlanır).
          </p>
          <KaydetDugmesi>Aidat kurallarını kaydet</KaydetDugmesi>
        </form>

        <form action={ayarKaydet} className="kart mt-4 space-y-4 px-4 py-5">
          <div>
            <p className="text-sm font-bold text-neutral-900">Hatırlatma ve bildirimler</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Veliye uygulamadaki bildirim kutusundan gider. Telefon bildirimi ve WhatsApp
              eklendiğinde aynı kurallar ve sessiz saat geçerli olur.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiket" htmlFor="hatirlatma">Aidat hatırlatması</label>
              <select id="hatirlatma" name="hatirlatma" className="alan" defaultValue={a.hatirlatma || "acik"}>
                <option value="acik">Açık</option>
                <option value="kapali">Kapalı</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="bildirim_gelmedi">&quot;Gelmedi&quot; haberi veliye</label>
              <select id="bildirim_gelmedi" name="bildirim_gelmedi" className="alan" defaultValue={a.bildirim_gelmedi || "acik"}>
                <option value="acik">Açık</option>
                <option value="kapali">Kapalı</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="hatirlatma_once">Vadeden kaç gün önce</label>
              <input id="hatirlatma_once" name="hatirlatma_once" className="alan" inputMode="numeric"
                pattern="[0-9 ,]*" defaultValue={a.hatirlatma_once || "3"} />
            </div>
            <div>
              <label className="etiket" htmlFor="hatirlatma_gecikme">Gecikmenin kaçıncı günü</label>
              <input id="hatirlatma_gecikme" name="hatirlatma_gecikme" className="alan" inputMode="numeric"
                pattern="[0-9 ,]*" defaultValue={a.hatirlatma_gecikme || "3,10"} />
            </div>
            <div>
              <label className="etiket" htmlFor="sessiz_bas">Sessiz saat başlangıcı</label>
              <input id="sessiz_bas" name="sessiz_bas" type="time" className="alan" defaultValue={a.sessiz_bas || "22:00"} />
            </div>
            <div>
              <label className="etiket" htmlFor="sessiz_bit">Sessiz saat bitişi</label>
              <input id="sessiz_bit" name="sessiz_bit" type="time" className="alan" defaultValue={a.sessiz_bit || "08:30"} />
            </div>
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            Birden çok gün virgülle yazılır (ör. 7,3). Vade günü ayrıca hatırlatılır. Hatırlatmalar her
            sabah 10:00&apos;da kutuya düşer.
          </p>
          <KaydetDugmesi>Hatırlatma kurallarını kaydet</KaydetDugmesi>
        </form>

        <h2 className="mb-2 mt-8 px-1 bolum-basligi">
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
                  {yetkiVerebilir ? (
                    <>
                  <form action={rolTalebiKarar}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="kullanici_id" value={t.kullanici_id} />
                    <input type="hidden" name="talep_rol" value={t.talep_rol} />
                    <input type="hidden" name="karar" value="onayla" />
                    <button className="rounded-lg bg-yesil-500 px-3 py-1.5 text-xs font-bold text-anametin">
                      Onayla
                    </button>
                  </form>
                    </>
                  ) : (
                    <span className="text-xs text-neutral-500">Admin onaylar</span>
                  )}
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

        <h2 className="mb-2 mt-8 px-1 bolum-basligi">
          Kullanıcılar ve yetkiler
        </h2>
        <div className="kart mb-3 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-neutral-600">
            <b>Veli</b> yalnızca kendi sporcusunu görür; kaydı onaylanınca aidat ve kasayı görür.{" "}
            <b>Sporcu</b> kendi kaydını görür, para ekranlarına giremez. <b>Antrenör</b> ve{" "}
            <b>yardımcı antrenör</b> grubun sporcularını görür, antrenman, yoklama ve gelişim girer —
            aidat, ödeme ve kasayı göremez. <b>Grup yöneticisi</b> grubun aidat, ödeme ve kasasını
            yönetir. <b>Kulüp başkanı</b> ve <b>admin</b> tüm gruplara geçer; pozisyonları onlar
            belirler, grup açmak ve başkan atamak yalnızca admindedir.
            {cokGrup && grup ? <> Aşağıdaki pozisyonlar <b>{grup.ad}</b> grubu içindir.</> : null}
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
              {k.id === user.id || !yetkiVerebilir ? (
                <span className={`rozet ${k.id === user.id ? "bg-yesil-100 text-yesil-800" : "bg-neutral-100 text-neutral-700"}`}>
                  {ROL_ADI[k.rol] ?? k.rol}{k.id === user.id ? " (siz)" : ""}
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
                    {(rolSecenekleri.some(([d]) => d === k.rol)
                      ? rolSecenekleri
                      : [...rolSecenekleri, [k.rol, ROL_ADI[k.rol] ?? k.rol] as [string, string]]
                    ).map(([deger, ad]) => (
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
