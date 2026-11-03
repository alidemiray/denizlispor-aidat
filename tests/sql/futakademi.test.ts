import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { hataMesaji, kullaniciAc, oturumla, veritabaniKur } from "./kurulum";

// FutAkademi ajanı: ağ yerine sahte yanıt tablosu (spor_fa_get taklidi).
// Senaryo: U15 grubunda 3 haftalık mini lig; FutAkademi sonuçları ve kadroları geç giriyor.
let db: PGlite;
let admin: string;
let veli: string;
let u15: string;
let u14: string;
let enes: string;

const LIG = "11111111-1111-1111-1111-111111111111";
const BIZ = "22222222-2222-2222-2222-222222222222";
const RAKIP_A = "33333333-3333-3333-3333-333333333333";
const RAKIP_B = "44444444-4444-4444-4444-444444444444";
const LIG14 = "55555555-5555-5555-5555-555555555555";
const mid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

function mac(n: number, ev: string, dep: string, zaman: string, skor: [number, number] | null) {
  const ad = (id: string) => (id === BIZ ? "DENİZLİSPOR" : id === RAKIP_A ? "GAZİEMİR G.O.G. SPOR YAT. A.Ş." : "MENTEŞE YILDIZ SPOR");
  return {
    id: mid(n), weekNumber: n, homeTeamId: ev, awayTeamId: dep,
    homeScore: skor ? skor[0] : null, awayScore: skor ? skor[1] : null,
    playedAt: zaman, tffMacId: String(900 + n),
    homeTeam: { id: ev, name: ad(ev) }, awayTeam: { id: dep, name: ad(dep) },
  };
}
const hafta = (n: number, maclar: unknown[]) => ({ weekNumber: n, matches: maclar });

async function yanit(yol: string, veri: unknown) {
  await db.query(
    `insert into test_fa (yol, veri) values ($1, $2::jsonb) on conflict (yol) do update set veri = excluded.veri`,
    [yol, veri === null ? null : JSON.stringify(veri)]);
}
const say = async (sql: string, p: unknown[] = []) =>
  Number((await db.query<{ n: number }>(sql, p)).rows[0].n);

beforeAll(async () => {
  db = await veritabaniKur();
  admin = await kullaniciAc(db, "admin@kulup.test", "veli");
  await db.query(`update spor_profiller set rol = 'admin' where id = $1`, [admin]);
  veli = await kullaniciAc(db, "veli@kulup.test", "veli");
  u15 = (await db.query<{ id: string }>(`update spor_gruplar set ad = 'U15', kod = 'u15' returning id`)).rows[0].id;
  u14 = (await db.query<{ id: string }>(`insert into spor_gruplar (ad, kod, sira) values ('U14', 'u14', 2) returning id`)).rows[0].id;

  // Ağ taklidi
  await db.exec(`
    create table test_fa (yol text primary key, veri jsonb);
    create table test_fa_hata (yol text primary key);
    create or replace function public.spor_fa_get(p_yol text) returns jsonb language plpgsql as $$
    begin
      if exists (select 1 from test_fa_hata where yol = p_yol) then raise exception 'FutAkademi okunamadı (% · HTTP 503)', p_yol; end if;
      return (select veri from test_fa where yol = p_yol);
    end $$;`);

  await db.query(
    `insert into spor_dis_kaynaklar (grup_id, lig_id, takim_id, lig_adi, sezon) values ($1, $2, $3, 'U15 Gelişim Ligi 6. Grup', '2026-2027')`,
    [u15, LIG, BIZ]);

  // Panelde önceden: notunda TFF numarası olan sporcu + elle girilmiş 2. hafta maçı (TFF no yok, skor elle)
  enes = (await db.query<{ id: string }>(
    `insert into spor_sporcular (grup_id, ad, soyad, durum, tff_no, notlar) values ($1, 'Hüseyin Enes', 'Demiray', 'aktif', 'TFF100', 'TFF lisans: TFF100') returning id`,
    [u15])).rows[0].id;
  await db.query(
    `insert into spor_maclar (grup_id, tarih, saat, rakip, yer, tur, skor_biz, skor_rakip) values ($1, '2026-10-25', '13:00', 'Menteşe Yıldız Spor', 'dis', 'lig', 0, 1)`,
    [u15]);

  await yanit(`/leagues/${LIG}/weeks`, [1, 2, 3]);
  await yanit(`/leagues/${LIG}/weeks/1`, hafta(1, [mac(1, BIZ, RAKIP_A, "2026-10-18T10:00:00.000Z", [2, 1])]));
  // 2. hafta: FutAkademi henüz skor girmemiş
  await yanit(`/leagues/${LIG}/weeks/2`, hafta(2, [mac(2, RAKIP_B, BIZ, "2026-10-25T10:00:00.000Z", null)]));
  // 3. hafta: uzak gelecek, yer tutucu saat (08:00Z) → saat yazılmamalı
  await yanit(`/leagues/${LIG}/weeks/3`, hafta(3, [mac(3, BIZ, RAKIP_B, "2026-12-20T08:00:00.000Z", null)]));
  // 1. haftanın detayı henüz yok (gecikmeli)
  await yanit(`/leagues/matches/${mid(1)}/detay`, { match: mac(1, BIZ, RAKIP_A, "2026-10-18T10:00:00.000Z", [2, 1]), detail: null });
});

