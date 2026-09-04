import UstBaslik from "@/components/UstBaslik";
import Ikon from "@/components/ui/Ikon";
import { oturum } from "@/lib/yetki";
import { gunAdi } from "@/lib/format";
import { KART_ADI, MAC_TURU, macBasligi, skorMetni, sonucRozeti } from "@/lib/mac";
import type { Mac, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

type Katilim = {
  sporcu_id: string;
  mac_id: string;
  dakika: number;
  ilk_onbir: boolean;
  gol: number;
  asist: number;
  kart: string;
};

export default async function VeliMaclar() {
  const { supabase, user } = await oturum();

  const [{ data: macData }, { data: sporcuData }] = await Promise.all([
    supabase.from("spor_maclar").select("*").order("tarih", { ascending: false }).limit(60),
    supabase.from("spor_sporcular").select("id, ad, soyad").eq("veli_id", user.id),
  ]);

  const maclar = (macData ?? []) as Mac[];
  const sporcular = (sporcuData ?? []) as Pick<Sporcu, "id" | "ad" | "soyad">[];
  const idler = sporcular.map((s) => s.id);

  const { data: katilimData } = idler.length
    ? await supabase
        .from("spor_mac_katilim")
        .select("sporcu_id, mac_id, dakika, ilk_onbir, gol, asist, kart")
        .in("sporcu_id", idler)
    : { data: [] as Katilim[] };
  const katilimlar = (katilimData ?? []) as Katilim[];
  const sporcuAdi = new Map(sporcular.map((s) => [s.id, s.ad]));

  return (
    <>
      <UstBaslik baslik="Maçlar" altBaslik="Fikstür, sonuçlar ve oynanan süre" />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {maclar.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yesil-50 text-yesil-700">
              <Ikon ad="futbol" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-neutral-800">Henüz maç kaydı yok</p>
            <p className="mt-1.5 text-sm text-neutral-500">
              Kulüp maç ve süreleri girdikçe burada görünecek.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {maclar.map((m) => {
              const skor = skorMetni(m);
              const sonuc = sonucRozeti(m);
              const benimkiler = katilimlar.filter((k) => k.mac_id === m.id);
              return (
                <article key={m.id} className="kart px-4 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                      <span className="text-sm font-extrabold leading-none">
                        {new Date(m.tarih + "T00:00:00").getDate()}
                      </span>
                      <span className="text-[9px] font-semibold uppercase">
                        {new Date(m.tarih + "T00:00:00")
                          .toLocaleDateString("tr-TR", { month: "short" })
                          .replace(".", "")}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-900">{macBasligi(m)}</p>
                      <p className="truncate text-xs text-neutral-500">
                        {gunAdi(m.tarih)}
                        {m.saat ? ` · ${m.saat.slice(0, 5)}` : ""} · {MAC_TURU[m.tur] ?? m.tur}
                        {m.yas_grubu ? ` · ${m.yas_grubu}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      {skor ? (
                        <p className="text-lg font-extrabold leading-none text-neutral-900">
                          {skor}
                        </p>
                      ) : (
                        <p className="text-[11px] text-neutral-400">skor yok</p>
                      )}
                      {sonuc ? (
                        <span className={`rozet mt-1.5 ${sonuc.stil}`}>{sonuc.ad}</span>
                      ) : null}
                    </div>
                  </div>

                  {benimkiler.length > 0 ? (
                    <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                      {benimkiler.map((k) => (
                        <div key={k.sporcu_id} className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-neutral-800">
                            {sporcuAdi.get(k.sporcu_id)}
                          </span>
                          <span className="text-neutral-500">
                            {k.dakika}′ · {k.ilk_onbir ? "ilk 11" : k.dakika > 0 ? "yedekten" : "oynamadı"}
                            {k.gol > 0 ? ` · ${k.gol} gol` : ""}
                            {k.asist > 0 ? ` · ${k.asist} asist` : ""}
                            {k.kart !== "yok" ? ` · ${KART_ADI[k.kart]}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
