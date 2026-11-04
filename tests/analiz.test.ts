import { describe, expect, it } from "vitest";
import { BRANSLAR, bransCoz, oynanabilirSure, yasGrubuYasi } from "@/lib/brans";
import { dakikaPayi, donemKiyasi, haftalikUyarilar, kisiselRekorlar, sonDevam } from "@/lib/analiz";

const futbol = BRANSLAR.futbol;

describe("branş", () => {
  it("yaş grubundan yaşı okur", () => {
    expect(yasGrubuYasi("U12")).toBe(12);
    expect(yasGrubuYasi("U-14")).toBe(14);
    expect(yasGrubuYasi("10 Yaş Altı")).toBe(10);
    expect(yasGrubuYasi("2014 doğumlular", 2026)).toBe(12);
    expect(yasGrubuYasi("A takım")).toBeNull();
  });

  it("yaşa göre maç süresi", () => {
    expect(oynanabilirSure(futbol, "U10")).toBe(50);
    expect(oynanabilirSure(futbol, "U13")).toBe(70);
    expect(oynanabilirSure(futbol, "U19")).toBe(90);
    expect(oynanabilirSure(futbol, null)).toBe(90);
    expect(oynanabilirSure(BRANSLAR.basketbol, "U12")).toBe(32);
    expect(oynanabilirSure(BRANSLAR.voleybol, "U12")).toBe(0);
  });

  it("kulüp ayarı hazır branşı ezer, bilinmeyen futbola düşer", () => {
    expect(bransCoz({ kod: "futbol", macSuresi: 70 }).macSuresi).toBe(70);
    expect(bransCoz("kriket").kod).toBe("futbol");
    expect(bransCoz(undefined).kod).toBe("futbol");
  });
});

describe("dakika payı", () => {
  const m = (tarih: string, dakika: number, ilk = false) => ({ tarih, yas_grubu: "U12", dakika, ilk_kadro: ilk });

  it("oynanabilir süreye göre yüzde", () => {
    const p = dakikaPayi([m("2026-10-01", 60, true), m("2026-10-08", 30), m("2026-10-15", 0)], futbol);
    expect(p.kadroda).toBe(3);
    expect(p.oynadigi).toBe(2);
    expect(p.ilkKadro).toBe(1);
    expect(p.oynanabilir).toBe(180);
    expect(p.yuzde).toBe(50);
    expect(p.sonMaclar.map((x) => x.yuzde)).toEqual([100, 50, 0]);
  });

  it("uzatmada süre aşılırsa yüzde 100'ü geçmez", () => {
    expect(dakikaPayi([m("2026-10-01", 70)], futbol).yuzde).toBe(100);
  });

  it("gidiş: son üç maç önceki üçe göre", () => {
    const artan = dakikaPayi(
      [m("2026-09-01", 10), m("2026-09-08", 10), m("2026-09-15", 10), m("2026-09-22", 50), m("2026-09-29", 50), m("2026-10-06", 50)],
      futbol,
    );
    expect(artan.gidis).toBe("artiyor");
    expect(dakikaPayi([m("2026-09-01", 10)], futbol).gidis).toBeNull();
  });

  it("süresiz branşta yüzde yok", () => {
    const p = dakikaPayi([m("2026-10-01", 0, true)], BRANSLAR.voleybol);
    expect(p.yuzde).toBeNull();
    expect(p.ilkKadro).toBe(1);
  });
});

