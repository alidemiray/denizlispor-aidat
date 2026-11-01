import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { sporcuDurumGuncelle } from "@/app/yonetim/actions";
import { gunAdi, tl } from "@/lib/format";
import type { Sporcu } from "@/lib/types";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import { sporcuBirlestir } from "@/app/yonetim/veli-actions";

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

  // Olası çift kayıtlar (ör. anne ve baba ayrı ayrı kaydetmiş); göç yoksa boş
  const { data: ciftData } = await supabase.rpc("spor_olasi_ciftler");
  const ciftler = (Array.isArray(ciftData) ? ciftData : []) as {
    ana_id: string;
    kopya_id: string;
    ad: string;
    soyad: string;
    ana_veli: string | null;
    kopya_veli: string | null;
  }[];

  const bekleyenler = sporcular.filter((s) => s.durum === "onay_bekliyor");
  const digerleri = sporcular.filter((s) => s.durum !== "onay_bekliyor");

  return (
    <>
      <UstBaslik genis
        baslik="Sporcular"
        altBaslik={`${sporcular.length} kayıt`}
        geri="/yonetim"
        sag={
          <div className="flex items-center gap-2">
            <Link
              href="/yonetim/sporcular/ice-aktar"
              className="flex h-10 items-center rounded-full bg-white/12 px-3 text-xs font-bold text-white"
            >
              Excel&apos;den aktar
            </Link>
            <Link
              href="/yonetim/sporcular/yeni"
              className="flex h-10 items-center rounded-full bg-yuzey px-3 text-xs font-bold text-yesil-700"
            >
              + Yeni
            </Link>
          </div>
        }
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28">
        {ciftler.length > 0 ? (
          <section className="mt-4 rounded-2xl bg-amber-50/70 px-4 py-4 ring-1 ring-amber-500/20">
            <h2 className="text-sm font-bold text-neutral-900">Olası çift kayıt ({ciftler.length})</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Aynı çocuk iki kez kaydedilmiş olabilir (çoğu zaman anne ve baba ayrı ayrı). Birleştirince
              aidat, ödeme, yoklama, gelişim, belge ve zimmet tek kayda toplanır; ikinci kaydın velisi
              ikinci veli olur. Aynı dönemin iki aidatı varsa tek aidata iner, ödemeler korunur.
            </p>
            <ul className="mt-3 space-y-2">
              {ciftler.map((c) => (
                <li key={c.kopya_id} className="kart flex flex-wrap items-center gap-2 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{c.ad} {c.soyad}</p>
                    <p className="text-xs text-neutral-500">
                      <Link href={`/yonetim/sporcular/${c.ana_id}`} className="underline">1. kayıt</Link>: {c.ana_veli || "veli yok"}
                      {" · "}
                      <Link href={`/yonetim/sporcular/${c.kopya_id}`} className="underline">2. kayıt</Link>: {c.kopya_veli || "veli yok"}
                    </p>
                  </div>
                  <form action={sporcuBirlestir}>
                    <input type="hidden" name="ana" value={c.ana_id} />
                    <input type="hidden" name="kopya" value={c.kopya_id} />
                    <KaydetDugmesi bekleyen="Birleştiriliyor…" className="rounded-lg bg-yesil-500 px-3 py-2 text-xs font-bold text-anametin">
                      Tek kayıtta birleştir
                    </KaydetDugmesi>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {bekleyenler.length > 0 ? (
          <>
            <h2 className="mb-2 mt-4 px-1 text-sm font-bold uppercase tracking-wide text-amber-700">
              Veli kaydı — onay bekleyen ({bekleyenler.length})
            </h2>
            <p className="-mt-1 mb-2 px-1 text-xs text-neutral-500">
              Deneme dersi planlamak için{" "}
              <Link href="/yonetim/on-kayit" className="font-semibold text-yesil-700">Ön kayıt ve adaylar</Link>{" "}
              ekranını kullanın.
            </p>
            <div className="divide-y divide-amber-500/15 rounded-2xl bg-amber-50/70 ring-1 ring-amber-500/20">
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
                      className="rounded-xl bg-yesil-500 px-4 py-2.5 text-sm font-bold text-anametin disabled:opacity-50"
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
                      s.durum === "aktif" ? "bg-yesil-500" : "bg-neutral-400"
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
