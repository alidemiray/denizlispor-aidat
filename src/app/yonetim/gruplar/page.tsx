import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import Uyari from "@/components/Uyari";
import { kulupGeneliGerekli } from "@/lib/yetki";
import { ROL_ADI } from "@/lib/roller";
import { ustKlasman, grupKodu } from "@/lib/grup";
import { gocYok } from "@/lib/ozellik";
import { KULUP } from "@/kulup";
import { grupKaydet, sezonGecisi } from "./actions";

export const dynamic = "force-dynamic";

type GrupOzeti = {
  id: string;
  ad: string;
  kod: string;
  aciklama: string | null;
  sira: number;
  aktif: boolean;
  kayit_acik: boolean;
  sporcu: number;
  aday: number;
  personel: number;
};

export default async function Gruplar() {
  const { supabase, rol } = await kulupGeneliGerekli();
  const admin = rol === "admin";

  const { data, error } = await supabase.rpc("spor_grup_ozetleri");
  if (error && gocYok(error)) {
    return (
      <>
        <UstBaslik baslik="Gruplar" altBaslik="Yaş grupları" geri="/yonetim/daha" />
        <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
          <Uyari tip="bilgi">Gruplar için veritabanı güncellemesi bekleniyor (20261104_gruplar).</Uyari>
        </div>
      </>
    );
  }
  if (error) throw new Error(error.message);
  const gruplar = (data ?? []) as GrupOzeti[];
  const aktifler = gruplar.filter((g) => g.aktif);

  // Grup personeli (admin / başkan tüm üyelikleri görür)
  const { data: uyeData } = await supabase.from("spor_grup_uyeleri").select("grup_id, kullanici_id, rol");
  const uyeler = (uyeData ?? []) as { grup_id: string; kullanici_id: string; rol: string }[];
  const kisiIdleri = [...new Set(uyeler.map((u) => u.kullanici_id))];
  const { data: kisiData } = kisiIdleri.length
    ? await supabase.from("spor_profiller").select("id, ad_soyad, eposta").in("id", kisiIdleri)
    : { data: [] };
  const kisiler = new Map(
    ((kisiData ?? []) as { id: string; ad_soyad: string | null; eposta: string | null }[]).map((k) => [k.id, k]),
  );
  const adres = KULUP.yayin.adres.replace(/\/$/, "");
  const siradaki = (gruplar.at(-1)?.sira ?? 0) + 1;

  return (
    <>
      <UstBaslik baslik="Gruplar" altBaslik={`${aktifler.length} aktif grup`} geri="/yonetim/daha" genis />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4">
        <div className="kart px-4 py-4">
          <p className="text-sm leading-relaxed text-neutral-700">
            Her grubun <b>sporcuları, aidatı, kasası, ödeme bilgileri</b>, antrenman, maç ve duyuruları
            ayrıdır. Grup yöneticisi ve antrenörler yalnızca kendi gruplarını görür; admin ve kulüp
            başkanı üstteki seçiciden gruplar arasında geçer. Tek grup bırakırsanız tüm yaş grupları
            tek sistemde toplanır.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
            Pozisyon vermek için grubu seçip <Link href="/yonetim/ayarlar" className="underline">Ayarlar ve yetkiler</Link>{" "}
            ekranını açın; verdiğiniz pozisyon o grupta geçerli olur.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {gruplar.map((g) => {
            const personel = uyeler.filter((u) => u.grup_id === g.id);
            return (
              <section key={g.id} className={`kart px-4 py-4 ${g.aktif ? "" : "opacity-70"}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="manset truncate text-2xl text-neutral-900">{g.ad}</h2>
                    <p className="font-mono text-[11px] text-neutral-500">
                      {g.aktif ? (g.kayit_acik ? "Kayda açık" : "Kayda kapalı") : "Pasif"}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-right">
                    {[
                      ["Sporcu", g.sporcu],
                      ["Aday", g.aday],
                      ["Personel", g.personel],
                    ].map(([e, d]) => (
                      <div key={e as string}>
                        <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{e}</dt>
                        <dd className="font-mono text-lg font-bold text-neutral-900">{d}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {g.aktif && g.kayit_acik ? (
                  <p className="mt-3 break-all rounded-lg bg-neutral-50 px-2.5 py-2 font-mono text-[11px] text-neutral-700">
                    {adres}/basvuru?grup={g.kod}
                  </p>
                ) : null}

                {personel.length ? (
                  <ul className="mt-3 space-y-1">
                    {personel.map((u) => {
                      const k = kisiler.get(u.kullanici_id);
                      return (
                        <li key={u.kullanici_id} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-neutral-800">
                            {k?.ad_soyad || k?.eposta || "İsimsiz"}
                          </span>
                          <span className="rozet bg-neutral-100 text-neutral-700">{ROL_ADI[u.rol] ?? u.rol}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">Henüz grup yöneticisi ya da antrenör atanmadı.</p>
                )}

                {admin ? (
                  <details className="mt-3 border-t border-neutral-100 pt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-neutral-600">Düzenle</summary>
                    <form action={grupKaydet} className="mt-3 space-y-3">
                      <input type="hidden" name="id" value={g.id} />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="etiket" htmlFor={`ad-${g.id}`}>Ad</label>
                          <input id={`ad-${g.id}`} name="ad" className="alan" defaultValue={g.ad} required maxLength={40} />
                        </div>
                        <div>
                          <label className="etiket" htmlFor={`sira-${g.id}`}>Sıra</label>
                          <input id={`sira-${g.id}`} name="sira" type="number" className="alan" defaultValue={g.sira} />
                        </div>
                      </div>
                      <div>
                        <label className="etiket" htmlFor={`kod-${g.id}`}>Bağlantı kodu</label>
                        <input id={`kod-${g.id}`} name="kod" className="alan font-mono" defaultValue={g.kod}
                          pattern="[a-z0-9][a-z0-9-]{0,23}" required />
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-neutral-700">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="kayit_acik" defaultChecked={g.kayit_acik} /> Kayda açık
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" name="aktif" defaultChecked={g.aktif} /> Aktif
                        </label>
                      </div>
                      <KaydetDugmesi className="btn-ikincil w-full">Grubu kaydet</KaydetDugmesi>
                    </form>
                  </details>
                ) : null}
              </section>
            );
          })}
        </div>

        {admin ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <form action={grupKaydet} className="kart space-y-3 px-4 py-5">
              <div>
                <p className="text-sm font-bold text-neutral-900">Yeni grup aç</p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Ör. U11, U12, U13 Kızlar. Grup boş açılır; ödeme bilgilerini ve aidat kurallarını grubu
                  seçip Ayarlar&apos;dan girin, yoksa kulüp geneli bilgiler gösterilir.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="etiket" htmlFor="yeni-ad">Ad</label>
                  <input id="yeni-ad" name="ad" className="alan" placeholder="U12" required maxLength={40} />
                </div>
                <div>
                  <label className="etiket" htmlFor="yeni-sira">Sıra</label>
                  <input id="yeni-sira" name="sira" type="number" className="alan" defaultValue={siradaki} />
                </div>
              </div>
              <div>
                <label className="etiket" htmlFor="yeni-kod">Bağlantı kodu (boş bırakılırsa addan)</label>
                <input id="yeni-kod" name="kod" className="alan font-mono" placeholder="u12" pattern="[a-z0-9][a-z0-9-]{0,23}" />
              </div>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" name="kayit_acik" defaultChecked /> Velilerin kaydına açık
              </label>
              <KaydetDugmesi>Grubu aç</KaydetDugmesi>
            </form>

            {aktifler.length ? (
              <form action={sezonGecisi} className="kart space-y-3 px-4 py-5">
                <div>
                  <p className="text-sm font-bold text-neutral-900">Sezon sonu: üst klasmana geçiş</p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    Seçilen gruplar yeni adına geçer (U15 → U16). Sporcular, veliler, kasa ve aidat geçmişi
                    grupla birlikte gider. En büyük grubu pasife alabilirsiniz. Tek tek sporcu taşımak için
                    sporcunun sayfasındaki &quot;Grubu&quot; alanını kullanın.
                  </p>
                </div>
                <ul className="divide-y divide-neutral-100">
                  {[...aktifler].reverse().map((g) => {
                    const yeni = ustKlasman(g.ad);
                    return (
                      <li key={g.id} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 py-2">
                        <label className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                          <input type="checkbox" name="gecis" value={g.id} defaultChecked={yeni !== g.ad} />
                          <span className="w-14 truncate">{g.ad}</span>
                        </label>
                        <input name={`ad_${g.id}`} aria-label={`${g.ad} yeni adı`} className="alan py-1.5" defaultValue={yeni} />
                        <div className="flex items-center gap-2">
                          <input name={`kod_${g.id}`} aria-label={`${g.ad} yeni kodu`} className="alan py-1.5 font-mono text-xs"
                            defaultValue={grupKodu(yeni)} />
                          <label className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-600">
                            <input type="checkbox" name={`pasif_${g.id}`} /> Pasif
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <KaydetDugmesi bekleyen="Geçiş yapılıyor…">Seçilen grupları üst klasmana geçir</KaydetDugmesi>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 px-1 text-xs text-neutral-500">Grup açmak ve sezon geçişi admin yetkisindedir.</p>
        )}
      </div>
    </>
  );
}