describe("devam ve kıyas", () => {
  it("son 4 hafta devamı", () => {
    const y = [
      { tarih: "2026-10-01", durum: "gelmedi" },
      { tarih: "2026-10-20", durum: "geldi" },
      { tarih: "2026-10-27", durum: "gec" },
      { tarih: "2026-11-01", durum: "gelmedi" },
    ];
    expect(sonDevam(y, "2026-11-03")).toEqual({ yuzde: 67, katilan: 2, toplam: 3 });
    expect(sonDevam([], "2026-11-03")).toBeNull();
  });

  it("dönem kıyası farkı hesaplar", () => {
    const k = donemKiyasi(
      [
        { donem: "2026-09-01", teknik: 6, fizik: null },
        { donem: "2026-06-01", teknik: 5, fizik: 7 },
      ],
      [{ anahtar: "teknik", ad: "Teknik" }, { anahtar: "fizik", ad: "Fizik" }],
    );
    expect(k?.alanlar[0].fark).toBe(1);
    expect(k?.alanlar[1].fark).toBeNull();
    expect(k?.once?.donem).toBe("2026-06-01");
  });

  it("kişisel rekorlar: sprintte küçük iyi", () => {
    const r = kisiselRekorlar(
      [
        { tarih: "2026-09-01", sprint_20m: 3.6 },
        { tarih: "2026-10-01", sprint_20m: 3.42 },
      ],
      [{ tarih: "2026-10-10", yas_grubu: "U12", dakika: 55, ilk_kadro: true }],
    );
    expect(r[0]).toEqual({ ad: "20 m sprint", deger: "3.42 sn", tarih: "2026-10-01" });
    expect(r.find((x) => x.ad === "En uzun maç")?.deger).toBe("55′");
  });
});

describe("antrenör haftalık uyarıları", () => {
  const sporcular = [
    { id: "a", ad: "Ali", soyad: "A", yas_grubu: "U12" },
    { id: "b", ad: "Can", soyad: "B", yas_grubu: "U12" },
  ];
  const maclar = [
    { id: "m1", tarih: "2026-10-04", yas_grubu: "U12" },
    { id: "m2", tarih: "2026-10-11", yas_grubu: "U12" },
    { id: "m3", tarih: "2026-10-18", yas_grubu: "U12" },
  ];

  it("kadroya alınmadığı maçı 0 sayar, eşik altını gösterir", () => {
    const u = haftalikUyarilar(
      {
        sporcular,
        maclar,
        katilimlar: [
          { mac_id: "m1", sporcu_id: "a", dakika: 60 },
          { mac_id: "m2", sporcu_id: "a", dakika: 60 },
          { mac_id: "m3", sporcu_id: "a", dakika: 60 },
          { mac_id: "m1", sporcu_id: "b", dakika: 10 },
        ],
        yoklamalar: [],
        sonDegerlendirme: { a: "2026-10-01" },
        bugun: "2026-11-03",
      },
      futbol,
    );
    expect(u.azOynayanlar.map((s) => [s.id, s.yuzde])).toEqual([["b", 6]]);
    expect(u.degerlendirmesiEksik.map((s) => s.id)).toEqual(["b"]);
  });

  it("üst üste 3 gelmedi; izinli zinciri bozmaz", () => {
    const y = (tarih: string, durum: string) => ({ sporcu_id: "a", tarih, durum, sure_dk: 90 });
    const u = haftalikUyarilar(
      {
        sporcular,
        maclar: [],
        katilimlar: [],
        yoklamalar: [y("2026-10-20", "geldi"), y("2026-10-22", "gelmedi"), y("2026-10-27", "izinli"), y("2026-10-29", "gelmedi"), y("2026-11-02", "gelmedi")],
        sonDegerlendirme: {},
        bugun: "2026-11-03",
      },
      futbol,
    );
    expect(u.devamsizlar).toEqual([{ ...sporcular[0], arka: 3 }]);
  });

  it("bu haftaki yük 4 haftalık ortalamanın 1,5 katını geçerse işaretler", () => {
    const y = (tarih: string, sure: number) => ({ sporcu_id: "a", tarih, durum: "geldi", sure_dk: sure });
    const u = haftalikUyarilar(
      {
        sporcular,
        maclar: [],
        katilimlar: [],
        yoklamalar: [
          y("2026-10-06", 90), y("2026-10-13", 90), y("2026-10-20", 90), y("2026-10-27", 90),
          y("2026-11-02", 90), y("2026-11-03", 90), y("2026-11-04", 90),
        ],
        sonDegerlendirme: {},
        bugun: "2026-11-04",
      },
      futbol,
    );
    expect(u.yukuArtanlar).toEqual([{ ...sporcular[0], buHafta: 270, ortalama: 90 }]);
  });
});
