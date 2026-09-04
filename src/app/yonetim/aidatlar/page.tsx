import UstBaslik from "@/components/UstBaslik";
import { AidatRozeti } from "@/components/Rozet";
import { yoneticiGerekli } from "@/lib/yetki";
import { aidatDurumGuncelle, aidatSil, donemOlustur } from "@/app/yonetim/actions";
import { bugununDonemi, donemAdi, gecikmisMi, tl } from "@/lib/format";
import KaydetDugmesi from "@/components/KaydetDugmesi";

export const dynamic = "force-dynamic";

type Satir = {
  id: string;
  donem: string;
  tutar: number;
  durum: string;
  son_odeme_tarihi: string | null;
  spor_sporcular: { ad: string; soyad: string; yas_grubu: string | null } | null;
};

export default async function AidatlarSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ donem?: string; durum?: string }>;
}) {
  const { supabase } = await yoneticiGerekli();
  const sp = await searchParams;

  const { data: donemlerData } = await supabase
    .from("spor_aidatlar")
    .select("donem")
    .order("donem", { ascending: false });
  const donemler = Array.from(new Set((donemlerData ?? []).map((d) => d.donem)));

  const seciliDonem = sp.donem ?? donemler[0] ?? bugununDonemi();

  let sorgu = supabase
    .from("spor_aidatlar")
    .select("id, donem, tutar, durum, son_odeme_tarihi, spor_sporcular(ad, soyad, yas_grubu)")
    .eq("donem", seciliDonem)
    .order("durum");
  if (sp.durum) sorgu = sorgu.eq("durum", sp.durum);

  const { data } = await sorgu;
  const satirlar = (data ?? []) as unknown as Satir[];

  const toplam = satirlar.reduce((t, s) => t + Number(s.tutar), 0);
  const bekleyen = satirlar
    .filter((s) => s.durum === "bekliyor")
    .reduce((t, s) => t + Number(s.tutar), 0);

  const buAy = new Date().toISOString().slice(0, 7);

  return (
    <>
      <UstBaslik baslik="Aidatlar" altBaslik="Dönem tahakkuku ve takip" geri="/yonetim" />

      <div className="mx-auto w-full max-w-5xl px-4 pb-24">
        <form action={donemOlustur} className="kart mt-3 space-y-3 px-4 py-4">
          <p className="text-sm font-bold text-neutral-900">Yeni dönem tahakkuku</p>
          <p className="text-xs leading-relaxed text-neutral-500">
            Seçilen ay için <b>aktif</b> ve aylık aidatı tanımlı tüm sporculara borç
            kaydı oluşturulur. Daha önce oluşturulmuş kayıtlar tekrarlanmaz.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="etiket" htmlFor="donem">Dönem</label>
              <input id="donem" name="donem" type="month" className="alan"
                defaultValue={buAy} required />
            </div>
            <div>
              <label className="etiket" htmlFor="son_odeme_tarihi">Son ödeme tarihi</label>
              <input id="son_odeme_tarihi" name="son_odeme_tarihi" type="date" className="alan" />
            </div>
            <div className="flex items-end">
              <KaydetDugmesi bekleyen="Oluşturuluyor…">Tahakkuku oluştur</KaydetDugmesi>
            </div>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {donemler.length > 0 ? (
            <form className="flex items-center gap-2">
              <select name="donem" defaultValue={seciliDonem} className="alan w-auto py-2">
                {donemler.map((d) => (
                  <option key={d} value={d}>{donemAdi(d)}</option>
                ))}
              </select>
              <select name="durum" defaultValue={sp.durum ?? ""} className="alan w-auto py-2">
                <option value="">Tümü</option>
                <option value="bekliyor">Bekleyen</option>
                <option value="odendi">Ödenen</option>
                <option value="muaf">Muaf</option>
              </select>
              <button className="btn-ikincil py-2">Filtrele</button>
            </form>
          ) : null}
        </div>

        {satirlar.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="kart px-4 py-3">
              <p className="text-xs text-neutral-500">Dönem toplamı</p>
              <p className="text-lg font-extrabold">{tl(toplam)}</p>
            </div>
            <div className="kart px-4 py-3">
              <p className="text-xs text-neutral-500">Tahsil edilmeyen</p>
              <p className="text-lg font-extrabold text-red-600">{tl(bekleyen)}</p>
            </div>
          </div>
        ) : null}

        <div className="kart mt-3 divide-y divide-neutral-100">
          {satirlar.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-500">
              Bu dönem için kayıt yok. Yukarıdan tahakkuk oluşturabilirsiniz.
            </p>
          ) : (
            satirlar.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-neutral-900">
                    {s.spor_sporcular?.ad} {s.spor_sporcular?.soyad}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {s.spor_sporcular?.yas_grubu ?? "—"} · {donemAdi(s.donem)}
                    {gecikmisMi(s.son_odeme_tarihi, s.durum) ? " · gecikmiş" : ""}
                  </p>
                </div>
                <span className="text-sm font-bold">{tl(s.tutar)}</span>
                <AidatRozeti durum={s.durum} sonOdeme={s.son_odeme_tarihi} />
                <div className="flex gap-1.5">
                  {s.durum !== "muaf" ? (
                    <form action={aidatDurumGuncelle}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="durum" value="muaf" />
                      <button className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700">
                        Muaf
                      </button>
                    </form>
                  ) : (
                    <form action={aidatDurumGuncelle}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="durum" value="bekliyor" />
                      <button className="rounded-lg bg-neutral-100 px-2.5 py-1.5 text-xs font-semibold text-neutral-700">
                        Geri al
                      </button>
                    </form>
                  )}
                  <form action={aidatSil}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                      Sil
                    </button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
