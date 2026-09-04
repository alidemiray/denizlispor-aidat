import { sporcuKaydet, sporcuSil } from "@/app/yonetim/actions";
import type { Sporcu } from "@/lib/types";

export default function SporcuForm({ sporcu }: { sporcu?: Sporcu }) {
  return (
    <div className="space-y-4">
      <form action={sporcuKaydet} className="kart space-y-4 px-4 py-5">
        {sporcu ? <input type="hidden" name="id" value={sporcu.id} /> : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="ad">Ad *</label>
            <input id="ad" name="ad" className="alan" required defaultValue={sporcu?.ad} />
          </div>
          <div>
            <label className="etiket" htmlFor="soyad">Soyad *</label>
            <input id="soyad" name="soyad" className="alan" required defaultValue={sporcu?.soyad} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="dogum_tarihi">Doğum tarihi</label>
            <input id="dogum_tarihi" name="dogum_tarihi" type="date" className="alan"
              defaultValue={sporcu?.dogum_tarihi ?? ""} />
          </div>
          <div>
            <label className="etiket" htmlFor="yas_grubu">Yaş grubu</label>
            <input id="yas_grubu" name="yas_grubu" className="alan" placeholder="U14"
              defaultValue={sporcu?.yas_grubu ?? ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="mevki">Mevki</label>
            <input id="mevki" name="mevki" className="alan" placeholder="Orta saha"
              defaultValue={sporcu?.mevki ?? ""} />
          </div>
          <div>
            <label className="etiket" htmlFor="forma_no">Forma no</label>
            <input id="forma_no" name="forma_no" type="number" min="1" max="99" className="alan"
              defaultValue={sporcu?.forma_no ?? ""} />
          </div>
        </div>

        <hr className="border-neutral-100" />

        <div>
          <label className="etiket" htmlFor="veli_ad_soyad">Veli adı soyadı</label>
          <input id="veli_ad_soyad" name="veli_ad_soyad" className="alan"
            defaultValue={sporcu?.veli_ad_soyad ?? ""} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="veli_telefon">Veli telefonu</label>
            <input id="veli_telefon" name="veli_telefon" type="tel" className="alan"
              placeholder="05xx xxx xx xx" defaultValue={sporcu?.veli_telefon ?? ""} />
          </div>
          <div>
            <label className="etiket" htmlFor="veli_eposta">Veli e-postası *</label>
            <input id="veli_eposta" name="veli_eposta" type="email" className="alan"
              placeholder="veli@ornek.com" defaultValue={sporcu?.veli_eposta ?? ""} />
          </div>
        </div>
        <p className="-mt-1 text-xs leading-relaxed text-neutral-500">
          Veli bu e-posta ile uygulamaya kaydolduğunda sporcu otomatik olarak hesabına
          bağlanır.
        </p>

        <hr className="border-neutral-100" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="aylik_aidat">Aylık aidat (₺)</label>
            <input id="aylik_aidat" name="aylik_aidat" className="alan" inputMode="decimal"
              defaultValue={sporcu?.aylik_aidat ?? 0} />
          </div>
          <div>
            <label className="etiket" htmlFor="durum">Durum</label>
            <select id="durum" name="durum" className="alan" defaultValue={sporcu?.durum ?? "aktif"}>
              <option value="aktif">Aktif</option>
              <option value="pasif">Pasif</option>
            </select>
          </div>
        </div>

        <div>
          <label className="etiket" htmlFor="notlar">Notlar</label>
          <textarea id="notlar" name="notlar" className="alan min-h-20 resize-y"
            defaultValue={sporcu?.notlar ?? ""} />
        </div>

        <button className="btn-birincil w-full">
          {sporcu ? "Değişiklikleri kaydet" : "Sporcuyu ekle"}
        </button>
      </form>

      {sporcu ? (
        <form action={sporcuSil} className="kart px-4 py-4">
          <input type="hidden" name="id" value={sporcu.id} />
          <p className="text-sm font-semibold text-neutral-800">Sporcuyu sil</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Sporcuyla birlikte tüm aidat ve ödeme kayıtları da silinir. Kaydı korumak
            için silmek yerine durumu <b>Pasif</b> yapabilirsiniz.
          </p>
          <button className="btn mt-3 w-full bg-red-50 text-red-700 ring-1 ring-red-600/20">
            Kalıcı olarak sil
          </button>
        </form>
      ) : null}
    </div>
  );
}
