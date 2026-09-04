import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { kadroKaydet, macKaydet, macSil } from "@/app/yonetim/actions";
import { gunAdi } from "@/lib/format";
import { macBasligi } from "@/lib/mac";
import type { Mac, MacKatilim, Sporcu } from "@/lib/types";
import KaydetDugmesi from "@/components/KaydetDugmesi";

export const dynamic = "force-dynamic";

export default async function MacDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await yoneticiGerekli();

  const { data: macData } = await supabase
    .from("spor_maclar").select("*").eq("id", id).maybeSingle();
  if (!macData) notFound();
  const mac = macData as Mac;

  let sorgu = supabase
    .from("spor_sporcular")
    .select("*")
    .eq("durum", "aktif")
    .order("ad");
  if (mac.yas_grubu) sorgu = sorgu.eq("yas_grubu", mac.yas_grubu);

  const [{ data: sporcuData }, { data: katilimData }] = await Promise.all([
    sorgu,
    supabase.from("spor_mac_katilim").select("*").eq("mac_id", id),
  ]);

  const sporcular = (sporcuData ?? []) as Sporcu[];
  const katilimlar = (katilimData ?? []) as MacKatilim[];
  const harita = new Map(katilimlar.map((k) => [k.sporcu_id, k]));

  return (
    <>
      <UstBaslik
        baslik={macBasligi(mac)}
        altBaslik={`${gunAdi(mac.tarih)}${mac.yas_grubu ? ` · ${mac.yas_grubu}` : ""}`}
        geri="/yonetim/maclar"
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28">
        <form action={macKaydet} className="kart mt-3 space-y-3 px-4 py-4">
          <input type="hidden" name="id" value={mac.id} />
          <p className="text-sm font-bold text-neutral-900">Maç bilgileri</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="etiket" htmlFor="tarih">Tarih</label>
              <input id="tarih" name="tarih" type="date" className="alan" required
                defaultValue={mac.tarih} />
            </div>
            <div>
              <label className="etiket" htmlFor="saat">Saat</label>
              <input id="saat" name="saat" type="time" className="alan"
                defaultValue={mac.saat?.slice(0, 5) ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="rakip">Rakip</label>
              <input id="rakip" name="rakip" className="alan" required defaultValue={mac.rakip} />
            </div>
            <div>
              <label className="etiket" htmlFor="yas_grubu">Yaş grubu</label>
              <input id="yas_grubu" name="yas_grubu" className="alan"
                defaultValue={mac.yas_grubu ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="yer">Saha</label>
              <select id="yer" name="yer" className="alan" defaultValue={mac.yer}>
                <option value="ic">İç saha</option>
                <option value="dis">Deplasman</option>
                <option value="notr">Nötr saha</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="tur">Tür</label>
              <select id="tur" name="tur" className="alan" defaultValue={mac.tur}>
                <option value="lig">Lig</option>
                <option value="kupa">Kupa</option>
                <option value="hazirlik">Hazırlık</option>
                <option value="turnuva">Turnuva</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="skor_biz">Denizlispor golü</label>
              <input id="skor_biz" name="skor_biz" type="number" min="0" className="alan"
                defaultValue={mac.skor_biz ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="skor_rakip">Rakip golü</label>
              <input id="skor_rakip" name="skor_rakip" type="number" min="0" className="alan"
                defaultValue={mac.skor_rakip ?? ""} />
            </div>
            <div className="flex items-end">
              <KaydetDugmesi>Kaydet</KaydetDugmesi>
            </div>
          </div>
        </form>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Kadro ve oynanan süre
        </h2>

        {sporcular.length === 0 ? (
          <div className="kart px-5 py-8 text-center text-sm text-neutral-500">
            {mac.yas_grubu
              ? `"${mac.yas_grubu}" yaş grubunda aktif sporcu bulunamadı. Maçın yaş grubunu boş bırakırsanız tüm sporcular listelenir.`
              : "Aktif sporcu yok."}
          </div>
        ) : (
          <form action={kadroKaydet} className="kart overflow-hidden">
            <input type="hidden" name="mac_id" value={mac.id} />
            <div className="hidden grid-cols-[1fr_5rem_4rem_4rem_4rem_8rem] gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500 sm:grid">
              <span>Sporcu</span>
              <span className="text-center">Dakika</span>
              <span className="text-center">İlk 11</span>
              <span className="text-center">Gol</span>
              <span className="text-center">Asist</span>
              <span>Kart</span>
            </div>

            <div className="divide-y divide-neutral-100">
              {sporcular.map((s) => {
                const k = harita.get(s.id);
                return (
                  <div key={s.id}
                    className="grid grid-cols-2 items-center gap-2 px-4 py-3 sm:grid-cols-[1fr_5rem_4rem_4rem_4rem_8rem]">
                    <div className="col-span-2 min-w-0 sm:col-span-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {s.ad} {s.soyad}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {[s.yas_grubu, s.mevki, s.forma_no ? `#${s.forma_no}` : null]
                          .filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <label className="text-xs text-neutral-500 sm:sr-only">Dakika</label>
                    <input name={`dakika_${s.id}`} type="number" min="0" max="130"
                      className="alan py-2 text-center" defaultValue={k?.dakika ?? 0} />
                    <label className="text-xs text-neutral-500 sm:sr-only">İlk 11</label>
                    <div className="flex justify-center">
                      <input name={`ilk11_${s.id}`} type="checkbox"
                        defaultChecked={k?.ilk_onbir ?? false}
                        className="h-5 w-5 rounded border-neutral-300 accent-yesil-600" />
                    </div>
                    <label className="text-xs text-neutral-500 sm:sr-only">Gol</label>
                    <input name={`gol_${s.id}`} type="number" min="0"
                      className="alan py-2 text-center" defaultValue={k?.gol ?? 0} />
                    <label className="text-xs text-neutral-500 sm:sr-only">Asist</label>
                    <input name={`asist_${s.id}`} type="number" min="0"
                      className="alan py-2 text-center" defaultValue={k?.asist ?? 0} />
                    <label className="text-xs text-neutral-500 sm:sr-only">Kart</label>
                    <select name={`kart_${s.id}`} className="alan py-2"
                      defaultValue={k?.kart ?? "yok"}>
                      <option value="yok">Kart yok</option>
                      <option value="sari">Sarı</option>
                      <option value="cift_sari">Çift sarı</option>
                      <option value="kirmizi">Kırmızı</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">
              <KaydetDugmesi className="btn-birincil w-full sm:w-auto sm:px-8">
                Süreleri kaydet
              </KaydetDugmesi>
              <p className="mt-2 text-xs text-neutral-500">
                Dakikası 0 olan ve hiçbir katkısı işaretlenmeyen sporcu bu maçta oynamamış
                sayılır; velisinin ekranında görünmez.
              </p>
            </div>
          </form>
        )}

        <form action={macSil} className="kart mt-6 px-4 py-4">
          <input type="hidden" name="id" value={mac.id} />
          <p className="text-sm font-semibold text-neutral-800">Maçı sil</p>
          <p className="mt-1 text-xs text-neutral-500">
            Maçla birlikte tüm süre kayıtları da silinir.
          </p>
          <KaydetDugmesi
            bekleyen="Siliniyor…"
            className="btn mt-3 w-full bg-red-50 text-red-700 ring-1 ring-red-600/20 sm:w-auto sm:px-8"
          >
            Maçı sil
          </KaydetDugmesi>
        </form>
      </div>
    </>
  );
}
