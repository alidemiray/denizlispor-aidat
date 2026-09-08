import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import { personelGerekli } from "@/lib/yetki";
import { antrenmanKaydet, yoklamaKaydet } from "@/app/antrenor/actions";
import { gunAdi } from "@/lib/format";
import { ANTRENMAN_TURU, YOKLAMA_DURUMU } from "@/lib/antrenman";
import type { Antrenman, Sporcu, Yoklama } from "@/lib/types";

export const dynamic = "force-dynamic";

const SECENEKLER = ["geldi", "gec", "izinli", "gelmedi", "kayitsiz"] as const;

export default async function AntrenmanDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, rol } = await personelGerekli();

  const { data: antrenmanData } = await supabase
    .from("spor_antrenmanlar")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!antrenmanData) notFound();
  const antrenman = antrenmanData as Antrenman;

  let sorgu = supabase
    .from("spor_sporcular")
    .select("id, ad, soyad, yas_grubu, mevki, forma_no")
    .eq("durum", "aktif")
    .order("ad");
  if (antrenman.yas_grubu) sorgu = sorgu.eq("yas_grubu", antrenman.yas_grubu);

  const [{ data: sporcuData }, { data: yoklamaData }] = await Promise.all([
    sorgu,
    supabase.from("spor_yoklama").select("*").eq("antrenman_id", id),
  ]);

  const sporcular = (sporcuData ?? []) as Pick<
    Sporcu,
    "id" | "ad" | "soyad" | "yas_grubu" | "mevki" | "forma_no"
  >[];
  const yoklamalar = (yoklamaData ?? []) as Yoklama[];
  const harita = new Map(yoklamalar.map((y) => [y.sporcu_id, y]));

  const katilan = yoklamalar.filter((y) => y.durum === "geldi" || y.durum === "gec").length;

  return (
    <>
      <UstBaslik
        baslik={antrenman.baslik}
        altBaslik={`${gunAdi(antrenman.tarih)} · ${ANTRENMAN_TURU[antrenman.tur] ?? antrenman.tur}`}
        geri="/antrenor/antrenmanlar"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="kart -mt-3 grid grid-cols-3 divide-x divide-neutral-100">
          {[
            ["Katılım", `${katilan}/${sporcular.length}`],
            ["Süre", antrenman.sure_dk ? `${antrenman.sure_dk} dk` : "—"],
            ["Grup", antrenman.yas_grubu ?? "Tümü"],
          ].map(([k, v]) => (
            <div key={k} className="px-2 py-4 text-center">
              <p className="text-lg font-extrabold text-neutral-900">{v}</p>
              <p className="text-[11px] text-neutral-500">{k}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-2 mt-6 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Yoklama
        </h2>

        {sporcular.length === 0 ? (
          <div className="kart px-5 py-8 text-center text-sm text-neutral-500">
            {antrenman.yas_grubu
              ? `"${antrenman.yas_grubu}" grubunda aktif sporcu yok. Antrenmanın yaş grubunu boş bırakırsanız tüm sporcular listelenir.`
              : "Aktif sporcu yok."}
          </div>
        ) : (
          <form action={yoklamaKaydet} className="kart overflow-hidden">
            <input type="hidden" name="antrenman_id" value={antrenman.id} />
            <div className="divide-y divide-neutral-100">
              {sporcular.map((s) => {
                const mevcut = harita.get(s.id)?.durum ?? "kayitsiz";
                return (
                  <div key={s.id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
                        {s.ad[0]}
                        {s.soyad[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {s.ad} {s.soyad}
                        </p>
                        <p className="truncate text-[11px] text-neutral-500">
                          {[s.yas_grubu, s.mevki].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-5 gap-1">
                      {SECENEKLER.map((d) => {
                        const bilgi =
                          d === "kayitsiz"
                            ? { ad: "Kayıtsız", stil: "bg-neutral-100 text-neutral-500" }
                            : YOKLAMA_DURUMU[d];
                        return (
                          <label key={d} className="cursor-pointer">
                            <input
                              type="radio"
                              name={`durum_${s.id}`}
                              value={d}
                              defaultChecked={mevcut === d}
                              className="peer sr-only"
                            />
                            <span
                              className={`block rounded-lg px-1 py-2 text-center text-[10.5px] font-semibold ring-1 ring-transparent transition peer-checked:ring-2 peer-checked:ring-yesil-600 ${bilgi.stil}`}
                            >
                              {bilgi.ad}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
              <KaydetDugmesi>Yoklamayı kaydet</KaydetDugmesi>
            </div>
          </form>
        )}

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Antrenman içeriği
        </h2>
        <form action={antrenmanKaydet} className="kart space-y-4 px-4 py-5">
          <input type="hidden" name="id" value={antrenman.id} />
          <div>
            <label className="etiket" htmlFor="baslik">Başlık</label>
            <input id="baslik" name="baslik" className="alan" required
              defaultValue={antrenman.baslik} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiket" htmlFor="tarih">Tarih</label>
              <input id="tarih" name="tarih" type="date" className="alan" required
                defaultValue={antrenman.tarih} />
            </div>
            <div>
              <label className="etiket" htmlFor="baslangic">Saat</label>
              <input id="baslangic" name="baslangic" type="time" className="alan"
                defaultValue={antrenman.baslangic?.slice(0, 5) ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="sure_dk">Süre (dk)</label>
              <input id="sure_dk" name="sure_dk" type="number" className="alan"
                defaultValue={antrenman.sure_dk ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="yas_grubu">Yaş grubu</label>
              <input id="yas_grubu" name="yas_grubu" className="alan"
                defaultValue={antrenman.yas_grubu ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="tur">Tür</label>
              <select id="tur" name="tur" className="alan" defaultValue={antrenman.tur}>
                {Object.entries(ANTRENMAN_TURU).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="yer">Yer</label>
              <input id="yer" name="yer" className="alan" defaultValue={antrenman.yer ?? ""} />
            </div>
          </div>
          <div>
            <label className="etiket" htmlFor="icerik">Ne çalışıldı?</label>
            <textarea id="icerik" name="icerik" className="alan min-h-28 resize-y"
              defaultValue={antrenman.icerik ?? ""} />
          </div>
          <div>
            <label className="etiket" htmlFor="hedef">Hedef / kazanım</label>
            <input id="hedef" name="hedef" className="alan" defaultValue={antrenman.hedef ?? ""} />
          </div>
          <KaydetDugmesi>Değişiklikleri kaydet</KaydetDugmesi>
        </form>

        <p className="mt-4 px-1 text-xs leading-relaxed text-neutral-500">
          Bu kayıt kulüp arşivine işlenir. Yapılan her değişikliğin öncesi saklanır ve
          antrenman kayıtları yalnızca kulüp yönetimi tarafından silinebilir.
          {rol === "yonetici" ? " Silme işlemini Yönetim → Arşiv üzerinden yapabilirsiniz." : ""}
        </p>
      </div>
    </>
  );
}
