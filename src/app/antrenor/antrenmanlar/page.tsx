import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import Ikon from "@/components/ui/Ikon";
import { personelGerekli } from "@/lib/yetki";
import { antrenmanKaydet } from "@/app/antrenor/actions";
import { ANTRENMAN_TURU, buHaftaMi, haftaAdi, haftaBasi } from "@/lib/antrenman";
import type { Antrenman } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Antrenmanlar({
  searchParams,
}: {
  searchParams: Promise<{ yeni?: string }>;
}) {
  const { supabase } = await personelGerekli();
  const sp = await searchParams;

  const [{ data: antrenmanData }, { data: yoklamaData }, { data: gruplarData }] = await Promise.all([
    supabase.from("spor_antrenmanlar").select("*").order("tarih", { ascending: false }).limit(120),
    supabase.from("spor_yoklama").select("antrenman_id, durum"),
    supabase.from("spor_sporcular").select("yas_grubu").eq("durum", "aktif"),
  ]);

  const antrenmanlar = (antrenmanData ?? []) as Antrenman[];
  const yoklamalar = (yoklamaData ?? []) as { antrenman_id: string; durum: string }[];
  const gruplar = Array.from(
    new Set(
      ((gruplarData ?? []) as { yas_grubu: string | null }[])
        .map((g) => g.yas_grubu)
        .filter(Boolean),
    ),
  ).sort() as string[];

  const haftalar = new Map<string, Antrenman[]>();
  for (const a of antrenmanlar) {
    const h = haftaBasi(a.tarih);
    haftalar.set(h, [...(haftalar.get(h) ?? []), a]);
  }
  const sirali = Array.from(haftalar).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const bugun = new Date().toISOString().slice(0, 10);

  return (
    <>
      <UstBaslik baslik="Antrenmanlar" altBaslik={`${antrenmanlar.length} kayıt`} geri="/antrenor" />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <details open={sp.yeni === "1"} className="kart mt-4 overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yesil-600 text-white">
              <Ikon ad="artı" className="h-5 w-5" />
            </span>
            <span className="flex-1 text-sm font-bold text-neutral-900">Yeni antrenman ekle</span>
            <span className="text-neutral-400">▾</span>
          </summary>

          <form action={antrenmanKaydet} className="space-y-4 border-t border-neutral-100 px-4 py-5">
            <div>
              <label className="etiket" htmlFor="baslik">Başlık *</label>
              <input id="baslik" name="baslik" className="alan" required
                placeholder="Pas ve pres çalışması" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="etiket" htmlFor="tarih">Tarih *</label>
                <input id="tarih" name="tarih" type="date" className="alan" required
                  defaultValue={bugun} />
              </div>
              <div>
                <label className="etiket" htmlFor="baslangic">Saat</label>
                <input id="baslangic" name="baslangic" type="time" className="alan" />
              </div>
              <div>
                <label className="etiket" htmlFor="sure_dk">Süre (dk)</label>
                <input id="sure_dk" name="sure_dk" type="number" min="10" max="400"
                  className="alan" placeholder="90" />
              </div>
              <div>
                <label className="etiket" htmlFor="yas_grubu">Yaş grubu</label>
                <input id="yas_grubu" name="yas_grubu" className="alan" list="gruplar"
                  placeholder="U14" />
                <datalist id="gruplar">
                  {gruplar.map((g) => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div>
                <label className="etiket" htmlFor="tur">Tür</label>
                <select id="tur" name="tur" className="alan">
                  {Object.entries(ANTRENMAN_TURU).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="etiket" htmlFor="yer">Yer</label>
                <input id="yer" name="yer" className="alan" placeholder="1 No'lu saha" />
              </div>
            </div>

            <div>
              <label className="etiket" htmlFor="icerik">Ne çalışıldı?</label>
              <textarea id="icerik" name="icerik" className="alan min-h-28 resize-y"
                placeholder="Isınma, 5v2 pas oyunu, yarı sahada pres organizasyonu, bitiriş…" />
            </div>

            <div>
              <label className="etiket" htmlFor="hedef">Hedef / kazanım</label>
              <input id="hedef" name="hedef" className="alan"
                placeholder="Top kaybı sonrası ilk 5 saniye baskı" />
            </div>

            <KaydetDugmesi>Antrenmanı kaydet</KaydetDugmesi>
          </form>
        </details>

        {sirali.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center text-sm text-neutral-500">
            Henüz kayıt yok.
          </div>
        ) : (
          sirali.map(([hafta, liste]) => (
            <section key={hafta} className="mt-6">
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-sm font-bold text-neutral-800">{haftaAdi(hafta)}</h2>
                {buHaftaMi(hafta) ? (
                  <span className="rozet bg-yesil-100 text-yesil-800">bu hafta</span>
                ) : null}
              </div>
              <div className="kart divide-y divide-neutral-100">
                {liste.map((a) => {
                  const katilim = yoklamalar.filter(
                    (y) => y.antrenman_id === a.id && (y.durum === "geldi" || y.durum === "gec"),
                  ).length;
                  const alinmis = yoklamalar.some((y) => y.antrenman_id === a.id);
                  return (
                    <Link
                      key={a.id}
                      href={`/antrenor/antrenmanlar/${a.id}`}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                        <span className="text-sm font-extrabold leading-none">
                          {new Date(a.tarih + "T00:00:00").getDate()}
                        </span>
                        <span className="text-[9px] font-semibold uppercase">
                          {new Date(a.tarih + "T00:00:00")
                            .toLocaleDateString("tr-TR", { weekday: "short" })
                            .replace(".", "")}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{a.baslik}</p>
                        <p className="truncate text-xs text-neutral-500">
                          {ANTRENMAN_TURU[a.tur] ?? a.tur}
                          {a.yas_grubu ? ` · ${a.yas_grubu}` : ""}
                          {a.sure_dk ? ` · ${a.sure_dk} dk` : ""}
                        </p>
                      </div>
                      {alinmis ? (
                        <span className="rozet bg-emerald-100 text-emerald-800">
                          {katilim} katılım
                        </span>
                      ) : (
                        <span className="rozet bg-amber-100 text-amber-900">yoklama yok</span>
                      )}
                      <span className="text-neutral-300">›</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
