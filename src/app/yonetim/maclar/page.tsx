import Link from "next/link";
import UstBaslik from "@/components/UstBaslik";
import { yoneticiGerekli } from "@/lib/yetki";
import { macKaydet } from "@/app/yonetim/actions";
import { gunAdi } from "@/lib/format";
import { MAC_TURU, macBasligi, skorMetni, sonucRozeti } from "@/lib/mac";
import type { Mac } from "@/lib/types";
import KaydetDugmesi from "@/components/KaydetDugmesi";

export const dynamic = "force-dynamic";

export default async function MaclarSayfasi() {
  const { supabase } = await yoneticiGerekli();

  const [{ data: macData }, { data: katilimData }] = await Promise.all([
    supabase.from("spor_maclar").select("*").order("tarih", { ascending: false }).limit(100),
    supabase.from("spor_mac_katilim").select("mac_id, dakika"),
  ]);

  const maclar = (macData ?? []) as Mac[];
  const kadroSayisi = new Map<string, number>();
  for (const k of katilimData ?? []) {
    if (Number(k.dakika) > 0) {
      kadroSayisi.set(k.mac_id, (kadroSayisi.get(k.mac_id) ?? 0) + 1);
    }
  }

  const bugun = new Date().toISOString().slice(0, 10);

  return (
    <>
      <UstBaslik baslik="Maçlar" altBaslik="Fikstür, sonuç ve oynanan süreler" geri="/yonetim" />

      <div className="mx-auto w-full max-w-5xl px-4 pb-28">
        <form action={macKaydet} className="kart mt-3 space-y-3 px-4 py-4">
          <p className="text-sm font-bold text-neutral-900">Yeni maç</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="etiket" htmlFor="tarih">Tarih *</label>
              <input id="tarih" name="tarih" type="date" className="alan" required
                defaultValue={bugun} />
            </div>
            <div>
              <label className="etiket" htmlFor="saat">Saat</label>
              <input id="saat" name="saat" type="time" className="alan" />
            </div>
            <div>
              <label className="etiket" htmlFor="rakip">Rakip *</label>
              <input id="rakip" name="rakip" className="alan" required placeholder="Takım adı" />
            </div>
            <div>
              <label className="etiket" htmlFor="yas_grubu">Yaş grubu</label>
              <input id="yas_grubu" name="yas_grubu" className="alan" placeholder="U14" />
            </div>
            <div>
              <label className="etiket" htmlFor="yer">Saha</label>
              <select id="yer" name="yer" className="alan">
                <option value="ic">İç saha</option>
                <option value="dis">Deplasman</option>
                <option value="notr">Nötr saha</option>
              </select>
            </div>
            <div>
              <label className="etiket" htmlFor="tur">Tür</label>
              <select id="tur" name="tur" className="alan">
                <option value="lig">Lig</option>
                <option value="kupa">Kupa</option>
                <option value="hazirlik">Hazırlık</option>
                <option value="turnuva">Turnuva</option>
              </select>
            </div>
          </div>
          <KaydetDugmesi className="btn-birincil w-full sm:w-auto sm:px-8" bekleyen="Ekleniyor…">
            Maçı ekle
          </KaydetDugmesi>
        </form>

        <div className="kart mt-4 divide-y divide-neutral-100">
          {maclar.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-neutral-500">
              Henüz maç kaydı yok. Yukarıdan ekleyebilirsiniz.
            </p>
          ) : (
            maclar.map((m) => {
              const skor = skorMetni(m);
              const sonuc = sonucRozeti(m);
              return (
                <Link key={m.id} href={`/yonetim/maclar/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-neutral-900">{macBasligi(m)}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {gunAdi(m.tarih)}
                      {m.saat ? ` · ${m.saat.slice(0, 5)}` : ""} · {MAC_TURU[m.tur] ?? m.tur}
                      {m.yas_grubu ? ` · ${m.yas_grubu}` : ""} ·{" "}
                      {kadroSayisi.get(m.id) ?? 0} oyuncu
                    </p>
                  </div>
                  {skor ? (
                    <span className="text-sm font-bold text-neutral-900">{skor}</span>
                  ) : (
                    <span className="text-xs text-neutral-400">skor girilmedi</span>
                  )}
                  {sonuc ? <span className={`rozet ${sonuc.stil}`}>{sonuc.ad}</span> : null}
                  <span className="text-neutral-400">›</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
