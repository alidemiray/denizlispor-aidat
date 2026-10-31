/**
 * Göçü (migration) henüz uygulanmamış bir tabloya erişildiğinde PostgREST
 * "tablo yok" der. Bu durumda özellik kapalı sayılır ve ekran sessizce gizlenir:
 * kod canlıya veritabanından önce çıkabilir, hiçbir ekran bozulmaz.
 */
export function tabloYok(hata: { code?: string; message?: string } | null | undefined) {
  if (!hata) return false;
  return (
    hata.code === "42P01" ||
    hata.code === "PGRST205" ||
    /does not exist|could not find the table/i.test(hata.message ?? "")
  );
}

/**
 * Göçle gelen bir veritabanı fonksiyonu henüz yoksa (PostgREST "function not found").
 * Kod, göç uygulanmadan önce de çalışsın diye eski yola düşülür.
 */
export function gocYok(hata: { code?: string; message?: string } | null | undefined) {
  if (!hata) return false;
  return (
    tabloYok(hata) ||
    hata.code === "PGRST202" ||
    hata.code === "42883" ||
    /could not find the function/i.test(hata.message ?? "")
  );
}
