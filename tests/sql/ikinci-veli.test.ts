import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { hataMesaji, kullaniciAc, oturumla, veritabaniKur } from "./kurulum";

// Senaryo: anne ve baba ayrı hesap açıp aynı çocuğu (Aras Dere) kaydetti.
let db: PGlite;
let yonetici: string;
let anne: string;
let baba: string;
let baskaVeli: string;
let antrenman: string;
let kayitAnne: string;
let kayitBaba: string;

const kayitAc = (veli: string, dogum = "2012-05-01") =>
  oturumla<{ id: string }>(db, veli,
    `select spor_sporcu_on_kayit('Aras', 'Dere', $1, null, null, null, null, null, null, null, null, null) as id`, [dogum]);

beforeAll(async () => {
  db = await veritabaniKur();
  yonetici = await kullaniciAc(db, "yonetim@kulup.test", "yonetici");
  anne = await kullaniciAc(db, "anne@kulup.test", "veli");
  baba = await kullaniciAc(db, "baba@kulup.test", "veli");
  baskaVeli = await kullaniciAc(db, "baska@kulup.test", "veli");
  antrenman = (await db.query<{ id: string }>(
    `insert into spor_antrenmanlar (tarih, baslik) values ('2026-10-20', 'Pas çalışması') returning id`)).rows[0].id;
});

describe("çift kayıt uyarısı", () => {
  it("baba kaydederken anne kaydı varsa uyarı alır; başka aileye bilgi sızmaz", async () => {
    kayitAnne = (await kayitAc(anne))[0].id;
    const var1 = await oturumla<{ v: boolean }>(db, baba,
      `select spor_benzer_kayit_var_mi('aras', 'DERE', '2012-05-01') as v`);
    expect(var1[0].v).toBe(true);
    // Annenin kendi kaydı kendisi için "benzer" sayılmaz
    expect((await oturumla<{ v: boolean }>(db, anne, `select spor_benzer_kayit_var_mi('Aras', 'Dere') as v`))[0].v).toBe(false);
    // Farklı doğum tarihi → başka çocuk
    expect((await oturumla<{ v: boolean }>(db, baba,
      `select spor_benzer_kayit_var_mi('Aras', 'Dere', '2014-01-01') as v`))[0].v).toBe(false);
    expect(await oturumla(db, baba, `select id from spor_sporcular`)).toHaveLength(0);
  });

  it("bağlanma isteği yönetime gider, e-posta kayda hazır yazılır", async () => {
    await oturumla(db, baba, `select spor_ikinci_veli_istegi('Aras', 'Dere', '2012-05-01', null, 'Babasıyım')`);
    const b = await db.query<{ yol: string }>(
      `select yol from spor_bildirimler where kullanici_id = $1 and tur = 'veli_baglama'`, [yonetici]);
    expect(b.rows).toEqual([{ yol: `/yonetim/sporcular/${kayitAnne}` }]);
    const s = await db.query<{ ikinci_veli_eposta: string; ikinci_veli_id: string | null }>(
      `select ikinci_veli_eposta, ikinci_veli_id from spor_sporcular where id = $1`, [kayitAnne]);
    expect(s.rows[0]).toEqual({ ikinci_veli_eposta: "baba@kulup.test", ikinci_veli_id: null });
  });

  it("yönetim ikinci veliyi onaylar; baba çocuğu, aidatı ve kasayı görür", async () => {
    expect(await hataMesaji(oturumla(db, baba, `select spor_ikinci_veli_ata($1, 'baba@kulup.test')`, [kayitAnne])))
      .toMatch(/yönetimi/);
    await oturumla(db, yonetici, `select spor_ikinci_veli_ata($1, 'baba@kulup.test', 'Baba Dere')`, [kayitAnne]);
    await db.query(`update spor_sporcular set durum = 'aktif', aylik_aidat = 1000 where id = $1`, [kayitAnne]);
    expect(await oturumla(db, baba, `select id from spor_sporcular`)).toEqual([{ id: kayitAnne }]);
    expect(await oturumla(db, baba, `select 1 from spor_aidatlar`)).toHaveLength(1);
    expect((await oturumla<{ k: boolean }>(db, baba, `select spor_kasa_gorebilir_mi() as k`))[0].k).toBe(true);
    expect(await oturumla(db, baskaVeli, `select id from spor_sporcular`)).toHaveLength(0);
  });

  it("bildirimler iki veliye de gider (kayıt onayı, gelmedi)", async () => {
    const say = async (k: string, tur: string) =>
      (await db.query(`select 1 from spor_bildirimler where kullanici_id = $1 and tur = $2`, [k, tur])).rows.length;
    expect(await say(anne, "kayit_onaylandi")).toBe(1);
    expect(await say(baba, "kayit_onaylandi")).toBe(1);
    await db.query(`update spor_antrenmanlar set tarih = (now() at time zone 'Europe/Istanbul')::date where id = $1`, [antrenman]);
    await db.query(`insert into spor_yoklama (antrenman_id, sporcu_id, durum) values ($1, $2, 'gelmedi')`, [antrenman, kayitAnne]);
    expect(await say(anne, "yoklama_gelmedi")).toBe(1);
    expect(await say(baba, "yoklama_gelmedi")).toBe(1);
  });

  it("baba ödeme bildirebilir", async () => {
    const aidat = (await db.query<{ id: string }>(`select id from spor_aidatlar where sporcu_id = $1`, [kayitAnne])).rows[0].id;
    await oturumla(db, baba,
      `insert into spor_odemeler (aidat_id, sporcu_id, tutar, durum, bildiren_id) values ($1, $2, 500, 'beklemede', $3)`,
      [aidat, kayitAnne, baba]);
    expect(await oturumla(db, anne, `select 1 from spor_odemeler`)).toHaveLength(1);
  });
});

