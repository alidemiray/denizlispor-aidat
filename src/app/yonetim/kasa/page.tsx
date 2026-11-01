import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import { SutunGrafik } from "@/components/ui/Grafik";
import { yoneticiGerekli } from "@/lib/yetki";
import { kasaAcilisKaydet, kasaEkle, kasaSil } from "@/app/yonetim/actions";
import { donemAdi, gunAdi, tl } from "@/lib/format";

export const dynamic = "force-dynamic";

type KasaSatir = {
  ay: string;
  tahsilat: number;
  ek_gelir: number;
  aktarim: number;
  gider: number;
  /** 20261107 göçüyle gelir */
  acilis?: number;
};

type Hareket = {
  id: string;
  tarih: string;
  tur: string;
  tutar: number;
  kategori: string | null;
  aciklama: string | null;
};

const TUR_ADI: Record<string, string> = {
  aktarim: "Kulübe aktarım",
  gider: "Gider",
  gelir: "Ek gelir",
  acilis: "Açılış bakiyesi",
};

function AcilisFormu({ tarih, tutar }: { tarih: string; tutar?: number }) {
  return (
    <form action={kasaAcilisKaydet} className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
      <div>
        <label className="etiket" htmlFor="acilis-tutar">Tutar (₺)</label>
        <input id="acilis-tutar" name="tutar" inputMode="decimal" className="alan" required
          defaultValue={tutar ?? ""} placeholder="0" />
      </div>
      <div>
        <label className="etiket" htmlFor="acilis-tarih">Tarih</label>
        <input id="acilis-tarih" name="tarih" type="date" className="alan" required defaultValue={tarih} />
      </div>
      <KaydetDugmesi bekleyen="…" className="btn-birincil px-4">Kaydet</KaydetDugmesi>
    </form>
  );
}

