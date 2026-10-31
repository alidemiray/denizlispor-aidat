import type { Rol } from "@/lib/roller";

/**
 * Sürüm notları — her güncellemede EN ÜSTE yeni bir kayıt eklenir.
 *
 * - `surum` benzersiz olmalı (tarih + gerekirse harf: "2026.10.29", "2026.10.29b").
 * - `roller` verilirse not yalnızca o rollere gösterilir (ör. kasa notunu sporcu görmez).
 *   Verilmezse herkese gösterilir.
 * - Uygulama açılınca kişi, en son gördüğü sürümden sonraki notları bir pencerede görür.
 * - Metinler veli diliyle, kısa yazılır; teknik ayrıntı yazılmaz.
 */
export type SurumNotu = {
  surum: string;
  tarih: string;
  baslik: string;
  maddeler: string[];
  roller?: Rol[];
};

export const SURUM_NOTLARI: SurumNotu[] = [
  {
    surum: "2026.11.01",
    tarih: "1 Kasım 2026",
    baslik: "Yaş grupları ayrı yönetiliyor",
    roller: ["admin", "baskan", "yonetici"],
    maddeler: [
      "Her yaş grubunun sporcuları, aidatı, kasası ve ödeme bilgileri artık ayrı.",
      "Admin ve kulüp başkanı üstteki seçiciden gruplar arasında geçer; grup yöneticisi yalnızca kendi grubunu görür.",
      "Her grubun kendi ön kayıt bağlantısı ve QR'ı var. Sezon sonunda gruplar tek tuşla üst klasmana geçer.",
    ],
  },
  {
    surum: "2026.11.01v",
    tarih: "1 Kasım 2026",
    baslik: "Yaş grubu seçimi",
    roller: ["veli"],
    maddeler: [
      "Çocuğunuzu kaydederken yaş grubunu seçiyorsunuz; aidat, kasa ve duyurular o grubun.",
      "İki çocuğunuz farklı gruplardaysa üstteki seçiciden grup değiştirebilirsiniz.",
    ],
  },
  {
    surum: "2026.10.31a",
    tarih: "31 Ekim 2026",
    baslik: "Yeni yönetim araçları",
    roller: ["admin", "yonetici", "baskan"],
    maddeler: [
      "Ön kayıt: başvuru QR'ı ve afişi, deneme dersi planlama, kesin kayıt tek ekranda.",
      "Excel'den aktar: sporcu listenizi kopyala-yapıştırla tek seferde ekleyin.",
      "Zimmet: forma, eşofman, top kimde, iadesi geciken var mı; veliye hatırlatma kendiliğinden gider.",
    ],
  },
  {
    surum: "2026.10.31",
    tarih: "31 Ekim 2026",
    baslik: "Sezon kartını paylaşın",
    roller: ["veli", "sporcu"],
    maddeler: [
      "Sezon kartı artık tek dokunuşla görsel olarak paylaşılabiliyor (WhatsApp, Instagram).",
      "Çocuğunuzdaki kulüp eşyaları ve iade tarihleri sporcu sayfasında görünüyor.",
    ],
  },
  {
    surum: "2026.10.30a",
    tarih: "30 Ekim 2026",
    baslik: "Bildirimler ve esnek aidat",
    maddeler: [
      "Yeni bildirim kutusu: aidat hatırlatmaları, ödeme onayları ve antrenmana katılmama haberi tek yerde.",
      "Aidat artık her ayın başında kendiliğinden oluşuyor; kardeş indirimi, burs ve dondurma kendiliğinden uygulanıyor.",
      "Kısmi ödemelerde kalan tutar ayrıca gösteriliyor.",
    ],
  },
  {
    surum: "2026.10.29h",
    tarih: "29 Ekim 2026",
    baslik: "Bilgisayarda da rahat",
    maddeler: [
      "Geniş ekranda menü artık solda; tüm bölümler tek tıkla açılıyor.",
      "Yönetim için yeni özet: onay bekleyenler, gecikenler, yoklaması alınmayan antrenmanlar ve devamı düşen sporcular tek listede.",
      "Kaydetme bildirimleri telefonda alt menünün üstünde görünüyor.",
    ],
  },
  {
    surum: "2026.10.29g",
    tarih: "29 Ekim 2026",
    baslik: "Sezon arşivi: mühür, anılar, yükselenler",
    maddeler: [
      "Biten sezon kulüp yönetimince mühürlenir; o sezonun maç, kadro, antrenman ve yoklama kayıtları artık değişmez.",
      "Arşivde sezonun kapanış notu, fotoğraflı anılar ve çocuğunuzun sezon özeti (maç, dakika, gol, devam) yer alır.",
      "Yeni raf: kulüpten üst takımlara yükselen sporcular.",
    ],
  },
  {
    surum: "2026.10.29f",
    tarih: "29 Ekim 2026",
    baslik: "Geri tuşu artık uygulama gibi",
    maddeler: [
      "Alt menüde sekmeler arasında gezinmek geri geçmişini doldurmuyor.",
      "Üstteki ‹ düğmesi her zaman bir üst ekrana götürüyor; gezdiğiniz ekranları tek tek geri sarmıyor.",
      "Kaydettikten sonra geri tuşu aynı ekranı ikinci kez göstermiyor.",
    ],
  },
  {
    surum: "2026.10.29e",
    tarih: "29 Ekim 2026",
    baslik: "Kulüp ekibine yeni araçlar",
    roller: ["antrenor", "yardimci_antrenor", "baskan", "yonetici"],
    maddeler: [
      "Antrenör panelinden velilere ve sporculara duyuru yayınlayın; kaç kişinin okuduğunu görün.",
      "Yönetim › Daha › Dışa aktar: sporcu, aidat, ödeme, kasa ve yoklama listeleri Excel'de.",
    ],
  },
  {
    surum: "2026.10.29d",
    tarih: "29 Ekim 2026",
    baslik: "Duyurular, takvim ve sezon karnesi",
    maddeler: [
      "Kulüpten duyurular artık ana ekranda; yenileri işaretli geliyor.",
      "Antrenman sayfasından tek dokunuşla tüm antrenman ve maçları telefon takviminize ekleyin.",
      "Sporcu sayfasında yazdırılabilir sezon karnesi: devam, değerlendirme, ölçüm ve maçlar tek sayfada.",
      "Hesabım › Kişisel veriler: aydınlatma metni ve izinlerinizi buradan yönetebilirsiniz.",
    ],
  },
  {
    surum: "2026.10.29c",
    tarih: "29 Ekim 2026",
    baslik: "Altyapı Arşivi",
    maddeler: [
      "Alt menüde yeni Arşiv sekmesi: kulübün sezon sezon hafızası.",
      "Her sezonun maçları, antrenman sayısı ve vitrin maçı tek ekranda.",
      "Biten sezonlar mühürlenir, kayıtlar kalıcı olarak saklanır.",
    ],
  },
  {
    surum: "2026.10.29b",
    tarih: "29 Ekim 2026",
    baslik: "Sporcu Pasaportu ve Sezon Kartı",
    maddeler: [
      "Yeni koyu görünüm: kulübün siyahı üzerinde yeşil.",
      "Ana sayfada sıradaki antrenman en üstte: gün, saat, yer.",
      "Sporcu sayfası artık bir pasaport: ilk antrenmandan ilk gole kadar yolculuk tek bakışta.",
      "Sezon Kartı: antrenör değerlendirmesiyle oluşan, yazdırıp saklanabilecek bir kart.",
    ],
  },
  {
    surum: "2026.10.29",
    tarih: "29 Ekim 2026",
    baslik: "Yeni Denizlispor kimliği",
    maddeler: [
      "Uygulama artık kulübün resmî renkleriyle: yeşil, siyah ve beyaz.",
      "Yeni yazı stili: başlıklar stadyum tabelası gibi, metinler telefonda daha rahat okunuyor.",
      "Her güncellemeden sonra yenilikleri uygulamayı açtığınızda bu pencerede göreceksiniz.",
    ],
  },
];

export function rolNotlari(rol: string): SurumNotu[] {
  return SURUM_NOTLARI.filter((n) => !n.roller || n.roller.includes(rol as Rol));
}
