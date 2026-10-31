import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { hataMesaji, kullaniciAc, oturumla, veritabaniKur } from "./kurulum";

// Senaryo: kulüp tek grupla (U15) çalışırken admin ikinci grubu (U14) açar.
let db: PGlite;
let admin: string;
let yonetici15: string; // U15 finans yöneticisi (eski "yonetici" hesabı)
let antrenor15: string;
let veli15: string;
let adayVeli15: string; // çocuğu henüz onaylanmamış veli
let yonetici14: string;
let veli14: string;
let baskan: string;
let u15: string;
let u14: string;
let cocuk15: string;
let cocuk14: string;

const tek = async <T,>(p: Promise<T[]>) => (await p)[0];

beforeAll(async () => {
  db = await veritabaniKur();
  admin = await kullaniciAc(db, "admin@kulup.test", "veli");
  await db.query(`update spor_profiller set rol = 'admin' where id = $1`, [admin]);
  yonetici15 = await kullaniciAc(db, "finans15@kulup.test", "yonetici");
  antrenor15 = await kullaniciAc(db, "hoca15@kulup.test", "antrenor");
  veli15 = await kullaniciAc(db, "veli15@kulup.test", "veli");
  adayVeli15 = await kullaniciAc(db, "aday15@kulup.test", "veli");
  yonetici14 = await kullaniciAc(db, "finans14@kulup.test", "veli");
  veli14 = await kullaniciAc(db, "veli14@kulup.test", "veli");
  baskan = await kullaniciAc(db, "baskan@kulup.test", "veli");

  u15 = (await db.query<{ id: string }>(`update spor_gruplar set ad = 'U15', kod = 'u15' returning id`)).rows[0].id;
  cocuk15 = (await db.query<{ id: string }>(
    `insert into spor_sporcular (ad, soyad, durum, aylik_aidat, veli_id) values ('Ali', 'Kaya', 'aktif', 1000, $1) returning id`,
    [veli15])).rows[0].id;
  await db.query(
    `insert into spor_sporcular (ad, soyad, durum, veli_id) values ('Can', 'Er', 'onay_bekliyor', $1)`, [adayVeli15]);
  await db.query(`insert into spor_kasa_hareketleri (tur, tutar, aciklama) values ('gider', 300, 'U15 top alımı')`);
});

describe("tek grup: eski davranış", () => {
  it("tek grupta profil rolleri geçerli, seçici tek grup gösterir", async () => {
    expect(await tek(oturumla<{ r: string }>(db, yonetici15, `select spor_rol() as r`))).toEqual({ r: "yonetici" });
    expect(await oturumla(db, veli15, `select id from spor_gruplarim()`)).toHaveLength(1);
  });
});

