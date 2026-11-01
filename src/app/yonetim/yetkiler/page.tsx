import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import Uyari from "@/components/Uyari";
import { kulupGeneliGerekli } from "@/lib/yetki";
import { ROL_ADI } from "@/lib/roller";
import { gocYok } from "@/lib/ozellik";
import { grupYetkisiVer, gorunurlukKaydet, kulupRoluVer } from "./actions";

export const dynamic = "force-dynamic";

type Satir = {
  id: string;
  ad_soyad: string | null;
  eposta: string | null;
  temel_rol: string;
  uyelikler: Record<string, string>;
  cocuk_gruplari: string[];
};
type Grup = { id: string; ad: string; aktif: boolean };

const POZISYONLAR: [string, string][] = [
  ["yok", "—"],
  ["yonetici", "Grup yöneticisi"],
  ["antrenor", "Antrenör"],
  ["yardimci_antrenor", "Yrd. antrenör"],
];

const GORUNURLUK: [string, string][] = [
  ["veli_kasa", "Kasa (havuz, aktarım, giderler)"],
  ["veli_odemeyenler", "Ödemeyenler listesi (isimler maskeli)"],
  ["veli_aidat_akisi", "Aidat akışı (dönem dönem kim ödedi)"],
];

/** Admin ve kulüp başkanı: kim hangi grupta ne görevde, veliler neyi görür. */
export default async function Yetkiler() {
  const { supabase, rol, user } = await kulupGeneliGerekli();
  const admin = rol === "admin";

  const [tablo, { data: grupData }, { data: ayarData }] = await Promise.all([
    supabase.rpc("spor_yetki_tablosu"),
    supabase.from("spor_gruplar").select("id, ad, aktif").order("sira"),
    supabase.from("spor_grup_ayarlari").select("grup_id, anahtar, deger"),
  ]);
  if (tablo.error && gocYok(tablo.error)) {
    return (
      <>
        <UstBaslik baslik="Yetkiler" geri="/yonetim/daha" />
        <div className="mx-auto w-full max-w-2xl px-4 pt-4">
          <Uyari tip="bilgi">Bu ekran için veritabanı güncellemesi bekleniyor (20261109).</Uyari>
        </div>
      </>
    );
  }
  if (tablo.error) throw new Error(tablo.error.message);

  const kisiler = (tablo.data ?? []) as Satir[];
  const gruplar = ((grupData ?? []) as Grup[]).filter((g) => g.aktif);
  const ayar = new Map(
    ((ayarData ?? []) as { grup_id: string; anahtar: string; deger: string | null }[]).map((a) => [
      `${a.grup_id}:${a.anahtar}`,
      a.deger,
    ]),
  );
  const acik = (g: string, k: string) => (ayar.get(`${g}:${k}`) ?? "acik") !== "kapali";

  const kulupGeneli = kisiler.filter((k) => k.temel_rol === "admin" || k.temel_rol === "baskan");
  const digerleri = kisiler.filter((k) => k.temel_rol !== "admin" && k.temel_rol !== "baskan");

  return (
    <>
      <UstBaslik baslik="Yetkiler" altBaslik="Kim hangi grupta, kim neyi görür" geri="/yonetim/daha" genis />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-4">
        <section className="kart px-4 py-4">
          <h2 className="text-sm font-bold text-neutral-900">Kulüp geneli</h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Admin ve kulüp başkanı tüm gruplara geçer, her şeyi görür, yanlış tahsilatı silebilir.
            Kulüp başkanını yalnızca admin atar.
          </p>
          <ul className="mt-3 divide-y divide-neutral-100">
            {kulupGeneli.map((k) => (
              <li key={k.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{k.ad_soyad || k.eposta}</p>
                  <p className="truncate text-xs text-neutral-500">{k.eposta}</p>
                </div>
                <span className="rozet bg-yesil-100 text-yesil-800">{ROL_ADI[k.temel_rol]}</span>
                {admin && k.temel_rol === "baskan" ? (
                  <form action={kulupRoluVer}>
                    <input type="hidden" name="kullanici" value={k.id} />
                    <input type="hidden" name="rol" value="veli" />
                    <KaydetDugmesi
                      bekleyen="…"
                      className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700"
                    >
                      Başkanlığı kaldır
                    </KaydetDugmesi>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4">
          <h2 className="mb-2 px-1 bolum-basligi">Gruplardaki pozisyonlar</h2>
          <p className="mb-2 px-1 text-xs leading-relaxed text-neutral-500">
            Seçimi yapıp ✓&apos;ye basın. <span className="text-yesil-600">●</span> o grupta çocuğu
            olduğunu gösterir; veli olarak zaten görür, pozisyon gerekmez. Grup yöneticisi grubun aidat,
            ödeme ve kasasını yönetir; antrenör para ekranlarını görmez.
          </p>
          <div className="kart overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                  <th className="px-4 py-2.5 font-semibold">Kişi</th>
                  {gruplar.map((g) => (
                    <th key={g.id} className="px-2 py-2.5 font-semibold">{g.ad}</th>
                  ))}
                  {admin ? <th className="px-2 py-2.5" /> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {digerleri.map((k) => (
                  <tr key={k.id}>
                    <td className="max-w-[220px] px-4 py-2">
                      <p className="truncate font-semibold text-neutral-900">{k.ad_soyad || "İsimsiz"}</p>
                      <p className="truncate text-xs text-neutral-500">{k.eposta}</p>
                    </td>
                    {gruplar.map((g) => (
                      <td key={g.id} className="px-2 py-2">
                        <form action={grupYetkisiVer} className="flex items-center gap-1">
                          <input type="hidden" name="kullanici" value={k.id} />
                          <input type="hidden" name="grup" value={g.id} />
                          <select
                            name="rol"
                            aria-label={`${k.ad_soyad ?? k.eposta} · ${g.ad}`}
                            defaultValue={k.uyelikler[g.id] ?? "yok"}
                            disabled={k.id === user.id}
                            className="alan w-auto px-2 py-1 text-xs"
                          >
                            {POZISYONLAR.map(([d, a]) => (
                              <option key={d} value={d}>{a}</option>
                            ))}
                          </select>
                          {k.cocuk_gruplari.includes(g.id) ? (
                            <span title="Bu grupta çocuğu var" className="text-yesil-600">●</span>
                          ) : null}
                          <KaydetDugmesi
                            bekleyen="…"
                            className="rounded-md bg-neutral-100 px-1.5 py-1 text-[11px] font-semibold text-neutral-600"
                          >
                            ✓
                          </KaydetDugmesi>
                        </form>
                      </td>
                    ))}
                    {admin ? (
                      <td className="px-2 py-2">
                        <form action={kulupRoluVer}>
                          <input type="hidden" name="kullanici" value={k.id} />
                          <input type="hidden" name="rol" value="baskan" />
                          <KaydetDugmesi
                            bekleyen="…"
                            className="whitespace-nowrap rounded-md bg-neutral-100 px-2 py-1 text-[11px] font-semibold text-neutral-600"
                          >
                            Başkan yap
                          </KaydetDugmesi>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 px-1 bolum-basligi">Veliler neyi görür</h2>
          <p className="mb-2 px-1 text-xs leading-relaxed text-neutral-500">
            Grup başına. Yalnızca kaydı onaylanmış çocuğu olan velilere uygulanır; antrenör ve sporcu
            para ekranlarını hiç görmez, grubun yönetimi her zaman görür. Sezon geçişinde grupla birlikte
            taşınır; yeni sezonda buradan değiştirebilirsiniz.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gruplar.map((g) => (
              <form key={g.id} action={gorunurlukKaydet} className="kart space-y-2.5 px-4 py-4">
                <input type="hidden" name="grup" value={g.id} />
                <p className="manset text-xl text-neutral-900">{g.ad}</p>
                {GORUNURLUK.map(([k, a]) => (
                  <label key={k} className="flex items-start gap-2 text-sm text-neutral-700">
                    <input type="checkbox" name={k} defaultChecked={acik(g.id, k)} className="mt-0.5" />
                    <span>{a}</span>
                  </label>
                ))}
                <KaydetDugmesi className="btn-ikincil w-full">Kaydet</KaydetDugmesi>
              </form>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
