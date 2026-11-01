import { NextResponse } from "next/server";
import { benimSporcularim } from "@/lib/veli";
import { createClient } from "@/lib/supabase/server";
import { ANTRENMAN_TURU } from "@/lib/antrenman";
import { macBasligi } from "@/lib/mac";
import { takvimOlustur, type TakvimOlayi } from "@/lib/takvim";
import { KULUP } from "@/kulup";
import type { Antrenman, Mac } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Önümüzdeki antrenman ve maçları .ics olarak verir; telefonda açılınca takvime eklenir.
 * Veli/sporcu yalnızca kendi sporcusunun yaş grubunu (yaş grubu girilmemişse tümünü) görür.
 * Erişim RLS'ye tabidir: kişi zaten göremediği kaydı buradan da alamaz.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claimData } = await supabase.auth.getClaims();
  const kullanici = claimData?.claims?.sub;
  if (!kullanici) return NextResponse.redirect(new URL("/giris", KULUP.yayin.adres));

  const bugun = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());

  const [{ data: sporcular }, { data: antrenmanData }, { data: macData }] = await Promise.all([
    benimSporcularim(supabase, kullanici, "yas_grubu"),
    supabase.from("spor_antrenmanlar").select("*").gte("tarih", bugun).order("tarih").limit(200),
    supabase.from("spor_maclar").select("*").gte("tarih", bugun).order("tarih").limit(100),
  ]);

  const gruplar = new Set((sporcular ?? []).map((s) => s.yas_grubu).filter(Boolean));
  const uygun = (g: string | null) => !g || gruplar.size === 0 || gruplar.has(g);

  const olaylar: TakvimOlayi[] = [
    ...((antrenmanData ?? []) as Antrenman[])
      .filter((a) => uygun(a.yas_grubu))
      .map((a) => ({
        uid: `antrenman-${a.id}@${KULUP.kod}`,
        tarih: a.tarih,
        saat: a.baslangic,
        sureDk: a.sure_dk,
        baslik: `${KULUP.kisaAd} · ${a.baslik || ANTRENMAN_TURU[a.tur] || "Antrenman"}`,
        aciklama: [a.yas_grubu, a.hedef ? `Hedef: ${a.hedef}` : null].filter(Boolean).join(" · "),
        yer: a.yer,
      })),
    ...((macData ?? []) as Mac[])
      .filter((m) => uygun(m.yas_grubu))
      .map((m) => ({
        uid: `mac-${m.id}@${KULUP.kod}`,
        tarih: m.tarih,
        saat: m.saat,
        sureDk: 120,
        baslik: `⚽ ${macBasligi(m)}`,
        aciklama: [m.yas_grubu, m.aciklama].filter(Boolean).join(" · "),
        yer: null,
      })),
  ];

  const ics = takvimOlustur(`${KULUP.kisaAd} Altyapı`, olaylar);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${KULUP.kod}-takvim.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
