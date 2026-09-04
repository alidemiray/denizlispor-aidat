import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import { personelGerekli } from "@/lib/yetki";
import type { Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AntrenorSporcular() {
  const { supabase } = await personelGerekli();

  const [{ data: sporcuData }, { data: yoklamaData }, { data: notData }] = await Promise.all([
    supabase.from("spor_sporcular").select("*").eq("durum", "aktif").order("ad"),
    supabase.from("spor_yoklama").select("sporcu_id, durum"),
    supabase.from("spor_sporcu_notlari").select("sporcu_id"),
  ]);

  const sporcular = (sporcuData ?? []) as Sporcu[];
  const yoklamalar = (yoklamaData ?? []) as { sporcu_id: string; durum: string }[];
  const notlar = (notData ?? []) as { sporcu_id: string }[];

  const gruplar = new Map<string, Sporcu[]>();
  for (const s of sporcular) {
    const g = s.yas_grubu ?? "Grup belirtilmemiş";
    gruplar.set(g, [...(gruplar.get(g) ?? []), s]);
  }
  const sirali = Array.from(gruplar).sort((a, b) => a[0].localeCompare(b[0], "tr"));

  return (
    <>
      <UstBaslik baslik="Sporcular" altBaslik={`${sporcular.length} aktif sporcu`} geri="/antrenor" />

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {sporcular.length === 0 ? (
          <div className="kart mt-4 px-5 py-10 text-center text-sm text-neutral-500">
            Aktif sporcu bulunmuyor.
          </div>
        ) : (
          sirali.map(([grup, liste]) => (
            <section key={grup} className="mt-6 first:mt-4">
              <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-neutral-500">
                {grup}
                <span className="ml-2 font-medium normal-case text-neutral-400">
                  ({liste.length})
                </span>
              </h2>
              <div className="kart divide-y divide-neutral-100">
                {liste.map((s) => {
                  const y = yoklamalar.filter((v) => v.sporcu_id === s.id);
                  const devam = y.length
                    ? Math.round(
                        (y.filter((v) => v.durum === "geldi" || v.durum === "gec").length /
                          y.length) *
                          100,
                      )
                    : null;
                  const notSayisi = notlar.filter((n) => n.sporcu_id === s.id).length;

                  return (
                    <Link
                      key={s.id}
                      href={`/antrenor/sporcular/${s.id}`}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yesil-500 to-yesil-700 text-sm font-bold text-white">
                        {s.ad[0]}
                        {s.soyad[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-neutral-900">
                          {s.ad} {s.soyad}
                        </p>
                        <p className="truncate text-xs text-neutral-500">
                          {[s.mevki, s.forma_no ? `#${s.forma_no}` : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                          {notSayisi > 0 ? ` · ${notSayisi} not` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-neutral-900">
                          {devam === null ? "—" : `%${devam}`}
                        </p>
                        <p className="text-[10px] text-neutral-400">devam</p>
                      </div>
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
