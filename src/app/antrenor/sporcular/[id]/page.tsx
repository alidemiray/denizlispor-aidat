import Link from "next/link";
import { notFound } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import GelisimBolumu from "@/components/GelisimBolumu";
import { personelGerekli } from "@/lib/yetki";
import { degerlendirmeKaydet, notKaydet, olcumKaydet } from "@/app/antrenor/actions";
import { gunAdi } from "@/lib/format";
import { DEGERLENDIRME_ALANLARI } from "@/lib/antrenman";
import type { Degerlendirme, Olcum, Sporcu, SporcuNotu } from "@/lib/types";

export const dynamic = "force-dynamic";

type YoklamaKayit = { durum: string; spor_antrenmanlar: { tarih: string } | null };
type MacKayit = { dakika: number; spor_maclar: { tarih: string; rakip: string } | null };

export default async function AntrenorSporcuDetay({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, rol } = await personelGerekli();

  const { data: sporcuData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!sporcuData) notFound();
  const sporcu = sporcuData as Sporcu;

  const [
    { data: yoklamaData },
    { data: degData },
    { data: olcumData },
    { data: notData },
    { data: macData },
  ] = await Promise.all([
    supabase
      .from("spor_yoklama")
      .select("durum, spor_antrenmanlar(tarih)")
      .eq("sporcu_id", id),
    supabase.from("spor_degerlendirmeler").select("*").eq("sporcu_id", id).order("donem"),
    supabase.from("spor_olcumler").select("*").eq("sporcu_id", id).order("tarih"),
    supabase
      .from("spor_sporcu_notlari")
      .select("*")
      .eq("sporcu_id", id)
      .order("tarih", { ascending: false })
      .limit(50),
    supabase
      .from("spor_mac_katilim")
      .select("dakika, spor_maclar(tarih, rakip)")
      .eq("sporcu_id", id),
  ]);

  const yoklamalar = ((yoklamaData ?? []) as unknown as YoklamaKayit[])
    .filter((y) => y.spor_antrenmanlar)
    .map((y) => ({ tarih: y.spor_antrenmanlar!.tarih, durum: y.durum }));
  const degerlendirmeler = (degData ?? []) as Degerlendirme[];
  const olcumler = (olcumData ?? []) as Olcum[];
  const notlar = (notData ?? []) as SporcuNotu[];
  const maclar = ((macData ?? []) as unknown as MacKayit[])
    .filter((m) => m.spor_maclar)
    .sort((a, b) => (a.spor_maclar!.tarih < b.spor_maclar!.tarih ? -1 : 1))
    .slice(-8)
    .map((m) => ({
      etiket: new Date(m.spor_maclar!.tarih + "T00:00:00")
        .toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
        .replace(".", ""),
      deger: m.dakika,
    }));

  const sonDeg = degerlendirmeler[degerlendirmeler.length - 1];
  const buAy = new Date().toISOString().slice(0, 7);
  const bugun = new Date().toISOString().slice(0, 10);
  const sonOlcum = olcumler[olcumler.length - 1];

  return (
    <>
      <UstBaslik
        baslik={`${sporcu.ad} ${sporcu.soyad}`}
        altBaslik={
          [sporcu.yas_grubu, sporcu.mevki, sporcu.forma_no ? `#${sporcu.forma_no}` : null]
            .filter(Boolean)
            .join(" · ") || "Denizlispor Altyapı"
        }
        geri="/antrenor/sporcular"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="mt-4">
          <GelisimBolumu
            yoklamalar={yoklamalar}
            degerlendirmeler={degerlendirmeler}
            olcumler={olcumler}
            macDakikalari={maclar}
          />
        </div>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Antrenör notları
        </h2>

        <form action={notKaydet} className="kart space-y-3 px-4 py-4">
          <input type="hidden" name="sporcu_id" value={sporcu.id} />
          <div>
            <label className="etiket" htmlFor="icerik">Yeni not</label>
            <textarea
              id="icerik"
              name="icerik"
              required
              className="alan min-h-24 resize-y"
              placeholder="Bu hafta pas isabetinde belirgin gelişim var; sol ayak çalışmasına devam."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="etiket" htmlFor="tarih">Tarih</label>
              <input id="tarih" name="tarih" type="date" className="alan" defaultValue={bugun} />
            </div>
            <div>
              <label className="etiket" htmlFor="gorunurluk">Kim görsün?</label>
              <select id="gorunurluk" name="gorunurluk" className="alan" defaultValue="veli">
                <option value="veli">Veli de görsün</option>
                <option value="kulup">Sadece kulüp içi</option>
              </select>
            </div>
          </div>
          <KaydetDugmesi>Notu kaydet</KaydetDugmesi>
        </form>

        {notlar.length > 0 ? (
          <div className="kart mt-3 divide-y divide-neutral-100">
            {notlar.map((n) => (
              <div key={n.id} className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-500">
                    {gunAdi(n.tarih)}
                  </span>
                  <span
                    className={`rozet ${
                      n.gorunurluk === "veli"
                        ? "bg-yesil-100 text-yesil-800"
                        : "bg-neutral-200 text-neutral-700"
                    }`}
                  >
                    {n.gorunurluk === "veli" ? "veli görüyor" : "kulüp içi"}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                  {n.icerik}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Dönem değerlendirmesi
        </h2>
        <form action={degerlendirmeKaydet} className="kart space-y-4 px-4 py-5">
          <input type="hidden" name="sporcu_id" value={sporcu.id} />
          <div>
            <label className="etiket" htmlFor="donem">Dönem</label>
            <input id="donem" name="donem" type="month" className="alan" required
              defaultValue={sonDeg ? sonDeg.donem.slice(0, 7) : buAy} />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {DEGERLENDIRME_ALANLARI.map((a) => (
              <div key={a.anahtar}>
                <label className="etiket" htmlFor={a.anahtar}>{a.ad} (1-10)</label>
                <input
                  id={a.anahtar}
                  name={a.anahtar}
                  type="number"
                  min="1"
                  max="10"
                  className="alan text-center"
                  defaultValue={
                    (sonDeg?.[a.anahtar as keyof Degerlendirme] as number | null) ?? ""
                  }
                />
              </div>
            ))}
          </div>

          <div>
            <label className="etiket" htmlFor="yorum">Genel yorum</label>
            <textarea id="yorum" name="yorum" className="alan min-h-24 resize-y"
              defaultValue={sonDeg?.yorum ?? ""} />
          </div>

          <KaydetDugmesi>Değerlendirmeyi kaydet</KaydetDugmesi>
          <p className="text-xs leading-relaxed text-neutral-500">
            Aynı dönem için tekrar kaydederseniz değerler güncellenir; önceki hali kulüp
            arşivinde saklanır.
          </p>
        </form>

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Fiziksel ölçüm
        </h2>
        <form action={olcumKaydet} className="kart space-y-4 px-4 py-5">
          <input type="hidden" name="sporcu_id" value={sporcu.id} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="etiket" htmlFor="olcum_tarih">Tarih</label>
              <input id="olcum_tarih" name="tarih" type="date" className="alan" required
                defaultValue={bugun} />
            </div>
            <div>
              <label className="etiket" htmlFor="boy_cm">Boy (cm)</label>
              <input id="boy_cm" name="boy_cm" inputMode="decimal" className="alan"
                defaultValue={sonOlcum?.boy_cm ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="kilo_kg">Kilo (kg)</label>
              <input id="kilo_kg" name="kilo_kg" inputMode="decimal" className="alan"
                defaultValue={sonOlcum?.kilo_kg ?? ""} />
            </div>
            <div>
              <label className="etiket" htmlFor="sprint_20m">20 m (sn)</label>
              <input id="sprint_20m" name="sprint_20m" inputMode="decimal" className="alan" />
            </div>
            <div>
              <label className="etiket" htmlFor="dikey_sicrama_cm">Sıçrama (cm)</label>
              <input id="dikey_sicrama_cm" name="dikey_sicrama_cm" inputMode="decimal"
                className="alan" />
            </div>
            <div>
              <label className="etiket" htmlFor="dayaniklilik_dk">Dayanıklılık (dk)</label>
              <input id="dayaniklilik_dk" name="dayaniklilik_dk" inputMode="decimal"
                className="alan" />
            </div>
          </div>
          <div>
            <label className="etiket" htmlFor="olcum_not">Not</label>
            <input id="olcum_not" name="notlar" className="alan" />
          </div>
          <KaydetDugmesi>Ölçümü kaydet</KaydetDugmesi>
        </form>

        {rol === "yonetici" ? (
          <Link
            href={`/yonetim/sporcular/${sporcu.id}`}
            className="btn-ikincil mt-6 w-full"
          >
            Yönetim kaydını aç (aidat, belge, veli)
          </Link>
        ) : (
          <p className="mt-6 px-1 text-center text-xs leading-relaxed text-neutral-400">
            Aidat ve ödeme bilgileri antrenör panelinde gösterilmez.
          </p>
        )}
      </div>
    </>
  );
}
