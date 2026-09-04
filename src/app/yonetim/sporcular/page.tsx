import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { sporcuDurumGuncelle } from "@/app/yonetim/actions";
import { gunAdi, tl } from "@/lib/format";
import type { Sporcu } from "@/lib/types";
import KaydetDugmesi from "@/components/KaydetDugmesi";

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

  const bekleyenler = sporcular.filter((s) => s.durum === "onay_bekliyor");
  const digerleri = sporcular.filter((s) => s.durum !== "onay_bekliyor");

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

      <div className="mx-auto w-full max-w-5xl px-4 pb-28">
        {bekleyenler.length > 0 ? (
          <>
            <h2 className="mb-2 mt-4 px-1 text-sm font-bold uppercase tracking-wide text-amber-700">
              Veli kaydı — onay bekleyen ({bekleyenler.length})
            </h2>
            <div className="kart divide-y divide-neutral-100 border-l-4 border-amber-400">
              {bekleyenler.map((s) => (
                <div key={s.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/yonetim/sporcular/${s.id}`}
                        className="truncate font-semibold text-neutral-900">
                        {s.ad} {s.soyad}
                      </Link>
                      <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                        {[
                          s.dogum_tarihi ? gunAdi(s.dogum_tarihi) : null,
                          s.mevki,
                          s.okul,
                        ].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs text-neutral-500">
                        Veli: {s.veli_ad_soyad || "—"}
                        {s.veli_telefon ? ` · ${s.veli_telefon}` : ""} · {s.veli_eposta}
                      </p>
                      {s.notlar ? (
                        <p className="mt-1 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">
                          {s.notlar}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <form action={sporcuDurumGuncelle}
                    className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="durum" value="aktif" />
                    <div className="w-28">
                      <label className="etiket text-xs">Yaş grubu</label>
                      <input name="yas_grubu" className="alan py-2" placeholder="U14" />
                    </div>
                    <div className="w-32">
                      <label className="etiket text-xs">Aylık aidat (₺)</label>
                      <input name="aylik_aidat" inputMode="decimal" className="alan py-2"
                        placeholder="0" />
                    </div>
                    <KaydetDugmesi
                      bekleyen="Onaylanıyor…"
                      className="rounded-xl bg-yesil-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Onayla ve aktif et
                    </KaydetDugmesi>
                  </form>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {digerleri.length === 0 && bekleyenler.length === 0 ? (
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
            {digerleri.map((s) => {
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
