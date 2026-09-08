import UstBaslik from "@/components/UstBaslik";
import Ikon from "@/components/ui/Ikon";
import { oturum } from "@/lib/yetki";
import { gunAdi } from "@/lib/format";
import { ANTRENMAN_TURU, YOKLAMA_DURUMU, buHaftaMi, haftaAdi, haftaBasi } from "@/lib/antrenman";
import type { Antrenman, Sporcu, Yoklama } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AntrenmanGunlugu() {
  const { supabase, user } = await oturum();

  const [{ data: antrenmanData }, { data: sporcuData }] = await Promise.all([
    supabase.from("spor_antrenmanlar").select("*").order("tarih", { ascending: false }).limit(160),
    supabase.from("spor_sporcular").select("id, ad, soyad").eq("veli_id", user.id),
  ]);

  const antrenmanlar = (antrenmanData ?? []) as Antrenman[];
  const sporcular = (sporcuData ?? []) as Pick<Sporcu, "id" | "ad" | "soyad">[];
  const idler = sporcular.map((s) => s.id);

  const { data: yoklamaData } = idler.length
    ? await supabase
        .from("spor_yoklama")
        .select("antrenman_id, sporcu_id, durum")
        .in("sporcu_id", idler)
    : { data: [] as Yoklama[] };
  const yoklamalar = (yoklamaData ?? []) as Pick<
    Yoklama,
    "antrenman_id" | "sporcu_id" | "durum"
  >[];

  const haftalar = new Map<string, Antrenman[]>();
  for (const a of antrenmanlar) {
    const h = haftaBasi(a.tarih);
    haftalar.set(h, [...(haftalar.get(h) ?? []), a]);
  }
  const sirali = Array.from(haftalar).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const sporcuAdi = new Map(sporcular.map((s) => [s.id, s.ad]));

  return (
    <>
      <UstBaslik baslik="Antrenman günlüğü" altBaslik="Hafta hafta ne çalışıldı" geri="/panel" />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {sirali.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yesil-50 text-yesil-700">
              <Ikon ad="takvim" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-neutral-800">Henüz antrenman kaydı yok</p>
            <p className="mt-1.5 text-sm text-neutral-500">
              Antrenörler kayıt girdikçe hafta hafta burada birikecek.
            </p>
          </div>
        ) : (
          sirali.map(([hafta, liste]) => (
            <section key={hafta} className="mt-6 first:mt-4">
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-sm font-bold text-neutral-800">{haftaAdi(hafta)}</h2>
                {buHaftaMi(hafta) ? (
                  <span className="rozet bg-yesil-100 text-yesil-800">bu hafta</span>
                ) : null}
                <span className="ml-auto text-xs text-neutral-400">{liste.length} antrenman</span>
              </div>

              <div className="space-y-2.5">
                {liste.map((a) => {
                  const kayitlar = yoklamalar.filter((y) => y.antrenman_id === a.id);
                  return (
                    <article key={a.id} className="kart px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-yesil-50 text-yesil-800">
                          <span className="text-sm font-extrabold leading-none">
                            {new Date(a.tarih + "T00:00:00").getDate()}
                          </span>
                          <span className="text-[9px] font-semibold uppercase">
                            {new Date(a.tarih + "T00:00:00")
                              .toLocaleDateString("tr-TR", { month: "short" })
                              .replace(".", "")}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-snug text-neutral-900">{a.baslik}</p>
                          <p className="mt-0.5 text-xs text-neutral-500">
                            {gunAdi(a.tarih)}
                            {a.baslangic ? ` · ${a.baslangic.slice(0, 5)}` : ""}
                            {a.sure_dk ? ` · ${a.sure_dk} dk` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="rozet bg-neutral-100 text-neutral-700">
                              {ANTRENMAN_TURU[a.tur] ?? a.tur}
                            </span>
                            {a.yas_grubu ? (
                              <span className="rozet bg-neutral-100 text-neutral-700">
                                {a.yas_grubu}
                              </span>
                            ) : null}
                            {a.yer ? (
                              <span className="rozet bg-neutral-100 text-neutral-700">{a.yer}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {a.icerik ? (
                        <p className="mt-3 whitespace-pre-line rounded-xl bg-neutral-50 px-3.5 py-3 text-sm leading-relaxed text-neutral-700">
                          {a.icerik}
                        </p>
                      ) : null}

                      {a.hedef ? (
                        <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                          <span className="font-semibold text-neutral-600">Hedef:</span> {a.hedef}
                        </p>
                      ) : null}

                      {kayitlar.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
                          {kayitlar.map((k) => {
                            const d = YOKLAMA_DURUMU[k.durum];
                            return (
                              <span key={k.sporcu_id} className={`rozet ${d.stil}`}>
                                {sporcuAdi.get(k.sporcu_id) ?? "Sporcu"} · {d.ad}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </article>
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
