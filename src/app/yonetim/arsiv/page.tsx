import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";

export const dynamic = "force-dynamic";

type Kayit = {
  id: number;
  tablo: string;
  kayit_id: string | null;
  islem: string;
  eski: Record<string, unknown>;
  zaman: string;
};

const TABLO_ADI: Record<string, string> = {
  spor_antrenmanlar: "Antrenman",
  spor_sporcu_notlari: "Antrenör notu",
  spor_degerlendirmeler: "Değerlendirme",
};

const ISLEM_ADI: Record<string, { ad: string; stil: string }> = {
  UPDATE: { ad: "Değiştirildi", stil: "bg-amber-100 text-amber-900" },
  DELETE: { ad: "Silindi", stil: "bg-red-100 text-red-800" },
};

function ozet(k: Kayit) {
  const e = k.eski;
  if (k.tablo === "spor_antrenmanlar") return [e.tarih, e.baslik].filter(Boolean).join(" · ");
  if (k.tablo === "spor_sporcu_notlari") return String(e.icerik ?? "").slice(0, 160);
  if (k.tablo === "spor_degerlendirmeler")
    return `Dönem ${String(e.donem ?? "")} · ${String(e.yorum ?? "").slice(0, 120)}`;
  return JSON.stringify(e).slice(0, 160);
}

export default async function Arsiv() {
  const { supabase } = await yoneticiGerekli();

  const { data } = await supabase
    .from("spor_kayit_gecmisi")
    .select("*")
    .order("zaman", { ascending: false })
    .limit(120);
  const kayitlar = (data ?? []) as unknown as Kayit[];

  return (
    <>
      <UstBaslik
        baslik="Kayıt arşivi"
        altBaslik="Değiştirilen ve silinen içeriklerin önceki hali"
        geri="/yonetim/daha"
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        <div className="kart -mt-3 px-4 py-4">
          <p className="text-sm font-semibold text-neutral-900">Neden var?</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Antrenman günlüğü, antrenör notları ve değerlendirmeler kulübün hafızasıdır. Bir
            antrenör ayrılırken içerik kaybolmasın diye bu kayıtları yalnızca yönetim silebilir;
            silinen veya değiştirilen her kaydın önceki hali burada saklanır.
          </p>
        </div>

        {kayitlar.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center text-sm text-neutral-500">
            Arşivde kayıt yok — henüz hiçbir içerik değiştirilmedi veya silinmedi.
          </div>
        ) : (
          <div className="kart mt-4 divide-y divide-neutral-100">
            {kayitlar.map((k) => {
              const i = ISLEM_ADI[k.islem] ?? {
                ad: k.islem,
                stil: "bg-neutral-100 text-neutral-700",
              };
              return (
                <div key={k.id} className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {TABLO_ADI[k.tablo] ?? k.tablo}
                    </span>
                    <span className={`rozet ${i.stil}`}>{i.ad}</span>
                    <span className="ml-auto text-[11px] text-neutral-400">
                      {new Date(k.zaman).toLocaleString("tr-TR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">{ozet(k)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
