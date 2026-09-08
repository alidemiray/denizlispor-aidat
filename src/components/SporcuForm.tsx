import { sporcuKaydet, sporcuSil } from "@/app/yonetim/actions";
import { MEVKILER, type Sporcu } from "@/lib/types";
import KaydetDugmesi from "@/components/KaydetDugmesi";

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
            <select id="mevki" name="mevki" className="alan" defaultValue={sporcu?.mevki ?? ""}>
              <option value="">Belirtilmedi</option>
              {MEVKILER.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="etiket" htmlFor="forma_no">Forma no</label>
            <input id="forma_no" name="forma_no" type="number" min="1" max="99" className="alan"
              defaultValue={sporcu?.forma_no ?? ""} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="okul">Okulu</label>
            <input id="okul" name="okul" className="alan" defaultValue={sporcu?.okul ?? ""} />
          </div>
          <div>
            <label className="etiket" htmlFor="ayak">Kullandığı ayak</label>
            <select id="ayak" name="ayak" className="alan" defaultValue={sporcu?.ayak ?? ""}>
              <option value="">Belirtilmedi</option>
              <option value="Sağ">Sağ</option>
              <option value="Sol">Sol</option>
              <option value="Çift ayak">Çift ayak</option>
            </select>
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

        <div>
          <label className="etiket" htmlFor="sporcu_eposta">Sporcunun kendi e-postası</label>
          <input id="sporcu_eposta" name="sporcu_eposta" type="email" className="alan"
            placeholder="sporcu@ornek.com" defaultValue={sporcu?.sporcu_eposta ?? ""} />
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            İsteğe bağlı. Sporcu bu adresle hesap açtığında kendi kaydını görür; veli ile
            sporcu aynı kayıt üzerinde çalışır, birinin güncellemesi diğerine yansır.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="etiket" htmlFor="acil_kisi">Acil durumda aranacak</label>
            <input id="acil_kisi" name="acil_kisi" className="alan"
              defaultValue={sporcu?.acil_kisi ?? ""} />
          </div>
          <div>
            <label className="etiket" htmlFor="acil_telefon">Acil durum telefonu</label>
            <input id="acil_telefon" name="acil_telefon" type="tel" className="alan"
              defaultValue={sporcu?.acil_telefon ?? ""} />
          </div>
        </div>

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
              <option value="onay_bekliyor">Onay bekliyor</option>
            </select>
          </div>
        </div>

        <div>
          <label className="etiket" htmlFor="notlar">Notlar</label>
          <textarea id="notlar" name="notlar" className="alan min-h-20 resize-y"
            defaultValue={sporcu?.notlar ?? ""} />
        </div>

        <KaydetDugmesi>
          {sporcu ? "Değişiklikleri kaydet" : "Sporcuyu ekle"}
        </KaydetDugmesi>
      </form>

      {sporcu ? (
        <form action={sporcuSil} className="kart px-4 py-4">
          <input type="hidden" name="id" value={sporcu.id} />
          <p className="text-sm font-semibold text-neutral-800">Sporcuyu sil</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500">
            Sporcuyla birlikte tüm aidat ve ödeme kayıtları da silinir. Kaydı korumak
            için silmek yerine durumu <b>Pasif</b> yapabilirsiniz.
          </p>
          <KaydetDugmesi
            bekleyen="Siliniyor…"
            className="btn mt-3 w-full bg-red-50 text-red-700 ring-1 ring-red-600/20"
          >
            Kalıcı olarak sil
          </KaydetDugmesi>
        </form>
      ) : null}
    </div>
  );
}
