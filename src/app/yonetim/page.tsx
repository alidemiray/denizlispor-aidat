import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import CikisDugmesi from "@/components/CikisDugmesi";
import { yoneticiGerekli } from "@/lib/yetki";
import { bugununDonemi, donemAdi, tl } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function YonetimOzet() {
  const { supabase, profil } = await yoneticiGerekli();

  const [{ data: sporcular }, { data: aidatlar }, { data: odemeler }] =
    await Promise.all([
      supabase.from("spor_sporcular").select("id, durum, aylik_aidat"),
      supabase.from("spor_aidatlar").select("id, donem, tutar, durum"),
      supabase.from("spor_odemeler").select("id, tutar, durum"),
    ]);

  const aktif = (sporcular ?? []).filter((s) => s.durum === "aktif").length;
  const tahakkuk = (aidatlar ?? []).reduce((t, a) => t + Number(a.tutar), 0);
  const tahsil = (odemeler ?? [])
    .filter((o) => o.durum === "onaylandi")
    .reduce((t, o) => t + Number(o.tutar), 0);
  const bekleyenTutar = (aidatlar ?? [])
    .filter((a) => a.durum === "bekliyor")
    .reduce((t, a) => t + Number(a.tutar), 0);
  const onayBekleyen = (odemeler ?? []).filter((o) => o.durum === "beklemede").length;
  const buAy = (aidatlar ?? []).filter((a) => a.donem === bugununDonemi()).length;

  const kutular = [
    { ad: "Aktif sporcu", deger: String(aktif), yol: "/yonetim/sporcular" },
    { ad: "Tahsil edilen", deger: tl(tahsil), yol: "/yonetim/odemeler" },
    { ad: "Bekleyen alacak", deger: tl(bekleyenTutar), yol: "/yonetim/aidatlar" },
    { ad: "Toplam tahakkuk", deger: tl(tahakkuk), yol: "/yonetim/aidatlar" },
  ];

  return (
    <>
      <UstBaslik
        baslik="Kulüp yönetimi"
        altBaslik={profil?.ad_soyad ?? "Yönetici"}
        sag={<CikisDugmesi />}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28">
        {onayBekleyen > 0 ? (
          <Link href="/yonetim/odemeler" className="mt-3 block">
            <div className="kart flex items-center gap-3 border-l-4 border-amber-400 px-4 py-4">
              <span className="text-2xl">🧾</span>
              <div className="flex-1">
                <p className="font-semibold text-neutral-900">
                  {onayBekleyen} ödeme bildirimi onay bekliyor
                </p>
                <p className="text-xs text-neutral-500">
                  Dekontları inceleyip onaylayın.
                </p>
              </div>
              <span className="text-neutral-400">›</span>
            </div>
          </Link>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-3">
          {kutular.map((k) => (
            <Link key={k.ad} href={k.yol} className="kart px-4 py-4">
              <p className="text-xs font-medium text-neutral-500">{k.ad}</p>
              <p className="mt-1 text-xl font-extrabold tracking-tight text-neutral-900">
                {k.deger}
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/yonetim/sporcular/yeni" className="btn-birincil">
            + Sporcu ekle
          </Link>
          <Link href="/yonetim/aidatlar" className="btn-ikincil">
            {donemAdi(bugununDonemi())} tahakkuku {buAy > 0 ? `(${buAy} kayıt)` : "(yapılmadı)"}
          </Link>
        </div>

        <div className="kart mt-6 px-5 py-5">
          <h2 className="font-bold text-neutral-900">Nasıl çalışır?</h2>
          <ol className="mt-3 space-y-2.5 text-sm leading-relaxed text-neutral-600">
            <li>
              <b>1.</b> Sporcuyu ekleyin ve <b>velinin e-posta adresini</b> girin.
            </li>
            <li>
              <b>2.</b> Veli aynı e-posta ile uygulamadan hesap açtığında sporcu
              otomatik olarak hesabına bağlanır.
            </li>
            <li>
              <b>3.</b> Her ay <b>Aidatlar</b> sekmesinden dönem tahakkuku oluşturun.
            </li>
            <li>
              <b>4.</b> Veli ödemesini bildirir, siz <b>Ödemeler</b> sekmesinden
              onaylarsınız; aidat otomatik kapanır.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
