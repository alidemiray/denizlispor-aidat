import Link from "next/link";
import QRCode from "qrcode";
import UstBaslik from "@/components/UstBaslik";
import KaydetDugmesi from "@/components/KaydetDugmesi";
import Ikon from "@/components/ui/Ikon";
import { yoneticiGerekli } from "@/lib/yetki";
import { gunAdi } from "@/lib/format";
import { bugunTR } from "@/lib/sezon";
import { gruplarim, seciliGrup } from "@/lib/grup";
import { KULUP } from "@/kulup";
import { adayKapat, denemeDersiPlanla, sporcuDurumGuncelle } from "@/app/yonetim/actions";

export const dynamic = "force-dynamic";

type Aday = {
  id: string;
  ad: string;
  soyad: string;
  dogum_tarihi: string | null;
  okul: string | null;
  mevki: string | null;
  veli_ad_soyad: string | null;
  veli_telefon: string | null;
  veli_eposta: string | null;
  notlar: string | null;
  created_at: string;
  deneme_zamani?: string | null;
  deneme_yeri?: string | null;
  aday_notu?: string | null;
};

function yas(dogum: string | null) {
  if (!dogum) return null;
  const b = new Date(bugunTR() + "T00:00:00");
  const d = new Date(dogum + "T00:00:00");
  let y = b.getFullYear() - d.getFullYear();
  if (b < new Date(b.getFullYear(), d.getMonth(), d.getDate())) y -= 1;
  return y;
}

function denemeMetni(z: string) {
  const d = new Date(z);
  return d.toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
}

