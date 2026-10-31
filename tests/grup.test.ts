import { describe, expect, it } from "vitest";
import { grupKodu, kodGecerli, ustKlasman } from "@/lib/grup";

describe("grup yardımcıları", () => {
  it("üst klasman: U15 → U16, adın geri kalanı korunur", () => {
    expect(ustKlasman("U15")).toBe("U16");
    expect(ustKlasman("U9 Kızlar")).toBe("U10 Kızlar");
    expect(ustKlasman("Minikler")).toBe("Minikler");
  });

  it("bağlantı kodu Türkçe harflerden temizlenir ve kurala uyar", () => {
    expect(grupKodu("U13 Kızlar")).toBe("u13-kizlar");
    expect(grupKodu("Çağrı Şöleni")).toBe("cagri-soleni");
    expect(kodGecerli(grupKodu("U13 Kızlar"))).toBe(true);
    expect(kodGecerli("-u13")).toBe(false);
    expect(kodGecerli("U13")).toBe(false);
  });
});
