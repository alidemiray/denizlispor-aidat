# Yeni kulüp kurulumu

Süre: bir oturum. Kod değişmez; yalnızca bir yapılandırma dosyası ve arma eklenir.

## 1. Yapılandırma

1. Uygulamada `/urun` sayfasındaki sihirbazla kulübün adını ve renklerini girin; kontrast
   uyarısı yoksa çıkan JSON'u kopyalayın.
2. `src/kulup/kulupler/<kod>.json` olarak kaydedin.
3. Armayı `public/kulupler/<kod>/arma.svg` (ya da `.png`, şeffaf zemin, en az 512 px) olarak ekleyin.
4. `src/kulup/index.ts` içindeki `KULUPLER` sözlüğüne bir satır ekleyin.
5. Yerelde bakın: `NEXT_PUBLIC_KULUP=<kod> npm run dev`.

## 2. Veritabanı (kulüp yöneticisi hesabıyla, kulübe ait hesapta)

1. Supabase'te yeni proje; bölge kulübe yakın (Türkiye için Frankfurt ya da İrlanda).
2. SQL Editor'da `supabase/migrations/` içindeki dosyaları ad sırasıyla çalıştırın: önce
   `00000000_taban.sql` (boş projeye tek seferde), sonra tarihli göçler. Bu sıra `npm test`
   içinde her gönderimde boş bir veritabanında sınanır. İlk kayıt olan hesap otomatik **admin** olur.
3. Authentication › URL Configuration: Site URL = kulübün adresi; Redirect URLs = `https://<adres>/**`.
4. Şifre kuralı ≥ 8 karakter, harf + rakam. E-posta onayı için özel SMTP tanımlayın.
5. Proje kodunu ve **publishable** anahtarı JSON'daki `supabase` alanına yazın.
   `service_role` anahtarı hiçbir dosyaya ve istemci ortam değişkenine yazılmaz.

## 3. Yayın

1. Vercel'de bu depodan yeni proje.
2. Ortam değişkeni: `NEXT_PUBLIC_KULUP=<kod>`.
3. `vercel.json › regions` kulübün Supabase bölgesiyle aynı olmalı (İrlanda `dub1`, Frankfurt `fra1`).
   Farklı bölgedeki kulüpler için bölge Vercel proje ayarından verilir.
4. Alan adı bağlanır.

## 4. İlk hesaplar

1. Kulübün admini uygulamadan ilk hesabı açar (otomatik admin olur).
2. Kulüp yaş gruplarını ayırmak istiyorsa: Yönetim › Gruplar'dan grupları açar (U11, U12…).
   Tek grupta kalırsa tüm yaş grupları tek sistemde toplanır.
3. Her grup için grubu seçip Yönetim › Ayarlar: IBAN, hesap sahibi, iletişim, aidat kuralları.
4. Pozisyonlar (kulüp başkanı, grup yöneticisi, antrenör) Ayarlar › Kullanıcılar'dan; grup
   pozisyonu seçili grupta geçerli olur.

## 5. Kontrol listesi

- [ ] `/api/saglik` → `"durum":"ok"`
- [ ] Giriş, veli kaydı, şifre sıfırlama e-postası
- [ ] KVKK onay ekranı ilk girişte çıkıyor
- [ ] Sporcu aktif yapılınca o ayın aidatı oluşuyor
- [ ] Ödeme bildirimi → onay → kasa havuzuna yansıyor
- [ ] Antrenman + yoklama → veli ekranında devam oranı
- [ ] Pasaport, sezon kartı ve karne yazdırılıyor
- [ ] Ana ekrana ekle: kulübün arması simge oluyor
