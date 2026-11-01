import { gruplarim } from "@/lib/grup";
import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import BildirimZili from "@/components/BildirimZili";
import Ikon, { type IkonAdi } from "@/components/ui/Ikon";
import { yoneticiGerekli } from "@/lib/yetki";
import { bugununDonemi, donemAdi, gunAdi, tl } from "@/lib/format";
import { arsivGetir, sezonDurumu } from "@/lib/arsiv";
import { bugunkuSezon, bugunTR, sezonAdi } from "@/lib/sezon";
import { kalanGunMetni, yaklasanDogumGunleri } from "@/lib/dogumGunu";

export const dynamic = "force-dynamic";

type Is = { sayi: number; baslik: string; aciklama: string; yol: string; ikon: IkonAdi; acil?: boolean };

function gunOnce(gun: number) {
  const d = new Date(bugunTR() + "T00:00:00");
  d.setDate(d.getDate() - gun);
  return d.toISOString().slice(0, 10);
}

export default async function YonetimOzet() {
  const { supabase, profil } = await yoneticiGerekli();
  const bugun = bugunTR();
  const donem = bugununDonemi();
  const ikiHafta = gunOnce(14);
  const kirkBesGun = gunOnce(45);

  const [
    { data: sporcuData },
    { data: aidatData },
    { data: odemeData },
    { data: talepData },
    { data: antData },
    { data: devamData },
    { data: eksikData },
    { data: macData },
    arsiv,
  ] = await Promise.all([
    supabase.from("spor_sporcular").select("id, ad, soyad, durum, yas_grubu, dogum_tarihi"),
    supabase.from("spor_aidatlar").select("id, sporcu_id, donem, tutar, durum, son_odeme_tarihi"),
    supabase.from("spor_odemeler").select("id, tutar, durum"),
    supabase.from("spor_rol_talepleri").select("id").eq("durum", "beklemede"),
    supabase
      .from("spor_antrenmanlar")
      .select("id, tarih, baslangic, baslik, yas_grubu, spor_yoklama(count)")
      .gte("tarih", ikiHafta)
      .lte("tarih", bugun)
      .order("tarih", { ascending: false }),
    supabase
      .from("spor_yoklama")
      .select("sporcu_id, durum, spor_antrenmanlar!inner(tarih)")
      .gte("spor_antrenmanlar.tarih", kirkBesGun),
    supabase.rpc("spor_eksik_tahakkuk", { p_donem: donem }),
    supabase
      .from("spor_maclar")
      .select("id, tarih, saat, rakip, yas_grubu")
      .gte("tarih", bugun)
      .order("tarih")
      .limit(3),
    arsivGetir(supabase),
  ]);
  // Kasa açılış bakiyesi girilmemişse (gruplar göçünden sonra) yapılacaklara düşer
  const gruplu = (await gruplarim(supabase)).length > 0;
  const { data: acilisData } = gruplu
    ? await supabase.from("spor_kasa_hareketleri").select("id").eq("tur", "acilis").limit(1)
    : { data: [{ id: "" }] };
  const acilisEksik = (acilisData ?? []).length === 0 ? 1 : 0;

  const sporcular = (sporcuData ?? []) as { id: string; ad: string; soyad: string; durum: string; yas_grubu: string | null; dogum_tarihi: string | null }[];
  const aidatlar = (aidatData ?? []) as { sporcu_id: string; donem: string; tutar: number; durum: string; son_odeme_tarihi: string | null }[];
  const aktif = sporcular.filter((s) => s.durum === "aktif");
  const dogumGunleri = yaklasanDogumGunleri(aktif, bugun);
  const onayBekleyenSporcu = sporcular.filter((s) => s.durum === "onay_bekliyor").length;

  // Bu dönemin tahsilat oranı
  const buDonem = aidatlar.filter((a) => a.donem === donem && a.durum !== "muaf");
  const buDonemToplam = buDonem.reduce((t, a) => t + Number(a.tutar), 0);
  const buDonemOdenen = buDonem.filter((a) => a.durum === "odendi").reduce((t, a) => t + Number(a.tutar), 0);
  const tahsilatOrani = buDonemToplam > 0 ? Math.round((100 * buDonemOdenen) / buDonemToplam) : null;

  const bekleyenAlacak = aidatlar.filter((a) => a.durum === "bekliyor").reduce((t, a) => t + Number(a.tutar), 0);
  const gecikmis = aidatlar.filter((a) => a.durum === "bekliyor" && a.son_odeme_tarihi && a.son_odeme_tarihi < bugun);
  const gecikmisSporcu = new Set(gecikmis.map((a) => a.sporcu_id)).size;
  const tahsilEdilen = (odemeData ?? []).filter((o) => o.durum === "onaylandi").reduce((t, o) => t + Number(o.tutar), 0);
  const odemeOnayi = (odemeData ?? []).filter((o) => o.durum === "beklemede").length;

  type AntSatir = { id: string; tarih: string; baslangic: string | null; baslik: string; yas_grubu: string | null; spor_yoklama: { count: number }[] };
  const antrenmanlar = (antData ?? []) as AntSatir[];
  const yoklamasiz = antrenmanlar.filter(
    (a) => (a.spor_yoklama?.[0]?.count ?? 0) === 0 && (a.tarih < bugun || (a.baslangic ?? "00:00") < new Date().toTimeString().slice(0, 5)),
  );
  const bugunku = antrenmanlar.filter((a) => a.tarih === bugun);

  // Devamı düşen sporcular: son 45 günde en az 4 yoklama, devam < %60
  const devam = new Map<string, { geldi: number; sayilan: number }>();
  for (const y of (devamData ?? []) as { sporcu_id: string; durum: string }[]) {
    if (y.durum === "izinli") continue;
    const d = devam.get(y.sporcu_id) ?? { geldi: 0, sayilan: 0 };
    d.sayilan += 1;
    if (y.durum === "geldi" || y.durum === "gec") d.geldi += 1;
    devam.set(y.sporcu_id, d);
  }
  const riskli = aktif
    .map((s) => ({ s, d: devam.get(s.id) }))
    .filter((x) => x.d && x.d.sayilan >= 4 && x.d.geldi / x.d.sayilan < 0.6)
    .map((x) => ({ ...x, oran: Math.round((100 * x.d!.geldi) / x.d!.sayilan) }))
    .sort((a, b) => a.oran - b.oran)
    .slice(0, 5);

  const eksikTahakkuk = (eksikData ?? []).length;
  const sezonBekleyen = arsiv
    ? [...new Set([bugunkuSezon() - 1, ...arsiv.sezonlar.keys()])].filter(
        (y) => sezonDurumu(y, arsiv.sezonlar.get(y)) === "kapanis_bekliyor",
      )
    : [];

  const tumIsler: Is[] = [
    { sayi: acilisEksik, baslik: "grubun kasa açılış bakiyesi girilmedi", aciklama: "Uygulamadan önce kasada olan tutarı girin", yol: "/yonetim/kasa", ikon: "pano", acil: true },
    { sayi: odemeOnayi, baslik: "ödeme bildirimi onay bekliyor", aciklama: "Dekontu inceleyip onaylayın", yol: "/yonetim/odemeler", ikon: "kontrol", acil: true },
    { sayi: eksikTahakkuk, baslik: `sporcunun ${donemAdi(donem)} borcu oluşmamış`, aciklama: "Eksik tahakkukları tek dokunuşla tamamlayın", yol: "/yonetim/aidatlar", ikon: "cuzdan", acil: true },
    { sayi: onayBekleyenSporcu, baslik: "yeni sporcu kaydı onay bekliyor", aciklama: "Deneme dersi planlayın ya da kesin kayda alın", yol: "/yonetim/on-kayit", ikon: "kisiler" },
    { sayi: (talepData ?? []).length, baslik: "yetki talebi bekliyor", aciklama: "Antrenör / yönetim başvurusu", yol: "/yonetim/ayarlar", ikon: "kalkan" },
    { sayi: gecikmisSporcu, baslik: "sporcunun gecikmiş aidatı var", aciklama: "Son ödeme tarihi geçmiş", yol: "/yonetim/aidatlar", ikon: "zil" },
    { sayi: yoklamasiz.length, baslik: "antrenmanın yoklaması alınmamış", aciklama: "Son 14 gün", yol: yoklamasiz[0] ? `/antrenor/antrenmanlar/${yoklamasiz[0].id}` : "/antrenor/antrenmanlar", ikon: "takvim" },
    { sayi: sezonBekleyen.length, baslik: `sezon mühürlenmeyi bekliyor${sezonBekleyen.length ? ` (${sezonBekleyen.map(sezonAdi).join(", ")})` : ""}`, aciklama: "Kayıtları kontrol edip arşive işleyin", yol: sezonBekleyen[0] ? `/yonetim/sezonlar/${sezonBekleyen[0]}` : "/yonetim/sezonlar", ikon: "arsiv" },
  ];
  const isler = tumIsler.filter((i) => i.sayi > 0);

  const kutular = [
    { ad: "Aktif sporcu", deger: String(aktif.length), yol: "/yonetim/sporcular" },
    { ad: `${donemAdi(donem)} tahsilat`, deger: tahsilatOrani === null ? "–" : `%${tahsilatOrani}`, yol: "/yonetim/aidatlar" },
    { ad: "Bekleyen alacak", deger: tl(bekleyenAlacak), yol: "/yonetim/aidatlar" },
    { ad: "Toplam tahsilat", deger: tl(tahsilEdilen), yol: "/yonetim/odemeler" },
  ];

  return (
    <>
      <UstBaslik baslik="Kulübün bugünü" altBaslik={profil?.ad_soyad ?? "Yönetim"} sag={<BildirimZili yol="/yonetim/bildirimler" />} genis>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {kutular.map((k) => (
            <Link
              key={k.ad}
              href={k.yol}
              className="rounded-2xl bg-white/[0.07] px-3 py-3 ring-1 ring-white/10 transition-colors duration-150 hover:bg-white/[0.11]"
            >
              <p className="truncate font-manset text-[26px] font-extrabold leading-none text-white">{k.deger}</p>
              <p className="mt-1.5 truncate text-[11px] text-white/60">{k.ad}</p>
            </Link>
          ))}
        </div>
      </UstBaslik>

      <div className="mx-auto w-full max-w-5xl px-4 pb-28 lg:pb-12">
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <h2 className="mb-2 px-1 bolum-basligi">Yapılacaklar</h2>
            {isler.length ? (
              <div className="kart divide-y divide-white/[0.06]">
                {isler.map((i) => (
                  <Link key={i.baslik} href={i.yol} className="flex min-h-16 items-center gap-3.5 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.03]">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        i.acil ? "bg-amber-100 text-amber-800" : "bg-yesil-500/12 text-yesil-500"
                      }`}
                    >
                      <Ikon ad={i.ikon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900">
                        <span className="font-manset text-lg font-extrabold">{i.sayi}</span> {i.baslik}
                      </p>
                      <p className="truncate text-xs text-neutral-500">{i.aciklama}</p>
                    </div>
                    <span aria-hidden className="text-neutral-400">›</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="kart flex items-center gap-3 px-4 py-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yesil-500/12 text-yesil-500">
                  <Ikon ad="kontrol" className="h-5 w-5" />
                </span>
                <p className="text-sm text-neutral-600">Bekleyen iş yok. Kulüp güncel.</p>
              </div>
            )}

            {riskli.length ? (
              <>
                <h2 className="mb-2 mt-6 px-1 bolum-basligi">Devamı düşen sporcular · son 45 gün</h2>
                <div className="kart divide-y divide-white/[0.06]">
                  {riskli.map(({ s, d, oran }) => (
                    <Link key={s.id} href={`/antrenor/sporcular/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-white/[0.03]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{s.ad} {s.soyad}</p>
                        <p className="text-xs text-neutral-500">
                          {s.yas_grubu ?? "Yaş grubu yok"} · {d!.geldi}/{d!.sayilan} antrenman
                        </p>
                      </div>
                      <span className="font-manset text-xl font-extrabold text-red-700">%{oran}</span>
                    </Link>
                  ))}
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-neutral-500">
                  Kayıt bırakmadan önce veliyle konuşmak için iyi bir an.
                </p>
              </>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div>
              <h2 className="mb-2 px-1 bolum-basligi">Bugün sahada</h2>
              <div className="kart divide-y divide-white/[0.06]">
                {bugunku.length || (macData ?? []).length ? (
                  <>
                    {bugunku.map((a) => (
                      <Link key={a.id} href={`/antrenor/antrenmanlar/${a.id}`} className="block px-4 py-3">
                        <p className="truncate text-sm font-semibold text-neutral-900">{a.baslik}</p>
                        <p className="text-xs text-neutral-500">
                          {a.baslangic ? a.baslangic.slice(0, 5) : "Saat yok"}
                          {a.yas_grubu ? ` · ${a.yas_grubu}` : ""}
                        </p>
                      </Link>
                    ))}
                    {(macData ?? []).map((m) => (
                      <Link key={m.id} href={`/yonetim/maclar/${m.id}`} className="block px-4 py-3">
                        <p className="truncate text-sm font-semibold text-neutral-900">Maç · {m.rakip}</p>
                        <p className="text-xs text-neutral-500">
                          {m.tarih === bugun ? "Bugün" : gunAdi(m.tarih)}
                          {m.saat ? ` · ${String(m.saat).slice(0, 5)}` : ""}
                          {m.yas_grubu ? ` · ${m.yas_grubu}` : ""}
                        </p>
                      </Link>
                    ))}
                  </>
                ) : (
                  <p className="px-4 py-4 text-sm text-neutral-500">Bugün için antrenman ya da yaklaşan maç yok.</p>
                )}
              </div>
            </div>

            {dogumGunleri.length ? (
              <div>
                <h2 className="mb-2 px-1 bolum-basligi">Doğum günleri · 7 gün</h2>
                <div className="kart divide-y divide-white/[0.06]">
                  {dogumGunleri.map(({ sporcu, kalan, yas }) => (
                    <div key={sporcu.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">{sporcu.ad} {sporcu.soyad}</p>
                        <p className="text-xs text-neutral-500">{yas} yaşına giriyor{sporcu.yas_grubu ? ` · ${sporcu.yas_grubu}` : ""}</p>
                      </div>
                      <span className={`rozet ${kalan === 0 ? "bg-yesil-500 text-anametin" : "bg-neutral-100 text-neutral-700"}`}>
                        {kalanGunMetni(kalan)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1">
              <Link href="/yonetim/sporcular/yeni" className="btn-birincil">
                <Ikon ad="artı" className="h-4 w-4" /> Sporcu ekle
              </Link>
              <Link href="/antrenor/duyurular" className="btn-ikincil">
                <Ikon ad="megafon" className="h-4 w-4" /> Duyuru yaz
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
