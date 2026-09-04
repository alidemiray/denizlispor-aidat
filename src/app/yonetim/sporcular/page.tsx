import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { tl } from "@/lib/format";
import type { Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SporcularSayfasi() {
  const { supabase } = await yoneticiGerekli();

  const { data } = await supabase
    .from("spor_sporcular")
    .select("*")
    .order("durum")
    .order("ad");
  const sporcular = (data ?? []) as Sporcu[];

  const { data: borclar } = await supabase
    .from("spor_aidatlar")
    .select("sporcu_id, tutar, durum")
    .eq("durum", "bekliyor");

  const borcHarita = new Map<string, number>();
  for (const b of borclar ?? []) {
    borcHarita.set(b.sporcu_id, (borcHarita.get(b.sporcu_id) ?? 0) + Number(b.tutar));
  }

  return (
    <>
      <UstBaslik
        baslik="Sporcular"
        altBaslik={`${sporcular.length} kayıt`}
        geri="/yonetim"
        sag={
          <Link
            href="/yonetim/sporcular/yeni"
            className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-yesil-700"
          >
            + Yeni
          </Link>
        }
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-24">
        {sporcular.length === 0 ? (
          <div className="kart mt-3 px-5 py-10 text-center">
            <p className="font-semibold text-neutral-800">Henüz sporcu yok</p>
            <p className="mt-1 text-sm text-neutral-500">
              İlk sporcuyu ekleyerek başlayın.
            </p>
            <Link href="/yonetim/sporcular/yeni" className="btn-birincil mt-4">
              Sporcu ekle
            </Link>
          </div>
        ) : (
          <div className="kart mt-3 divide-y divide-neutral-100">
            {sporcular.map((s) => {
              const borc = borcHarita.get(s.id) ?? 0;
              return (
                <Link
                  key={s.id}
                  href={`/yonetim/sporcular/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
                      s.durum === "aktif" ? "bg-yesil-600" : "bg-neutral-400"
                    }`}
                  >
                    {s.ad[0]}
                    {s.soyad[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-900">
                      {s.ad} {s.soyad}
                      {s.durum === "pasif" ? (
                        <span className="ml-2 rozet bg-neutral-200 text-neutral-600">
                          Pasif
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {[s.yas_grubu, s.veli_eposta].filter(Boolean).join(" · ") || "—"}
                      {s.veli_id ? " · veli bağlı ✓" : " · veli kaydolmadı"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-neutral-900">{tl(s.aylik_aidat)}</p>
                    {borc > 0 ? (
                      <p className="text-[11px] font-semibold text-red-600">
                        borç {tl(borc)}
                      </p>
                    ) : (
                      <p className="text-[11px] text-neutral-400">borç yok</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