describe("ikinci grup açılınca", () => {
  it("grubu yalnızca admin açar; eski personel ilk grubun üyesi olur", async () => {
    expect(await hataMesaji(oturumla(db, yonetici15,
      `insert into spor_gruplar (ad, kod, sira) values ('U14', 'u14', 2)`))).toMatch(/row-level security/);
    u14 = (await tek(oturumla<{ id: string }>(db, admin,
      `insert into spor_gruplar (ad, kod, sira) values ('U14', 'u14', 2) returning id`))).id;
    const uyeler = await db.query<{ kullanici_id: string; rol: string }>(
      `select kullanici_id, rol from spor_grup_uyeleri where grup_id = $1 order by rol`, [u15]);
    expect(uyeler.rows).toEqual([
      { kullanici_id: antrenor15, rol: "antrenor" },
      { kullanici_id: yonetici15, rol: "yonetici" },
    ]);
  });

  it("admin U14'e geçer, oraya sporcu ve kasa hareketi ekler", async () => {
    await oturumla(db, admin, `select spor_grup_sec($1)`, [u14]);
    cocuk14 = (await tek(oturumla<{ id: string }>(db, admin,
      `insert into spor_sporcular (ad, soyad, durum, aylik_aidat, veli_id) values ('Efe', 'Ay', 'aktif', 800, $1) returning id`,
      [veli14]))).id;
    const g = await db.query<{ grup_id: string }>(`select grup_id from spor_sporcular where id = $1`, [cocuk14]);
    expect(g.rows[0].grup_id).toBe(u14);
    await oturumla(db, admin, `insert into spor_kasa_hareketleri (tur, tutar, aciklama) values ('gelir', 500, 'U14 bağış')`);
    expect(await oturumla(db, admin, `select id from spor_sporcular`)).toEqual([{ id: cocuk14 }]);
  });

  it("admin pozisyon verir: U14 grup yöneticisi; başkan atanır", async () => {
    await oturumla(db, admin, `select spor_yetki_ver($1, 'yonetici')`, [yonetici14]);
    await oturumla(db, admin, `select spor_yetki_ver($1, 'baskan')`, [baskan]);
    expect(await tek(oturumla<{ r: string }>(db, yonetici14, `select spor_rol() as r`))).toEqual({ r: "yonetici" });
  });

  it("grup yöneticisi yalnızca kendi grubunu görür, başka gruba geçemez", async () => {
    expect(await oturumla(db, yonetici15, `select ad from spor_sporcular order by ad`)).toEqual([{ ad: "Ali" }, { ad: "Can" }]);
    expect(await oturumla(db, yonetici14, `select ad from spor_sporcular`)).toEqual([{ ad: "Efe" }]);
    expect(await hataMesaji(oturumla(db, yonetici15, `select spor_grup_sec($1)`, [u14]))).toMatch(/erişim yetkiniz yok/);
    expect(await oturumla(db, yonetici15, `select id from spor_gruplarim()`)).toEqual([{ id: u15 }]);
    // Başka grubun velisinin profili görünmez
    expect(await oturumla(db, yonetici15, `select id from spor_profiller where id = $1`, [veli14])).toHaveLength(0);
  });

  it("grup yöneticisi başka grubun kaydını değiştiremez, yetki veremez", async () => {
    const g = await oturumla<{ n: number }>(db, yonetici15,
      `with u as (update spor_sporcular set aylik_aidat = 1 where id = $1 returning 1) select count(*)::int as n from u`, [cocuk14]);
    expect(g[0].n).toBe(0);
    expect(await hataMesaji(oturumla(db, yonetici15, `select spor_yetki_ver($1, 'antrenor')`, [veli15])))
      .toMatch(/admin ya da kulüp başkanı/);
  });

  it("kasalar ayrı: her grup kendi hareketini ve tahsilatını görür", async () => {
    const k15 = await oturumla<{ aciklama: string }>(db, yonetici15, `select aciklama from spor_kasa_hareketleri`);
    expect(k15).toEqual([{ aciklama: "U15 top alımı" }]);
    const k14 = await oturumla<{ aciklama: string }>(db, yonetici14, `select aciklama from spor_kasa_hareketleri`);
    expect(k14).toEqual([{ aciklama: "U14 bağış" }]);
    const o14 = await oturumla<{ ek_gelir: string; gider: string }>(db, veli14, `select ek_gelir, gider from spor_kasa_ozeti()`);
    expect(o14.map((x) => [Number(x.ek_gelir), Number(x.gider)])).toEqual([[500, 0]]);
  });

  it("para ekranlarını antrenör, sporcu ve onaysız veli görmez", async () => {
    expect(await oturumla(db, antrenor15, `select 1 from spor_kasa_hareketleri`)).toHaveLength(0);
    expect(await oturumla(db, antrenor15, `select * from spor_kasa_ozeti()`)).toHaveLength(0);
    expect(await oturumla(db, antrenor15, `select * from spor_odemeyenler()`)).toHaveLength(0);
    expect(await oturumla(db, adayVeli15, `select 1 from spor_kasa_hareketleri`)).toHaveLength(0);
    expect(await oturumla(db, veli15, `select 1 from spor_kasa_hareketleri`)).toHaveLength(1);
    // Antrenör sporcuları görür (aidatsız iş)
    expect(await oturumla(db, antrenor15, `select 1 from spor_sporcular`)).toHaveLength(2);
  });

  it("ödeme bilgileri (IBAN) gruba özel; kulüp adı ortak", async () => {
    await db.query(`insert into spor_ayarlar (anahtar, deger) values ('iban', 'TR-KULUP'), ('kulup_adi', 'Örnek SK')`);
    await oturumla(db, yonetici14, `select spor_ayar_kaydet('{"iban":"TR-U14","kulup_adi":"Değişmesin"}'::jsonb)`);
    const a = async (k: string) => Object.fromEntries(
      (await oturumla<{ anahtar: string; deger: string }>(db, k, `select anahtar, deger from spor_ayarlari()`))
        .map((x) => [x.anahtar, x.deger]));
    expect((await a(veli14)).iban).toBe("TR-U14");
    expect((await a(veli15)).iban).toBe("TR-KULUP");
    expect((await a(veli15)).kulup_adi).toBe("Örnek SK");
  });

  it("otomatik tahakkuk her grubun kendi ayarıyla; kapalı grup atlanır", async () => {
    await oturumla(db, yonetici15, `select spor_ayar_kaydet('{"otomatik_tahakkuk":"kapali"}'::jsonb)`);
    await db.query(`select spor_gunluk_isler('2026-12-01')`);
    const r = await db.query<{ sporcu_id: string; grup_id: string }>(
      `select sporcu_id, grup_id from spor_aidatlar where donem = '2026-12-01'`);
    expect(r.rows).toEqual([{ sporcu_id: cocuk14, grup_id: u14 }]);
  });

  it("veli kayıtta grubu seçer; başvuru yalnızca o grubun yönetimine gider", async () => {
    const yeniVeli = await kullaniciAc(db, "yeni@kulup.test", "veli");
    const g = await oturumla<{ id: string }>(db, yeniVeli, `select id from spor_kayit_gruplari()`);
    expect(g).toHaveLength(2);
    await oturumla(db, yeniVeli,
      `select spor_sporcu_on_kayit('Mert', 'Su', null, null, null, null, null, null, null, null, null, null, $1)`, [u14]);
    const b = async (k: string) =>
      (await db.query(`select 1 from spor_bildirimler where kullanici_id = $1 and tur = 'yeni_kayit' and baslik like '%Mert%'`, [k])).rows.length;
    expect(await b(yonetici14)).toBe(1);
    expect(await b(admin)).toBe(1);
    expect(await b(yonetici15)).toBe(0);
  });

  it("başkan tüm gruplara geçer, grup açamaz, admin atayamaz", async () => {
    expect(await oturumla(db, baskan, `select id from spor_gruplarim()`)).toHaveLength(2);
    await oturumla(db, baskan, `select spor_grup_sec($1)`, [u15]);
    expect(await oturumla(db, baskan, `select 1 from spor_kasa_hareketleri`)).toHaveLength(1);
    expect(await hataMesaji(oturumla(db, baskan, `select spor_yetki_ver($1, 'admin')`, [veli15]))).toMatch(/yalnızca admin/);
    expect(await hataMesaji(oturumla(db, baskan,
      `insert into spor_gruplar (ad, kod) values ('U12', 'u12')`))).toMatch(/row-level security/);
  });

  it("sporcu başka gruba taşınınca geçmiş ödemesi eski grubun kasasında kalır", async () => {
    const aidat = (await db.query<{ id: string }>(
      `insert into spor_aidatlar (sporcu_id, donem, tutar) values ($1, '2025-09-01', 1000) returning id`, [cocuk15])).rows[0].id;
    await db.query(
      `insert into spor_odemeler (aidat_id, sporcu_id, tutar, durum, odeme_tarihi) values ($1, $2, 1000, 'onaylandi', '2025-09-05')`,
      [aidat, cocuk15]);
    await oturumla(db, admin, `select spor_sporcu_grup_degistir($1, $2)`, [cocuk15, u14]);
    const t15 = await oturumla<{ t: string }>(db, yonetici15, `select coalesce(sum(tahsilat), 0) as t from spor_kasa_ozeti()`);
    expect(Number(t15[0].t)).toBe(1000);
    const t14 = await oturumla<{ t: string }>(db, yonetici14, `select coalesce(sum(tahsilat), 0) as t from spor_kasa_ozeti()`);
    expect(Number(t14[0].t)).toBe(0);
    await oturumla(db, admin, `select spor_sporcu_grup_degistir($1, $2)`, [cocuk15, u15]);
  });

  it("sezon geçişi: U15 → U16 ve U14 → U15 aynı anda; kasa ve veliler kuşakla gider", async () => {
    expect(await hataMesaji(oturumla(db, yonetici15, `select spor_sezon_gecisi($1::jsonb)`,
      [JSON.stringify([{ grup_id: u15, ad: "U16", kod: "u16" }])]))).toMatch(/admin/);
    await oturumla(db, admin, `select spor_sezon_gecisi($1::jsonb)`, [JSON.stringify([
      { grup_id: u15, ad: "U16", kod: "u16" },
      { grup_id: u14, ad: "U15", kod: "u15" },
    ])]);
    const g = await db.query<{ id: string; ad: string }>(`select id, ad from spor_gruplar order by sira`);
    expect(g.rows).toEqual([{ id: u15, ad: "U16" }, { id: u14, ad: "U15" }]);
    expect(await oturumla(db, yonetici15, `select aciklama from spor_kasa_hareketleri`)).toEqual([{ aciklama: "U15 top alımı" }]);
  });
});
