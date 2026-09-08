import UstBaslik from "@/components/UstBaslik";
import { SutunGrafik } from "@/components/ui/Grafik";
import { paraEkraniGerekli } from "@/lib/yetki";
import { donemAdi, gunAdi, tl } from "@/lib/format";

export const dynamic = "force-dynamic";

type KasaSatir = {
  ay: string;
  tahsilat: number;
  ek_gelir: number;
  aktarim: number;
  gider: number;
};

type Hareket = {
  id: string;
  tarih: string;
  tur: string;
  tutar: number;
  kategori: string | null;
  aciklama: string | null;
};

type Odemeyen = {
  donem: string;
  ad: string;
  soyad: string;
  yas_grubu: string | null;
  tutar: number;
  gecikti: boolean;
  benim: boolean;
};

const TUR_ADI: Record<string, string> = {
  aktarim: "Kulübe aktarım",
  gider: "Gider",
  gelir: "Ek gelir",
};

export default async function VeliKasa() {
  const { supabase } = await paraEkraniGerekli();

  const [{ data: ozetData }, { data: hareketData }, { data: odemeyenData }] = await Promise.all([
    supabase.rpc("spor_kasa_ozeti"),
    supabase
      .from("spor_kasa_hareketleri")
      .select("id, tarih, tur, tutar, kategori, aciklama")
      .order("tarih", { ascending: false })
      .limit(40),
    supabase.rpc("spor_odemeyenler", { p_donem: null }),
  ]);

  const ozet = ((ozetData ?? []) as KasaSatir[]).map((s) => ({
    ...s,
    tahsilat: Number(s.tahsilat),
    ek_gelir: Number(s.ek_gelir),
    aktarim: Number(s.aktarim),
    gider: Number(s.gider),
  }));
  const hareketler = (hareketData ?? []) as Hareket[];

  const toplamGelir = ozet.reduce((t, s) => t + s.tahsilat + s.ek_gelir, 0);
  const toplamAktarim = ozet.reduce((t, s) => t + s.aktarim, 0);
  const toplamGider = ozet.reduce((t, s) => t + s.gider, 0);
  const havuz = toplamGelir - toplamAktarim - toplamGider;

  // Ödemeyenler dönem dönem gruplanır; en yeni üç dönem gösterilir.
  const odemeyenler = (odemeyenData ?? []) as Odemeyen[];
  const gruplar = new Map<string, Odemeyen[]>();
  for (const o of odemeyenler) {
    const liste = gruplar.get(o.donem) ?? [];
    liste.push(o);
    gruplar.set(o.donem, liste);
  }
  const odemeyenListeleri = Array.from(gruplar.entries())
    .slice(0, 3)
    .map(([donem, satirlar]) => ({ donem, satirlar }));

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
      <UstBaslik
        baslik="Kulüp kasası"
        altBaslik="Toplanan aidat, kulübe aktarılan tutar ve havuz"
        geri="/panel"
      >
        <div className="rounded-2xl bg-white/[0.14] px-4 py-4 ring-1 ring-white/10">
          <p className="text-[11px] text-white/60">Havuzda kalan tutar</p>
          <p className="mt-1 text-3xl font-extrabold leading-none">{tl(havuz)}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/60">
            Onaylanmış tahsilat ve ek gelirlerden, kulübe aktarılan tutarlar ile giderler
            düşülerek hesaplanır.
          </p>
        </div>
      </UstBaslik>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { ad: "Toplanan", deger: toplamGelir },
            { ad: "Aktarılan", deger: toplamAktarim },
            { ad: "Gider", deger: toplamGider },
          ].map((k) => (
            <div key={k.ad} className="kart px-3 py-3">
              <p className="text-[11px] text-neutral-500">{k.ad}</p>
              <p className="mt-0.5 text-sm font-extrabold text-neutral-900">{tl(k.deger)}</p>
            </div>
          ))}
        </div>

        {grafik.length > 0 ? (
          <div className="kart mt-4 px-4 py-4">
            <p className="text-sm font-bold text-neutral-900">Ay ay kulübe aktarılan</p>
            <div className="mt-2">
              <SutunGrafik veri={grafik} birim="₺" />
            </div>
          </div>
        ) : null}

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Ay ay hareket
        </h2>
        {ozet.length === 0 ? (
          <div className="kart px-5 py-8 text-center text-sm text-neutral-500">
            Henüz kasa hareketi yok.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {ozet.map((s) => (
              <div key={s.ay} className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900">{donemAdi(s.ay)}</p>
                  <p className="ml-auto text-sm font-extrabold text-yesil-700">
                    +{tl(s.tahsilat + s.ek_gelir)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Kulübe aktarılan {tl(s.aktarim)}
                  {s.gider > 0 ? ` · gider ${tl(s.gider)}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}

        {hareketler.length > 0 ? (
          <>
            <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
              Aktarım ve giderler
            </h2>
            <div className="kart divide-y divide-neutral-100">
              {hareketler.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {h.kategori || TUR_ADI[h.tur] || h.tur}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {gunAdi(h.tarih)}
                      {h.aciklama ? ` · ${h.aciklama}` : ""}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      h.tur === "gelir" ? "text-yesil-700" : "text-neutral-700"
                    }`}
                  >
                    {h.tur === "gelir" ? "+" : "−"}
                    {tl(h.tutar)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <h2 className="mb-2 mt-7 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
          Ödemesi görünmeyenler
        </h2>
        <div className="kart mb-3 px-4 py-3.5">
          <p className="text-xs leading-relaxed text-neutral-600">
            Havuzun neden eksik kaldığı görülebilsin diye paylaşılır. İsimler{" "}
            <b>gizlenerek</b> gösterilir; ödeme yapıldıysa liste kendiliğinden güncellenir.
          </p>
        </div>

        {odemeyenListeleri.length === 0 ? (
          <div className="kart px-5 py-8 text-center text-sm text-neutral-500">
            Son dönemlerde ödenmemiş aidat görünmüyor.
          </div>
        ) : (
          <div className="space-y-4">
            {odemeyenListeleri.map((g) => {
              const toplam = g.satirlar.reduce((t, s) => t + Number(s.tutar), 0);
              return (
                <div key={g.donem} className="kart overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-3">
                    <p className="text-sm font-bold text-neutral-900">{donemAdi(g.donem)}</p>
                    <p className="ml-auto text-xs font-semibold text-red-600">
                      {g.satirlar.length} kişi · {tl(toplam)}
                    </p>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {g.satirlar.map((s, i) => (
                      <div key={`${g.donem}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                        <p className="min-w-0 flex-1 truncate font-mono text-sm text-neutral-700">
                          {s.ad} {s.soyad}
                          {s.benim ? (
                            <span className="rozet ml-2 bg-amber-100 font-sans text-amber-900">
                              sizin sporcunuz
                            </span>
                          ) : null}
                        </p>
                        {s.yas_grubu ? (
                          <span className="rozet bg-neutral-100 text-neutral-600">
                            {s.yas_grubu}
                          </span>
                        ) : null}
                        <span className="text-sm font-semibold text-neutral-800">
                          {tl(s.tutar)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