export default async function YonetimKasa() {
  const { supabase } = await yoneticiGerekli();

  const [{ data: ozetData }, { data: hareketData }] = await Promise.all([
    supabase.rpc("spor_kasa_ozeti"),
    supabase
      .from("spor_kasa_hareketleri")
      .select("id, tarih, tur, tutar, kategori, aciklama")
      .order("tarih", { ascending: false })
      .limit(80),
  ]);

  const ozet = ((ozetData ?? []) as KasaSatir[]).map((s) => ({
    ...s,
    tahsilat: Number(s.tahsilat),
    ek_gelir: Number(s.ek_gelir),
    aktarim: Number(s.aktarim),
    gider: Number(s.gider),
    acilis: Number(s.acilis ?? 0),
  }));
  const hareketler = (hareketData ?? []) as Hareket[];

  const toplamGelir = ozet.reduce((t, s) => t + s.tahsilat + s.ek_gelir, 0);
  const toplamAktarim = ozet.reduce((t, s) => t + s.aktarim, 0);
  const toplamGider = ozet.reduce((t, s) => t + s.gider, 0);
  const acilis = ozet.reduce((t, s) => t + (s.acilis ?? 0), 0);
  const havuz = acilis + toplamGelir - toplamAktarim - toplamGider;

  const bugun = new Date().toISOString().slice(0, 10);
  const acilisHareketi = hareketler.find((h) => h.tur === "acilis");

  const grafik = ozet
    .slice(0, 8)
    .reverse()
    .map((s) => ({
      etiket: new Date(s.ay + "T00:00:00")
        .toLocaleDateString("tr-TR", { month: "short" })
        .replace(".", ""),
      deger: Math.round(s.aktarim),
      ipucu: `${donemAdi(s.ay)}: ${tl(s.aktarim)} aktarıldı`,
    }));

  return (
    <>
      <UstBaslik baslik="Kasa" altBaslik="Havuz, kulübe aktarım ve giderler" geri="/yonetim/daha">
        <div className="rounded-2xl bg-white/[0.07] px-4 py-4 ring-1 ring-white/10">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-yesil-500">Havuzda kalan</p>
          <p className="mt-2 font-manset text-[44px] font-extrabold leading-none">{tl(havuz)}</p>
        </div>
      </UstBaslik>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {acilisHareketi ? (
          <details className="kart mt-4 px-4 py-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm">
              <span className="flex-1 text-neutral-600">
                Açılış bakiyesi · {gunAdi(acilisHareketi.tarih)}
              </span>
              <span className="font-bold text-neutral-900">{tl(acilisHareketi.tutar)}</span>
              <span className="text-xs font-semibold text-yesil-700">Düzelt</span>
            </summary>
            <AcilisFormu tarih={acilisHareketi.tarih} tutar={acilisHareketi.tutar} />
          </details>
        ) : (
          <div className="mt-4 rounded-2xl bg-amber-50/80 px-4 py-4 ring-1 ring-amber-500/25">
            <p className="text-sm font-bold text-neutral-900">Kasanın açılış bakiyesini girin</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Uygulamaya geçmeden önce kasada olan tutar. Havuz bu tutarla başlar; veliler kasa
              ekranında &quot;Açılış bakiyesi&quot; olarak görür. Kasa boş başladıysa 0 girin.
            </p>
            <AcilisFormu tarih={bugun} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { ad: "Tahsilat", deger: toplamGelir },
            { ad: "Aktarılan", deger: toplamAktarim },
            { ad: "Gider", deger: toplamGider },
          ].map((k) => (
            <div key={k.ad} className="kart px-3 py-3">
              <p className="text-[11px] text-neutral-500">{k.ad}</p>
              <p className="mt-0.5 text-sm font-extrabold text-neutral-900">{tl(k.deger)}</p>
            </div>
          ))}
        </div>

        <form action={kasaEkle} className="kart mt-4 space-y-3 px-4 py-4">
          <p className="text-sm font-bold text-neutral-900">Hareket ekle</p>
          <p className="text-xs leading-relaxed text-neutral-500">
            Kulübe aktarılan tutarları ve havuzdan yapılan harcamaları buraya girin.
            Veliler bu kayıtları kasa ekranında görür.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiket" htmlFor="tur">Tür</label>
              <select id="tur" name="tur" className="alan" defaultValue="aktarim">
                <option value="aktarim">Kulübe aktarım</option>
                <option value="gider">Gider (malzeme, ulaşım…)</option>
                <option value="gelir">Ek gelir (bağış, sponsor…)</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="tutar">Tutar (₺)</label>
              <input id="tutar" name="tutar" className="alan" inputMode="decimal" required />
            </div>
            <div>
              <label className="etiket" htmlFor="tarih">Tarih</label>
              <input id="tarih" name="tarih" type="date" className="alan" required
                defaultValue={bugun} />
            </div>
            <div>
              <label className="etiket" htmlFor="kategori">Başlık</label>
              <input id="kategori" name="kategori" className="alan"
                placeholder="Ekim ayı aktarımı" />
            </div>
          </div>

          <div>
            <label className="etiket" htmlFor="aciklama">Açıklama</label>
            <input id="aciklama" name="aciklama" className="alan" />
          </div>

          <KaydetDugmesi>Hareketi kaydet</KaydetDugmesi>
        </form>

        {grafik.length > 0 ? (
          <div className="kart mt-4 px-4 py-4">
            <p className="text-sm font-bold text-neutral-900">Ay ay kulübe aktarılan</p>
            <div className="mt-2">
              <SutunGrafik veri={grafik} birim="₺" />
            </div>
          </div>
        ) : null}

        <h2 className="mb-2 mt-7 px-1 bolum-basligi">
          Hareketler
        </h2>
        <div className="kart divide-y divide-neutral-100">
          {hareketler.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              Henüz hareket girilmedi.
            </p>
          ) : (
            hareketler.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {h.kategori || TUR_ADI[h.tur] || h.tur}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {gunAdi(h.tarih)} · {TUR_ADI[h.tur] ?? h.tur}
                    {h.aciklama ? ` · ${h.aciklama}` : ""}
                  </p>
                </div>
                <span
                  className={`text-sm font-bold ${
                    h.tur === "gelir" || h.tur === "acilis" ? "text-yesil-700" : "text-neutral-700"
                  }`}
                >
                  {h.tur === "gelir" || h.tur === "acilis" ? "+" : "−"}
                  {tl(h.tutar)}
                </span>
                {h.tur === "acilis" ? <span className="w-[38px]" /> : (
                <form action={kasaSil}>
                  <input type="hidden" name="id" value={h.id} />
                  <button className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700">
                    Sil
                  </button>
                </form>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
