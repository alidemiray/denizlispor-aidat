import Link from "next/link";
import { redirect } from "next/navigation";
import UstBaslik from "@/components/UstBaslik";
import CikisDugmesi from "@/components/CikisDugmesi";
import { AidatRozeti } from "@/components/Rozet";
import { createClient } from "@/lib/supabase/server";
import { donemAdi, gecikmisMi, tl } from "@/lib/format";
import type { Aidat, Sporcu } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VeliPaneli() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/giris");

  const { data: profil } = await supabase.rpc("spor_profil");

  const yonetici = profil?.rol === "yonetici";

  // Veli paneli her zaman yalnızca kişinin kendi sporcularını gösterir —
  // yöneticinin de çocuğu olabilir, o da burada kendi çocuğunu görür.
  const { data: sporcularData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .eq("veli_id", user.id)
    .order("ad");
  const sporcular = (sporcularData ?? []) as Sporcu[];

  const idler = sporcular.map((s) => s.id);
  const { data: aidatData } = idler.length
    ? await supabase
        .from("spor_aidatlar")
        .select("*")
        .in("sporcu_id", idler)
        .order("donem", { ascending: false })
    : { data: [] as Aidat[] };
  const aidatlar = (aidatData ?? []) as Aidat[];

  const { data: bekleyenOdemeler } = idler.length
    ? await supabase
        .from("spor_odemeler")
        .select("id, sporcu_id")
        .in("sporcu_id", idler)
        .eq("durum", "beklemede")
    : { data: [] as { id: string; sporcu_id: string }[] };

  const toplamBorc = aidatlar
    .filter((a) => a.durum === "bekliyor")
    .reduce((t, a) => t + Number(a.tutar), 0);
  const gecikmisSayisi = aidatlar.filter((a) =>
    gecikmisMi(a.son_odeme_tarihi, a.durum),
  ).length;
  const bekleyenBildirim = (bekleyenOdemeler ?? []).length;

  const ad = profil?.ad_soyad?.split(" ")[0] ?? "Merhaba";

  return (
    <>
      <UstBaslik
        baslik={profil?.ad_soyad ?? "Veli paneli"}
        altBaslik={user.email ?? undefined}
        sag={<CikisDugmesi />}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-24">
        {yonetici ? (
          <Link href="/yonetim" className="mt-3 block">
            <div className="kart flex items-center gap-3 border-l-4 border-yesil-600 px-4 py-3">
              <span className="text-xl">🛡️</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-neutral-900">Kulüp yönetimi</p>
                <p className="text-xs text-neutral-500">
                  Sporcular, aidatlar, ödemeler ve maçlar
                </p>
              </div>
              <span className="text-neutral-400">›</span>
            </div>
          </Link>
        ) : null}

        <section className={yonetici ? "mt-3" : "-mt-3"}>
          <div className="kart overflow-hidden">
            <div className="bg-white px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Toplam aidat borcu
              </p>
              <p
                className={`mt-1 text-3xl font-extrabold tracking-tight ${
                  toplamBorc > 0 ? "text-neutral-900" : "text-emerald-700"
                }`}
              >
                {tl(toplamBorc)}
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                {toplamBorc > 0
                  ? `${aidatlar.filter((a) => a.durum === "bekliyor").length} ödenmemiş dönem${
                      gecikmisSayisi > 0 ? ` · ${gecikmisSayisi} gecikmiş` : ""
                    }`
                  : "Güncel borcunuz bulunmuyor. Teşekkürler!"}
              </p>
            </div>
            <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
              <Link href="/panel/aidat-akisi" className="btn-ikincil w-full">
                Aidat akış tablosu
              </Link>
            </div>
            {sporcular.length > 0 ? (
              <div className="border-t border-neutral-100 bg-neutral-50/60 px-5 py-3">
                <Link href="/panel/odeme-bildir" className="btn-birincil w-full">
                  Ödeme bildir
                </Link>
                {bekleyenBildirim > 0 ? (
                  <p className="mt-2 text-center text-xs text-amber-700">
                    {bekleyenBildirim} ödeme bildiriminiz kulüp onayında.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <div className="mb-2 mt-7 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
            Sporcularım
          </h2>
          <Link href="/panel/sporcu-ekle" className="text-sm font-semibold text-yesil-700">
            + Sporcu ekle
          </Link>
        </div>

        {sporcular.length === 0 ? (
          <div className="kart px-5 py-8 text-center">
            <p className="text-4xl">⚽</p>
            <p className="mt-3 font-semibold text-neutral-800">
              Hesabınıza tanımlı sporcu yok
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              Kulüp kaydınızda <b>{user.email}</b> adresi tanımlıysa sporcunuz kendiliğinden
              görünür. Değilse sporcunuzu buradan ekleyebilirsiniz; kayıt kulüp onayına gider.
            </p>
            <Link href="/panel/sporcu-ekle" className="btn-birincil mt-4">
              Sporcu ekle
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sporcular.map((s) => {
              const kendi = aidatlar.filter((a) => a.sporcu_id === s.id);
              const borc = kendi
                .filter((a) => a.durum === "bekliyor")
                .reduce((t, a) => t + Number(a.tutar), 0);
              const sonuncu = kendi[0];
              return (
                <Link key={s.id} href={`/panel/sporcu/${s.id}`} className="block">
                  <article className="kart flex items-center gap-4 px-4 py-4 active:scale-[.99]">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yesil-600 text-base font-bold text-white">
                      {s.ad[0]}
                      {s.soyad[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-neutral-900">
                        {s.ad} {s.soyad}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {[s.yas_grubu, s.mevki, s.forma_no ? `#${s.forma_no}` : null]
                          .filter(Boolean)
                          .join(" · ") || "Denizlispor Altyapı"}
                      </p>
                      {sonuncu ? (
                        <div className="mt-2 flex items-center gap-2">
                          <AidatRozeti
                            durum={sonuncu.durum}
                            sonOdeme={sonuncu.son_odeme_tarihi}
                          />
                          <span className="text-xs text-neutral-400">
                            {donemAdi(sonuncu.donem)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      {s.durum === "onay_bekliyor" ? (
                        <span className="rozet bg-amber-100 text-amber-900">Onay bekliyor</span>
                      ) : (
                        <p
                          className={`text-sm font-bold ${
                            borc > 0 ? "text-neutral-900" : "text-emerald-700"
                          }`}
                        >
                          {borc > 0 ? tl(borc) : "Borç yok"}
                        </p>
                      )}
                      <p className="text-[11px] text-neutral-400">detay ›</p>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-400">
          Denizlispor Altyapı · Sporcu Takip
          <br />
          Sorularınız için kulüp yönetimine ulaşın.
        </p>
      </div>
    </>
  );
}
