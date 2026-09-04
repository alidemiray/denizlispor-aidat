# Denizlispor Sporcu Takip

Denizlispor altyapı sporcuları için **veli bilgilendirme ve aidat takip** uygulaması.
Telefona kurulabilen bir PWA'dır: açılışta kulüp arması karşılar, ardından veli girişi gelir.

## Neler var?

**Veli tarafı**
- E-posta + şifre ile giriş / hesap oluşturma / şifre sıfırlama
- Sporcu profili (yaş grubu, mevki, forma no, kayıt tarihi, aylık aidat)
- Aidat dönemleri: ödendi / bekliyor / gecikmiş / muaf
- Toplam borç ve ödeme geçmişi
- Havale-EFT dekontu yükleyerek ödeme bildirimi

**Kulüp yönetimi (`/yonetim`)**
- Özet tablo: aktif sporcu, tahsilat, bekleyen alacak
- Sporcu ekleme / düzenleme (veli e-postası ile otomatik eşleşme)
- Aylık dönem tahakkuku tek tıkla
- Ödeme bildirimlerini dekontla birlikte onaylama / reddetme
- IBAN ve kulüp iletişim bilgileri, kullanıcı yetkileri

## Teknoloji

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth, Postgres, Storage) — tüm erişim RLS politikalarıyla korunur
- Vercel üzerinde barındırma

## Veritabanı

Tüm nesneler `spor_` ön ekiyle `public` şemasında:
`spor_profiller`, `spor_sporcular`, `spor_aidatlar`, `spor_odemeler`, `spor_ayarlar`
ve `spor-dekontlar` storage kovası.

## Ortam değişkenleri

Varsayılan değerler koda gömülüdür; değiştirmek isterseniz:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Geliştirme

```bash
npm install
npm run dev
```