describe("çift kayıt birleştirme", () => {
  it("baba uyarıya rağmen ikinci kayıt açtıysa yönetim birleştirir", async () => {
    const yeniBaba = await kullaniciAc(db, "baba2@kulup.test", "veli");
    const yeniAnne = await kullaniciAc(db, "anne2@kulup.test", "veli");
    const ana = (await oturumla<{ id: string }>(db, yeniAnne,
      `select spor_sporcu_on_kayit('Deniz', 'Kara', null, null, 'Okul A', null, null, null, null, null, null, null) as id`))[0].id;
    const kopya = (await oturumla<{ id: string }>(db, yeniBaba,
      `select spor_sporcu_on_kayit('deniz', 'KARA', '2013-03-03', 'Kaleci', null, null, 'Baba Kara', '0555', null, null, null, null) as id`))[0].id;
    await db.query(`update spor_sporcular set durum = 'aktif', aylik_aidat = 900 where id in ($1, $2)`, [ana, kopya]);
    // Kopyaya ait bir ödeme ve ölçüm
    const kAidat = (await db.query<{ id: string }>(`select id from spor_aidatlar where sporcu_id = $1`, [kopya])).rows[0].id;
    await db.query(`insert into spor_odemeler (aidat_id, sporcu_id, tutar, durum) values ($1, $2, 900, 'onaylandi')`, [kAidat, kopya]);
    await db.query(`insert into spor_olcumler (sporcu_id, tarih, boy_cm) values ($1, '2026-10-01', 150)`, [kopya]);

    const ciftler = await oturumla<{ ana_id: string; kopya_id: string }>(db, yonetici, `select ana_id, kopya_id from spor_olasi_ciftler()`);
    expect(ciftler).toEqual([{ ana_id: ana, kopya_id: kopya }]);

    expect(await hataMesaji(oturumla(db, yeniAnne, `select spor_sporcu_birlestir($1, $2)`, [ana, kopya]))).toMatch(/yönetimi/);
    await oturumla(db, yonetici, `select spor_sporcu_birlestir($1, $2)`, [ana, kopya]);

    const s = (await db.query<Record<string, unknown>>(
      `select veli_id, ikinci_veli_id, ikinci_veli_ad_soyad, dogum_tarihi::text as dogum, mevki, okul from spor_sporcular where id = $1`, [ana])).rows[0];
    expect(s).toEqual({ veli_id: yeniAnne, ikinci_veli_id: yeniBaba, ikinci_veli_ad_soyad: "Baba Kara", dogum: "2013-03-03", mevki: "Kaleci", okul: "Okul A" });
    expect((await db.query(`select 1 from spor_sporcular where id = $1`, [kopya])).rows).toHaveLength(0);
    // Aynı ayın iki aidatı → tek aidat; kopyanın ödemesi ana aidata geçti ve aidatı kapattı
    const a = await db.query<{ durum: string }>(`select durum from spor_aidatlar where sporcu_id = $1`, [ana]);
    expect(a.rows).toEqual([{ durum: "odendi" }]);
    expect((await db.query(`select 1 from spor_olcumler where sporcu_id = $1`, [ana])).rows).toHaveLength(1);
    expect((await db.query(`select 1 from spor_kayit_gecmisi where islem = 'BIRLESTIR' and kayit_id = $1`, [kopya])).rows).toHaveLength(1);
    // Baba artık birleşen kaydı görür
    expect(await oturumla(db, yeniBaba, `select id from spor_sporcular`)).toEqual([{ id: ana }]);
  });
});