export default async function OnKayit() {
  const { supabase } = await yoneticiGerekli();
  // Birden çok grup varsa her grubun kendi başvuru bağlantısı / QR'ı olur
  const gruplar = await gruplarim(supabase);
  const grup = gruplar.length > 1 ? seciliGrup(gruplar) : null;
  const baglanti = `${KULUP.yayin.adres.replace(/\/$/, "")}/basvuru${grup ? `?grup=${grup.kod}` : ""}`;
  const qr = await QRCode.toString(baglanti, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#FFFFFF" } });

  // Göç (20261102) yoksa deneme alanları olmadan oku
  const ilk = await supabase
    .from("spor_sporcular")
    .select("id, ad, soyad, dogum_tarihi, okul, mevki, veli_ad_soyad, veli_telefon, veli_eposta, notlar, created_at, deneme_zamani, deneme_yeri, aday_notu")
    .eq("durum", "onay_bekliyor")
    .order("created_at");
  const gocVar = !ilk.error;
  let data: unknown[] | null = ilk.data;
  if (ilk.error) {
    ({ data } = await supabase
      .from("spor_sporcular")
      .select("id, ad, soyad, dogum_tarihi, okul, mevki, veli_ad_soyad, veli_telefon, veli_eposta, notlar, created_at")
      .eq("durum", "onay_bekliyor")
      .order("created_at"));
  }
  const adaylar = (data ?? []) as Aday[];
  const yeni = adaylar.filter((a) => !a.deneme_zamani);
  const denemede = adaylar.filter((a) => a.deneme_zamani).sort((a, b) => a.deneme_zamani!.localeCompare(b.deneme_zamani!));

  const Kart = ({ a }: { a: Aday }) => (
    <li className="kart px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/yonetim/sporcular/${a.id}`} className="font-semibold text-neutral-900 hover:underline">
            {a.ad} {a.soyad}
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            {[yas(a.dogum_tarihi) !== null ? `${yas(a.dogum_tarihi)} yaş` : null, a.okul, a.mevki].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="text-xs text-neutral-500">
            {a.veli_ad_soyad || "Veli"}
            {a.veli_telefon ? (
              <>
                {" · "}
                <a href={`tel:${a.veli_telefon.replace(/\s/g, "")}`} className="font-semibold text-yesil-700">
                  {a.veli_telefon}
                </a>
              </>
            ) : null}
          </p>
          {a.notlar ? <p className="mt-1.5 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600">{a.notlar}</p> : null}
          {a.aday_notu ? <p className="mt-1 text-[11px] text-neutral-500">Not: {a.aday_notu}</p> : null}
        </div>
        <span className="shrink-0 text-[11px] text-neutral-500">{gunAdi(a.created_at)}</span>
      </div>

      {a.deneme_zamani ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-yesil-500/12 px-3 py-2 text-xs font-semibold text-yesil-500">
          <Ikon ad="takvim" className="h-4 w-4" />
          Deneme dersi: {denemeMetni(a.deneme_zamani)}
          {a.deneme_yeri ? ` · ${a.deneme_yeri}` : ""}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        {gocVar ? (
          <details className="rounded-xl bg-neutral-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-800">
              {a.deneme_zamani ? "Deneme dersini değiştir" : "Deneme dersi planla"}
            </summary>
            <form action={denemeDersiPlanla} className="mt-2 grid gap-2 pb-1 sm:grid-cols-2">
              <input type="hidden" name="id" value={a.id} />
              <div>
                <label className="etiket text-xs" htmlFor={`t-${a.id}`}>Tarih</label>
                <input id={`t-${a.id}`} name="tarih" type="date" className="alan py-2" min={bugunTR()} required
                  defaultValue={a.deneme_zamani ? new Date(a.deneme_zamani).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) : ""} />
              </div>
              <div>
                <label className="etiket text-xs" htmlFor={`s-${a.id}`}>Saat</label>
                <input id={`s-${a.id}`} name="saat" type="time" className="alan py-2" defaultValue="17:00" />
              </div>
              <div className="sm:col-span-2">
                <label className="etiket text-xs" htmlFor={`y-${a.id}`}>Yer</label>
                <input id={`y-${a.id}`} name="yer" className="alan py-2" placeholder="Saha / tesis" defaultValue={a.deneme_yeri ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <KaydetDugmesi bekleyen="Planlanıyor…" className="btn-ikincil w-full">Planla ve veliye bildir</KaydetDugmesi>
              </div>
            </form>
          </details>
        ) : null}

        <form action={sporcuDurumGuncelle} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="durum" value="aktif" />
          <input type="hidden" name="donus" value="/yonetim/on-kayit" />
          <div className="w-24">
            <label className="etiket text-xs" htmlFor={`g-${a.id}`}>Yaş grubu</label>
            <input id={`g-${a.id}`} name="yas_grubu" className="alan py-2" placeholder="U12" />
          </div>
          <div className="w-28">
            <label className="etiket text-xs" htmlFor={`a-${a.id}`}>Aylık aidat (₺)</label>
            <input id={`a-${a.id}`} name="aylik_aidat" inputMode="decimal" className="alan py-2" placeholder="0" />
          </div>
          <KaydetDugmesi bekleyen="Kaydediliyor…" className="btn-birincil flex-1 py-2.5">
            Kesin kayıt
          </KaydetDugmesi>
        </form>

        {gocVar ? (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-neutral-500">Başvuruyu kapat</summary>
            <form action={adayKapat} className="mt-2 flex gap-2">
              <input type="hidden" name="id" value={a.id} />
              <input name="neden" className="alan flex-1 py-2" placeholder="Neden (ör. başka kulübü seçti)" maxLength={200} />
              <KaydetDugmesi bekleyen="…" className="btn bg-red-50 py-2 text-red-700 ring-1 ring-red-600/20">Kapat</KaydetDugmesi>
            </form>
          </details>
        ) : null}
      </div>
    </li>
  );

  return (
    <>
      <UstBaslik genis baslik="Ön kayıt" altBaslik={`${adaylar.length} başvuru bekliyor`} geri="/yonetim/daha" />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28 lg:pb-12">
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <div>
              <h2 className="mb-2 px-1 bolum-basligi">Yeni başvurular · {yeni.length}</h2>
              {yeni.length ? (
                <ul className="space-y-2.5">{yeni.map((a) => <Kart key={a.id} a={a} />)}</ul>
              ) : (
                <p className="kart px-4 py-5 text-sm text-neutral-500">Yeni başvuru yok. Afişi paylaşın, başvurular buraya düşer.</p>
              )}
            </div>
            {denemede.length ? (
              <div>
                <h2 className="mb-2 px-1 bolum-basligi">Deneme dersi planlananlar · {denemede.length}</h2>
                <ul className="space-y-2.5">{denemede.map((a) => <Kart key={a.id} a={a} />)}</ul>
              </div>
            ) : null}
          </section>

          <aside className="space-y-3">
            <div className="kart px-4 py-4">
              <p className="text-sm font-bold text-neutral-900">{grup ? `${grup.ad} başvuru bağlantısı` : "Başvuru bağlantısı"}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                Veliler bu bağlantı ya da QR ile hesap açıp çocuklarını kaydeder; başvuru buraya düşer
                ve size bildirim gelir.
              </p>
              <div
                className="mx-auto mt-3 w-44 overflow-hidden rounded-xl bg-[#FFFFFF] p-2"
                aria-label="Başvuru QR kodu"
                role="img"
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <p className="mt-3 break-all rounded-lg bg-neutral-50 px-2.5 py-2 text-center font-mono text-[11px] text-neutral-700">
                {baglanti}
              </p>
              <Link href="/yonetim/on-kayit/afis" className="btn-birincil mt-3 w-full">
                <Ikon ad="belge" className="h-4 w-4" /> Afişi yazdır
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