describe("FutAkademi ajanı", () => {
  it("fikstürü ekler, elle girilmiş maçı benimser ve elle skoru korur", async () => {
    const s = await db.query<{ r: Record<string, { eklenen: number; hatalar: string[] }> }>(
      `select spor_futakademi_senkron('2026-11-03') as r`);
    expect(s.rows[0].r.U15.hatalar).toEqual([]);
    expect(s.rows[0].r.U15.eklenen).toBe(2);
    const m = (await db.query<Record<string, unknown>>(
      `select hafta, tarih::text, saat::text, rakip, yer, skor_biz, skor_rakip, tff_mac_no, aciklama from spor_maclar where grup_id = $1 order by hafta`, [u15])).rows;
    expect(m).toHaveLength(3);
    expect(m[0]).toMatchObject({ hafta: 1, tarih: "2026-10-18", saat: "13:00:00", rakip: "Gaziemir G.O.G. Spor Yat. A.Ş.", yer: "ic", skor_biz: 2, skor_rakip: 1, tff_mac_no: "901" });
    expect(m[1]).toMatchObject({ hafta: 2, rakip: "Menteşe Yıldız Spor", skor_biz: 0, skor_rakip: 1, tff_mac_no: "902" });
    expect(m[1].aciklama).toMatch(/Sonuç elle girildi/);
    expect(m[2]).toMatchObject({ hafta: 3, saat: null });
    expect(m[2].aciklama).toMatch(/Saat henüz açıklanmadı/);
  });

  it("ikinci çalışma hiçbir şeyi değiştirmez, bildirim çoğaltmaz", async () => {
    const once = await say(`select count(*) n from spor_bildirimler`);
    const s = await db.query<{ r: Record<string, { eklenen: number; guncellenen: number }> }>(
      `select spor_futakademi_senkron('2026-11-03') as r`);
    expect(s.rows[0].r.U15).toMatchObject({ eklenen: 0, guncellenen: 0 });
    expect(await say(`select count(*) n from spor_bildirimler`)).toBe(once);
    expect(await say(`select count(*) n from spor_senkron_gunlugu`)).toBe(2);
  });

  it("yeni skor gelince bir kez bildirir", async () => {
    expect(await say(`select count(*) n from spor_bildirimler where tur = 'mac_sonucu' and kullanici_id = $1`, [admin])).toBe(1); // 1. hafta
    await yanit(`/leagues/${LIG}/weeks/2`, hafta(2, [mac(2, RAKIP_B, BIZ, "2026-10-25T10:00:00.000Z", [3, 2])]));
    await db.query(`select spor_futakademi_senkron('2026-11-04')`);
    await db.query(`select spor_futakademi_senkron('2026-11-04')`);
    const m = (await db.query<{ skor_biz: number; skor_rakip: number }>(`select skor_biz, skor_rakip from spor_maclar where tff_mac_no = '902'`)).rows[0];
    expect(m).toEqual({ skor_biz: 2, skor_rakip: 3 }); // resmi skor elle girileni geçer
    const b = (await db.query<{ baslik: string }>(
      `select baslik from spor_bildirimler where tur = 'mac_sonucu' and kullanici_id = $1 order by created_at`, [admin])).rows;
    expect(b.map((x) => x.baslik)).toEqual(["U15 · Gaziemir G.O.G. Spor Yat. A.Ş. 2–1 galibiyet", "U15 · Menteşe Yıldız Spor 2–3 mağlubiyet"]);
    expect(await say(`select count(*) n from spor_bildirimler where kullanici_id = $1`, [veli])).toBe(0);
  });

  it("kadro detayı geç gelir: gelince işler, eksik oyuncuyu aidatsız açar", async () => {
    expect(await say(`select count(*) n from spor_mac_katilim`)).toBe(0);
    await yanit(`/leagues/matches/${mid(1)}/detay`, {
      match: mac(1, BIZ, RAKIP_A, "2026-10-18T10:00:00.000Z", [2, 1]),
      detail: {
        homeLineup: [
          { name: "HÜSEYİN ENES DEMİRAY", tffId: "TFF100", minutesPlayed: 90, playerId: mid(7) },
          { name: "ONUR ARITÜRK", tffId: "TFF200", minutesPlayed: 60, playerId: mid(8) },
        ],
        homeBench: [
          { name: "YEDEK OTURAN", tffId: "TFF300", minutesPlayed: 0 },
          { name: "MUHAMMED ÖMER SERÇE", tffId: "TFF400", minutesPlayed: 30 },
        ],
        awayLineup: [{ name: "RAKİP OYUNCU", tffId: "TFF999", minutesPlayed: 90 }],
        awayBench: [],
        goals: [
          { team: "home", tffId: "TFF100", ownGoal: false }, { team: "home", tffId: "TFF100", ownGoal: false },
          { team: "away", tffId: "TFF999", ownGoal: false },
        ],
        cards: [
          { team: "home", tffId: "TFF200", cardType: "yellow" },
          { team: "home", tffId: "TFF400", cardType: "yellow" }, { team: "home", tffId: "TFF400", cardType: "red" },
        ],
      },
    });
    await yanit(`/players/${mid(8)}`, { birthDate: "2012-02-28T00:00:00.000Z", birthPlace: "DENİZLİ" });
    await db.query(`select spor_futakademi_senkron('2026-11-05')`);
    const k = (await db.query<Record<string, unknown>>(
      `select s.ad, s.soyad, k.dakika, k.ilk_onbir, k.gol, k.kart, k.kaynak from spor_mac_katilim k join spor_sporcular s on s.id = k.sporcu_id order by k.dakika desc`)).rows;
    expect(k).toEqual([
      { ad: "Hüseyin Enes", soyad: "Demiray", dakika: 90, ilk_onbir: true, gol: 2, kart: "yok", kaynak: "futakademi" },
      { ad: "Onur", soyad: "Arıtürk", dakika: 60, ilk_onbir: true, gol: 0, kart: "sari", kaynak: "futakademi" },
      { ad: "Muhammed Ömer", soyad: "Serçe", dakika: 30, ilk_onbir: false, gol: 0, kart: "cift_sari", kaynak: "futakademi" },
    ]);
    const yeni = (await db.query<Record<string, unknown>>(
      `select dogum_tarihi::text, aylik_aidat::int, durum, grup_id = $1 as u15, notlar from spor_sporcular where tff_no = 'TFF200'`, [u15])).rows[0];
    expect(yeni).toMatchObject({ dogum_tarihi: "2012-02-28", aylik_aidat: 0, durum: "aktif", u15: true });
    expect(yeni.notlar).toMatch(/Doğum yeri: Denizli/);
    expect(await say(`select count(*) n from spor_aidatlar`)).toBe(0);
    expect(await say(`select count(*) n from spor_sporcular where tff_no = 'TFF300'`)).toBe(0);
    expect(await say(`select count(*) n from spor_bildirimler where tur = 'mac_kadro' and kullanici_id = $1`, [admin])).toBe(1);
    // tekrar çalışınca kadro yeniden okunmaz, sporcu çoğalmaz
    await db.query(`select spor_futakademi_senkron('2026-11-06')`);
    expect(await say(`select count(*) n from spor_sporcular`)).toBe(3);
    expect(await say(`select count(*) n from spor_mac_katilim`)).toBe(3);
  });

  it("elle girilmiş kadroya dokunmaz", async () => {
    const m2 = (await db.query<{ id: string }>(`select id from spor_maclar where tff_mac_no = '902'`)).rows[0].id;
    await db.query(`insert into spor_mac_katilim (mac_id, sporcu_id, dakika) values ($1, $2, 45)`, [m2, enes]);
    const r = await db.query<{ r: { adet: number; atlandi?: string } }>(
      `select spor_fa_kadro_isle($1, $2::jsonb, false) as r`,
      [m2, JSON.stringify({ match: { homeTeamId: RAKIP_B, awayTeamId: BIZ }, detail: { awayLineup: [{ name: "HÜSEYİN ENES DEMİRAY", tffId: "TFF100", minutesPlayed: 90 }] } })]);
    expect(r.rows[0].r.atlandi).toBe("elle girilmiş kadro");
    expect(await say(`select dakika n from spor_mac_katilim where mac_id = $1`, [m2])).toBe(45);
  });

  it("tarih ertelenirse günceller; bir grubun hatası diğerini durdurmaz, hata bir kez bildirilir", async () => {
    await yanit(`/leagues/${LIG}/weeks/3`, hafta(3, [mac(3, BIZ, RAKIP_B, "2026-12-27T08:00:00.000Z", null)]));
    await db.query(
      `insert into spor_dis_kaynaklar (grup_id, lig_id, takim_id, lig_adi, sezon) values ($1, $2, $3, 'U14 Gelişim Ligi 6. Grup', '2026-2027')`,
      [u14, LIG14, BIZ]);
    await db.query(`insert into test_fa_hata (yol) values ($1)`, [`/leagues/${LIG14}/weeks`]);
    const r = await db.query<{ r: Record<string, { hatalar: string[] }> }>(`select spor_futakademi_senkron('2026-11-07') as r`);
    await db.query(`select spor_futakademi_senkron('2026-11-07')`);
    expect(r.rows[0].r.U15.hatalar).toEqual([]);
    expect(r.rows[0].r.U14.hatalar[0]).toMatch(/HTTP 503/);
    expect(await say(`select count(*) n from spor_maclar where tff_mac_no = '903' and tarih = '2026-12-27'`)).toBe(1);
    expect(await say(`select count(*) n from spor_bildirimler where tur = 'senkron_hatasi' and kullanici_id = $1`, [admin])).toBe(1);
    const k = (await db.query<{ son_durum: string }>(`select son_durum from spor_dis_kaynaklar where grup_id = $1`, [u14])).rows[0];
    expect(k.son_durum).toMatch(/^hata/);
  });

  it("sezon bitince: tüm maçlar skorlu + 45 gün sonra o grubun taraması kapanır, bir kez bildirilir", async () => {
    await yanit(`/leagues/${LIG}/weeks/3`, hafta(3, [mac(3, BIZ, RAKIP_B, "2026-12-27T08:00:00.000Z", [1, 1])]));
    await db.query(`select spor_futakademi_senkron('2027-01-20')`);  // son maç + 24 gün: sürer
    expect((await db.query<{ aktif: boolean }>(`select aktif from spor_dis_kaynaklar where grup_id = $1`, [u15])).rows[0].aktif).toBe(true);
    const r = await db.query<{ r: Record<string, { sezon_bitti?: boolean }> }>(`select spor_futakademi_senkron('2027-02-15') as r`);
    expect(r.rows[0].r.U15.sezon_bitti).toBe(true);
    const k = (await db.query<{ aktif: boolean; bitis_tarihi: string; son_durum: string }>(
      `select aktif, bitis_tarihi::text, son_durum from spor_dis_kaynaklar where grup_id = $1`, [u15])).rows[0];
    expect(k).toMatchObject({ aktif: false, bitis_tarihi: "2027-02-15" });
    expect(k.son_durum).toMatch(/^sezon bitti/);
    const once = await say(`select count(*) n from spor_senkron_gunlugu where grup_id = $1`, [u15]);
    await db.query(`select spor_futakademi_senkron('2027-02-16')`);  // kapalı grup taranmaz
    expect(await say(`select count(*) n from spor_senkron_gunlugu where grup_id = $1`, [u15])).toBe(once);
    expect(await say(`select count(*) n from spor_bildirimler where tur = 'sezon_bitti' and kullanici_id = $1`, [admin])).toBe(1);
  });

  it("FutAkademi bir sonucu hiç girmese de son maçtan 90 gün sonra kapanır; yeni sezonda yeniden açılır", async () => {
    await db.query(`delete from test_fa_hata`);
    await yanit(`/leagues/${LIG14}/weeks`, [1]);
    await yanit(`/leagues/${LIG14}/weeks/1`, hafta(1, [mac(5, BIZ, RAKIP_A, "2027-03-01T10:00:00.000Z", null)]));
    await db.query(`select spor_futakademi_senkron('2027-05-01')`);  // 61 gün: skorsuz maç var, sürer
    expect((await db.query<{ aktif: boolean }>(`select aktif from spor_dis_kaynaklar where grup_id = $1`, [u14])).rows[0].aktif).toBe(true);
    await db.query(`select spor_futakademi_senkron('2027-06-05')`);  // 96 gün
    const k = (await db.query<{ aktif: boolean; son_durum: string }>(`select aktif, son_durum from spor_dis_kaynaklar where grup_id = $1`, [u14])).rows[0];
    expect(k.aktif).toBe(false);
    expect(k.son_durum).toMatch(/1 maçın sonucu FutAkademi'de hiç girilmedi/);
    expect(await db.query(`select spor_futakademi_zamanlama() as z`).then((x) => (x.rows[0] as { z: string }).z)).toBe("pg_cron yok");
    // yeni sezon
    await db.query(`update spor_dis_kaynaklar set lig_id = $2, sezon = '2027-2028', aktif = true where grup_id = $1`, [u14, LIG]);
    const y = (await db.query<{ aktif: boolean; bitis_tarihi: string | null }>(`select aktif, bitis_tarihi from spor_dis_kaynaklar where grup_id = $1`, [u14])).rows[0];
    expect(y).toEqual({ aktif: true, bitis_tarihi: null });
  });

  it("yetkiler: ajan dışarıdan çağrılamaz; 'şimdi güncelle' yalnız kulüp yönetimine", async () => {
    expect(await hataMesaji(oturumla(db, veli, `select spor_futakademi_senkron()`))).toMatch(/permission denied/);
    expect(await hataMesaji(oturumla(db, veli, `select spor_fa_get('/x')`))).toMatch(/permission denied/);
    expect(await hataMesaji(oturumla(db, veli, `select spor_futakademi_simdi()`))).toMatch(/kulüp yönetimi/);
    expect(await oturumla(db, veli, `select * from spor_senkron_gunlugu`)).toHaveLength(0);
    expect((await oturumla(db, admin, `select * from spor_senkron_gunlugu`)).length).toBeGreaterThan(0);
    expect(await hataMesaji(oturumla(db, admin, `insert into spor_dis_kaynaklar (grup_id, lig_id, takim_id, lig_adi, sezon) values ('${u14}', '${LIG}', '${BIZ}', 'x y', '2026-2027')`)))
      .toMatch(/permission denied|row-level security/);
  });

  it("Türkçe başlık ve sade karşılaştırma", async () => {
    const r = (await db.query<Record<string, string>>(
      `select spor_tr_baslik('DENİZLİ İDMANYURDU 1959 SPOR KULÜBÜ') a, spor_tr_baslik('BODRUM FK') b,
              spor_tr_sade('Menteşe Yıldız Spor') = spor_tr_sade('MENTEŞE YILDIZ SPOR') c`)).rows[0];
    expect(r).toEqual({ a: "Denizli İdmanyurdu 1959 Spor Kulübü", b: "Bodrum FK", c: true });
  });
});
