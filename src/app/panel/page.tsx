import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import Ikon from "@/components/ui/Ikon";
import { oturum } from "@/lib/yetki";
import { gunAdi, tl } from "@/lib/format";
import { ANTRENMAN_TURU, haftaBasi } from "@/lib/antrenman";
import { anaEkranYolu, paraGorebilirMi, personelMi, rolAdi, yoneticiMi } from "@/lib/roller";
import type { Aidat, Antrenman, Sporcu, Yoklama } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VeliPaneli() {
  const { supabase, user, profil, rol } = await oturum();
  const paraGorunur = paraGorebilirMi(rol);
  const sporcuHesabi = rol === "sporcu";

  const { data: sporcularData } = await supabase
    .from("spor_sporcular")
    .select("*")
    .or(`veli_id.eq.${user.id},sporcu_kullanici_id.eq.${user.id}`)
    .order("ad");
  const sporcular = (sporcularData ?? []) as Sporcu[];
  const idler = sporcular.map((s) => s.id);

  const [{ data: aidatData }, { data: yoklamaData }, { data: antrenmanData }] = await Promise.all([
    idler.length && paraGorunur
      ? supabase.from("spor_aidatlar").select("*").in("sporcu_id", idler)
      : Promise.resolve({ data: [] as Aidat[] }),
    idler.length
      ? supabase.from("spor_yoklama").select("sporcu_id, durum").in("sporcu_id", idler)
      : Promise.resolve({ data: [] as Yoklama[] }),
    supabase.from("spor_antrenmanlar").select("*").order("tarih", { ascending: false }).limit(8),
  ]);

  const aidatlar = (aidatData ?? []) as Aidat[];
  const yoklamalar = (yoklamaData ?? []) as Pick<Yoklama, "sporcu_id" | "durum">[];
  const antrenmanlar = (antrenmanData ?? []) as Antrenman[];

  const fotoYollari = sporcular.map((s) => s.foto_yolu).filter(Boolean) as string[];
  const fotolar = new Map<string, string>();
  if (fotoYollari.length) {
    const { data: imzali } = await supabase.storage
      .from("spor-belgeler")
      .createSignedUrls(fotoYollari, 60 * 60);
    for (const l of imzali ?? []) if (l.path && l.signedUrl) fotolar.set(l.path, l.signedUrl);
  }

  const bekleyenler = aidatlar.filter((a) => a.durum === "bekliyor");
  const toplamBorc = bekleyenler.reduce((t, a) => t + Number(a.tutar), 0);
  const bugun = new Date().toISOString().slice(0, 10);
  const gecikmis = bekleyenler.filter(
    (a) => a.son_odeme_tarihi && a.son_odeme_tarihi < bugun,
  ).length;

  const buHafta = haftaBasi(bugun);
  const buHaftaki = antrenmanlar.filter((a) => haftaBasi(a.tarih) === buHafta);

  const toplamYoklama = yoklamalar.length;
  const genelDevam = toplamYoklama
    ? Math.round(
        (yoklamalar.filter((y) => y.durum === "geldi" || y.durum === "gec").length /
          toplamYoklama) *
          100,
      )
    : null;

  const ilkAd = profil?.ad_soyad?.trim().split(" ")[0];

  return (
    <>
      <UstBaslik
        baslik={ilkAd ? `Merhaba, ${ilkAd}` : "Merhaba"}
        altBaslik={rolAdi(rol)}
        sag={
          <Link
            href="/panel/hesap"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/12"
            aria-label="Hesabım"
          >
            <Ikon ad="kisiler" className="h-5 w-5" />
          </Link>
        }
      >
        <div className="grid grid-cols-3 gap-2">
          {[
            { ad: sporcuHesabi ? "Kayıt" : "Sporcu", deger: String(sporcular.length) },
            { ad: "Devam", deger: genelDevam === null ? "—" : `%${genelDevam}` },
            { ad: "Bu hafta", deger: `${buHaftaki.length} antr.` },
          ].map((k) => (
            <div key={k.ad} className="rounded-2xl bg-white/[0.14] px-3 py-3 ring-1 ring-white/10">
              <p className="text-xl font-extrabold leading-none">{k.deger}</p>
              <p className="mt-1 text-[11px] text-white/60">{k.ad}</p>
            </div>
          ))}
        </div>
      </UstBaslik>

      <div className="mx-auto w-full max-w-3xl px-4 pb-28">
        {personelMi(rol) ? (
          <Link
            href={anaEkranYolu(rol)}
            className="mt-4 flex items-center gap-3 rounded-2xl bg-neutral-900 px-4 py-3.5 text-white active:scale-[.99]"
          >
            <Ikon ad="kalkan" className="h-5 w-5 text-yesil-300" />
            <div className="flex-1">
              <p className="text-sm font-semibold">
                {yoneticiMi(rol) ? "Kulüp yönetimi" : "Antrenör paneli"}
              </p>
              <p className="text-xs text-white/55">
                {yoneticiMi(rol)
                  ? "Sporcular, aidatlar, kasa, maçlar, antrenmanlar"
                  : "Antrenman günlüğü, yoklama, gelişim"}
              </p>
            </div>
            <span className="text-white/40">›</span>
          </Link>
        ) : null}

        {paraGorunur && toplamBorc > 0 ? (
          <Link href="/panel/aidat" className="mt-4 block">
            <div
              className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 active:scale-[.99] ${
                gecikmis > 0 ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"
              }`}
            >
              <span className="mt-0.5">
                <Ikon ad="cuzdan" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {gecikmis > 0 ? "Gecikmiş aidat borcunuz var" : "Ödenmemiş aidatınız var"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed">
                  {bekleyenler.length} dönem · toplam <b>{tl(toplamBorc)}</b>
                  {gecikmis > 0 ? ` · ${gecikmis} dönemin son ödeme tarihi geçti` : ""}. Ödeme
                  bildirmek için dokunun.
                </p>
              </div>
              <span className="opacity-40">›</span>
            </div>
          </Link>
        ) : null}

        <div className="mb-2 mt-6 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
            {sporcuHesabi ? "Kaydım" : "Sporcularım"}
          </h2>
          {!sporcuHesabi ? (
            <Link href="/panel/sporcu-ekle" className="text-sm font-semibold text-yesil-700">
              + Ekle
            </Link>
          ) : null}
        </div>

        {sporcular.length === 0 ? (
          <div className="kart px-5 py-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-yesil-50 text-yesil-700">
              <Ikon ad="futbol" className="h-7 w-7" />
            </span>
            <p className="mt-3 font-semibold text-neutral-800">
              {sporcuHesabi ? "Hesabınıza bağlı kayıt bulunamadı" : "Hesabınıza tanımlı sporcu yok"}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
              {sporcuHesabi ? (
                <>
                  Kulüp kaydınızda <b>{user.email}</b> adresi tanımlandığında bilgileriniz burada
                  görünür. Veliniz ya da kulüp bu adresi ekleyebilir.
                </>
              ) : (
                <>
                  Kulüp kaydınızda <b>{user.email}</b> adresi tanımlıysa sporcunuz kendiliğinden
                  görünür. Değilse buradan ekleyin, kayıt kulüp onayına gider.
                </>
              )}
            </p>
            {!sporcuHesabi ? (
              <Link href="/panel/sporcu-ekle" className="btn-birincil mt-4">
                Sporcu ekle
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {sporcular.map((s) => {
              const y = yoklamalar.filter((v) => v.sporcu_id === s.id);
              const devam = y.length
                ? Math.round(
                    (y.filter((v) => v.durum === "geldi" || v.durum === "gec").length / y.length) *
                      100,
                  )
                : null;
              const foto = s.foto_yolu ? fotolar.get(s.foto_yolu) : null;

              return (
                <Link key={s.id} href={`/panel/sporcu/${s.id}`} className="block">
                  <article className="kart flex items-center gap-3.5 px-4 py-4 active:scale-[.99]">
                    {foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto} alt="" className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-yesil-500 to-yesil-700 text-lg font-bold text-white">
                        {s.ad[0]}
                        {s.soyad[0]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-neutral-900">
                        {s.ad} {s.soyad}
                      </p>
                      <p className="truncate text-xs text-neutral-500">
                        {[s.yas_grubu, s.mevki, s.forma_no ? `#${s.forma_no}` : null]
                          .filter(Boolean)
                          .join(" · ") || "Denizlispor Altyapı"}
                      </p>
                      {s.durum === "onay_bekliyor" ? (
                        <span className="rozet mt-2 bg-amber-100 text-amber-900">
                          Kulüp onayı bekliyor
                        </span>
                      ) : (
                        <p className="mt-1.5 text-xs font-semibold text-neutral-600">
                          Antrenman devamı: {devam === null ? "kayıt yok" : `%${devam}`}
                        </p>
                      )}
                    </div>
                    <span className="text-neutral-300">›</span>
                  </article>
                </Link>
              );
            })}
          </div>
        )}

        {paraGorunur ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link href="/panel/aidat" className="block">
              <div className="kart flex items-center gap-3 px-4 py-3.5 active:scale-[.99]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                  <Ikon ad="cuzdan" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">Aidat durumu</p>
                  <p className="truncate text-xs text-neutral-500">
                    {toplamBorc > 0 ? `${tl(toplamBorc)} bekleyen ödeme` : "Güncel borcunuz yok"}
                  </p>
                </div>
                <span className="text-neutral-300">›</span>
              </div>
            </Link>

            <Link href="/panel/kasa" className="block">
              <div className="kart flex items-center gap-3 px-4 py-3.5 active:scale-[.99]">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
                  <Ikon ad="pano" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-neutral-900">Kulüp kasası</p>
                  <p className="truncate text-xs text-neutral-500">
                    Havuz, kulübe aktarılan tutar, ödemeyenler
                  </p>
                </div>
                <span className="text-neutral-300">›</span>
              </div>
            </Link>
          </div>
        ) : null}

        <div className="mb-2 mt-7 flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
            Bu hafta antrenman
          </h2>
          <Link href="/panel/antrenman" className="text-sm font-semibold text-yesil-700">
            Günlük
          </Link>
        </div>

        {buHaftaki.length === 0 ? (
          <div className="kart px-5 py-6 text-center text-sm text-neutral-500">
            Bu hafta için henüz antrenman kaydı girilmemiş.
          </div>
        ) : (
          <div className="kart divide-y divide-neutral-100">
            {buHaftaki.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-yesil-50 text-yesil-800">
                  <span className="text-sm font-extrabold leading-none">
                    {new Date(a.tarih + "T00:00:00").getDate()}
                  </span>
                  <span className="text-[9px] font-semibold uppercase">
                    {new Date(a.tarih + "T00:00:00")
                      .toLocaleDateString("tr-TR", { month: "short" })
                      .replace(".", "")}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{a.baslik}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {ANTRENMAN_TURU[a.tur] ?? a.tur}
                    {a.sure_dk ? ` · ${a.sure_dk} dk` : ""}
                    {a.yas_grubu ? ` · ${a.yas_grubu}` : ""}
                  </p>
                </div>
                <span className="text-[11px] text-neutral-400">{gunAdi(a.tarih).slice(0, 6)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
