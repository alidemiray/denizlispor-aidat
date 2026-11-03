-- =====================================================================
-- 20261110 · FutAkademi otomatik veri kanalı (maç fikstürü, skor, maç kadrosu)
--
-- Ne yapar?
--   Veritabanının içinde çalışan bir "ajan": günde iki kez FutAkademi'nin herkese açık
--   API'sini (api.futakademi.com) okur ve her yapılandırılmış grup için
--     · lig fikstürünü (34 hafta) ekler / tarih-saat değişikliklerini günceller,
--     · sonuçlanan maçların skorunu yazar (FutAkademi geç girse de sonraki turda yakalar),
--     · skoru belli olan maçların kadrosunu (dakika, ilk 11, gol, kart) işler,
--     · kadroda olup panelde olmayan oyuncuyu sporcu olarak açar (aidatsız),
--     · yeni skor / kadro / hata için grup yönetimine bildirim bırakır,
--     · her çalışmayı spor_senkron_gunlugu tablosuna yazar.
--   Kimseye sormaz; aynı veriyi iki kez yazmaz (maç = TFF maç no, sporcu = TFF lisans no).
--   Elle girilmiş veriyi ezmez: elle girilen kadro satırına dokunmaz; FutAkademi'de skor yoksa
--   paneldeki elle girilmiş skoru korur; FutAkademi skoru varsa resmi skor odur.
--
-- Kulüp ayarı: spor_dis_kaynaklar (grup başına lig ve takım kimliği). Kulübe özgü satırlar
-- bu göçte değil, kulübün kendi veri dosyasında eklenir.
--
-- Gerekenler: Supabase'de "http" ve "pg_cron" eklentileri (yoksa göç yine kurulur, yalnızca
-- zamanlama atlanır ve uyarı verilir).
-- =====================================================================

-- --------------------------------------------------------------- 1. eklentiler
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'http') then
    create schema if not exists extensions;
    create extension if not exists http with schema extensions;
  end if;
exception when others then
  raise notice 'http eklentisi açılamadı: %', sqlerrm;
end $$;

-- --------------------------------------------------------------- 2. sütunlar
alter table public.spor_sporcular   add column if not exists tff_no text;
alter table public.spor_maclar      add column if not exists tff_mac_no text;
alter table public.spor_maclar      add column if not exists dis_id text;          -- FutAkademi maç kimliği
alter table public.spor_maclar      add column if not exists hafta integer;
alter table public.spor_maclar      add column if not exists dis_kaynak text;
alter table public.spor_mac_katilim add column if not exists kaynak text;          -- 'futakademi' ya da null (elle)

create unique index if not exists spor_sporcular_grup_tff_no
  on public.spor_sporcular (grup_id, tff_no) where tff_no is not null;
create index if not exists spor_sporcular_tff_no on public.spor_sporcular (tff_no) where tff_no is not null;
create unique index if not exists spor_maclar_grup_tff_mac_no
  on public.spor_maclar (grup_id, tff_mac_no) where tff_mac_no is not null;

-- Daha önce notlara / açıklamaya yazılmış TFF numaralarını sütunlara taşı
update public.spor_sporcular s
   set tff_no = substring(s.notlar from 'TFF lisans: (TFF[0-9]+)')
 where s.tff_no is null and s.notlar ~ 'TFF lisans: TFF[0-9]+'
   and not exists (select 1 from public.spor_sporcular x
                    where x.grup_id = s.grup_id and x.id <> s.id
                      and x.tff_no = substring(s.notlar from 'TFF lisans: (TFF[0-9]+)'));

update public.spor_maclar
   set tff_mac_no = substring(aciklama from 'TFF maç no ([0-9]+)'),
       hafta      = coalesce(hafta, substring(aciklama from '· ([0-9]+)\. hafta')::integer),
       dis_kaynak = 'futakademi'
 where tff_mac_no is null and aciklama ~ 'TFF maç no [0-9]+'
   and not public.spor_sezon_muhurlu_grup(tarih, grup_id);

-- --------------------------------------------------------------- 3. tablolar
create table if not exists public.spor_dis_kaynaklar (
  grup_id     uuid primary key references public.spor_gruplar (id) on delete cascade,
  kaynak      text not null default 'futakademi' check (kaynak in ('futakademi')),
  lig_id      text not null check (lig_id ~ '^[0-9a-f-]{36}$'),
  takim_id    text not null check (takim_id ~ '^[0-9a-f-]{36}$'),
  lig_adi     text not null check (char_length(lig_adi) between 2 and 80),
  sezon       text not null check (sezon ~ '^[0-9]{4}-[0-9]{4}$'),
  aktif       boolean not null default true,
  son_calisma timestamptz,
  son_durum   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.spor_senkron_gunlugu (
  id       bigint generated always as identity primary key,
  zaman    timestamptz not null default now(),
  grup_id  uuid references public.spor_gruplar (id) on delete cascade,
  kaynak   text not null default 'futakademi',
  ozet     jsonb not null default '{}'::jsonb,
  hata     text
);
create index if not exists spor_senkron_gunlugu_zaman on public.spor_senkron_gunlugu (zaman desc);

alter table public.spor_dis_kaynaklar   enable row level security;
alter table public.spor_senkron_gunlugu enable row level security;

drop policy if exists spor_dis_kaynaklar_oku on public.spor_dis_kaynaklar;
create policy spor_dis_kaynaklar_oku on public.spor_dis_kaynaklar
  for select to authenticated using (public.spor_kulup_geneli_mi());
drop policy if exists spor_senkron_gunlugu_oku on public.spor_senkron_gunlugu;
create policy spor_senkron_gunlugu_oku on public.spor_senkron_gunlugu
  for select to authenticated using (public.spor_kulup_geneli_mi());

revoke all on public.spor_dis_kaynaklar, public.spor_senkron_gunlugu from anon;
grant select on public.spor_dis_kaynaklar, public.spor_senkron_gunlugu to authenticated;

-- Bildirim türleri
alter table public.spor_bildirimler drop constraint if exists spor_bildirimler_tur_check;
alter table public.spor_bildirimler add constraint spor_bildirimler_tur_check check (tur in (
  'aidat_yaklasiyor', 'aidat_bugun', 'aidat_gecikti',
  'yoklama_gelmedi', 'odeme_onaylandi', 'odeme_reddedildi',
  'kayit_onaylandi', 'yeni_odeme', 'yeni_kayit', 'deneme_dersi', 'zimmet_iade', 'veli_baglama',
  'kasa_acilis', 'mac_sonucu', 'mac_kadro', 'senkron_hatasi'));

-- --------------------------------------------------------------- 4. Türkçe metin yardımcıları
create or replace function public.spor_tr_kucuk(p text)
returns text language sql immutable as $$
  select translate(p, 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ', 'abcçdefgğhıijklmnoöpqrsştuüvwxyz')
$$;

create or replace function public.spor_tr_buyuk(p text)
returns text language sql immutable as $$
  select translate(p, 'abcçdefgğhıijklmnoöpqrsştuüvwxyz', 'ABCÇDEFGĞHIİJKLMNOÖPQRSŞTUÜVWXYZ')
$$;

-- "GAZİEMİR G.O.G. SPOR YAT. A.Ş." → "Gaziemir G.O.G. Spor Yat. A.Ş."
create or replace function public.spor_tr_baslik(p text)
returns text language sql immutable as $$
  select string_agg(
           case when k ~ '^([A-ZÇĞİÖŞÜ]\.)+$' or k in ('FK', 'SK', 'GSK', 'AŞ')
                then k
                else public.spor_tr_buyuk(left(public.spor_tr_kucuk(k), 1)) || substr(public.spor_tr_kucuk(k), 2)
           end, ' ' order by n)
    from regexp_split_to_table(btrim(regexp_replace(replace(coalesce(p, ''), chr(775), ''), '\s+', ' ', 'g')), ' ')
         with ordinality as t(k, n)
   where k <> ''
$$;

-- Karşılaştırma için sade biçim: küçük harf, Türkçe harfler Latin, yalnız harf/rakam
create or replace function public.spor_tr_sade(p text)
returns text language sql immutable as $$
  select regexp_replace(translate(public.spor_tr_kucuk(replace(coalesce(p, ''), chr(775), '')),
                                  'çğıöşüâîû', 'cgiosuaiu'), '[^a-z0-9]', '', 'g')
$$;

-- --------------------------------------------------------------- 5. FutAkademi okuyucu
-- 200 → jsonb; 404 → null; diğer / ağ hatası → 3 deneme, sonra hata.
create or replace function public.spor_fa_get(p_yol text)
returns jsonb
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare
  v_durum  integer;
  v_icerik text;
  v_deneme integer := 0;
  v_hata   text;
begin
  if p_yol !~ '^/[A-Za-z0-9/_-]+$' then
    raise exception 'Geçersiz FutAkademi yolu: %', p_yol;
  end if;
  loop
    v_deneme := v_deneme + 1;
    begin
      perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
      select status, content into v_durum, v_icerik
        from extensions.http_get('https://api.futakademi.com/api/v1' || p_yol);
      if v_durum = 200 then return v_icerik::jsonb; end if;
      if v_durum = 404 then return null; end if;
      v_hata := 'HTTP ' || v_durum;
    exception when others then
      v_hata := sqlerrm;
    end;
    if v_deneme >= 3 then
      raise exception 'FutAkademi okunamadı (% · %)', p_yol, v_hata;
    end if;
    perform pg_sleep(3 * v_deneme);
  end loop;
end;
$$;

-- --------------------------------------------------------------- 6. bir haftanın maçlarını işle
-- p_hafta: /leagues/<lig>/weeks/<n> yanıtı. Dönüş: {eklenen, guncellenen, skor:[mac id], hatalar:[...]}
create or replace function public.spor_fa_hafta_isle(p_grup uuid, p_hafta jsonb, p_bugun date)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  k          public.spor_dis_kaynaklar%rowtype;
  v_grup_adi text;
  m          jsonb;
  r          public.spor_maclar%rowtype;
  v_bulundu  boolean;
  v_ic       boolean;
  v_rakip    text;
  v_an       timestamp;
  v_tarih    date;
  v_saat     time;
  v_biz      integer;
  v_rak      integer;
  v_tff      text;
  v_hafta_no integer;
  v_ack      text;
  v_eklenen  integer := 0;
  v_guncel   integer := 0;
  v_skor     jsonb := '[]'::jsonb;
  v_hatalar  jsonb := '[]'::jsonb;
begin
  select * into k from public.spor_dis_kaynaklar where grup_id = p_grup;
  if not found then raise exception 'Grup için dış kaynak tanımlı değil'; end if;
  select ad into v_grup_adi from public.spor_gruplar where id = p_grup;

  for m in select value from jsonb_array_elements(coalesce(p_hafta -> 'matches', '[]'::jsonb))
  loop
    continue when m ->> 'homeTeamId' is distinct from k.takim_id and m ->> 'awayTeamId' is distinct from k.takim_id;
    begin
      v_ic       := (m ->> 'homeTeamId') = k.takim_id;
      v_rakip    := public.spor_tr_baslik(case when v_ic then m -> 'awayTeam' ->> 'name' else m -> 'homeTeam' ->> 'name' end);
      v_an       := ((m ->> 'playedAt')::timestamptz) at time zone 'Europe/Istanbul';
      v_tarih    := v_an::date;
      v_biz      := case when v_ic then (m ->> 'homeScore')::integer else (m ->> 'awayScore')::integer end;
      v_rak      := case when v_ic then (m ->> 'awayScore')::integer else (m ->> 'homeScore')::integer end;
      if v_biz is null or v_rak is null then v_biz := null; v_rak := null; end if;
      -- Saat: yerel 00:00 = belli değil; 10 günden uzak oynanmamış maçta FutAkademi yer tutucu saat koyuyor
      v_saat     := case when v_an::time = time '00:00' then null
                         when v_biz is not null or v_tarih <= p_bugun + 10 then v_an::time
                         else null end;
      v_tff      := coalesce(nullif(m ->> 'tffMacId', ''), 'fa-' || (m ->> 'id'));
      v_hafta_no := coalesce((m ->> 'weekNumber')::integer, (p_hafta ->> 'weekNumber')::integer);
      if v_rakip is null or v_rakip = '' or v_tarih is null then
        raise exception 'eksik maç verisi';
      end if;

      -- 1) TFF maç no ile   2) aynı gün + aynı rakip   3) ±21 gün, aynı rakip ve saha, numarasız lig maçı
      select * into r from public.spor_maclar where grup_id = p_grup and tff_mac_no = v_tff;
      v_bulundu := found;
      if not v_bulundu then
        select * into r from public.spor_maclar
         where grup_id = p_grup and tff_mac_no is null and tarih = v_tarih
           and public.spor_tr_sade(rakip) = public.spor_tr_sade(v_rakip)
         limit 1;
        v_bulundu := found;
      end if;
      if not v_bulundu then
        select * into r from public.spor_maclar
         where grup_id = p_grup and tff_mac_no is null and tur = 'lig'
           and yer = case when v_ic then 'ic' else 'dis' end
           and abs(tarih - v_tarih) <= 21
           and public.spor_tr_sade(rakip) = public.spor_tr_sade(v_rakip)
         order by abs(tarih - v_tarih)
         limit 1;
        v_bulundu := found;
      end if;

      -- Açıklama: geçmişte kalmış skorsuz maçta paneldeki (elle) skor varsa onu da hesaba kat
      v_ack := k.lig_adi || ' · ' || v_hafta_no || '. hafta'
        || case when v_biz is not null then ''
                when v_tarih < p_bugun and (not v_bulundu or r.skor_biz is null) then ' · FutAkademi''de sonuç henüz yok'
                when v_tarih < p_bugun then ' · Sonuç elle girildi; FutAkademi''de henüz yok'
                when v_saat is null then ' · Saat henüz açıklanmadı'
                else '' end
        || ' · TFF maç no ' || v_tff;

      if not v_bulundu then
        insert into public.spor_maclar
          (grup_id, tarih, saat, rakip, yas_grubu, yer, tur, skor_biz, skor_rakip, aciklama,
           tff_mac_no, dis_id, hafta, dis_kaynak)
        values
          (p_grup, v_tarih, v_saat, v_rakip, v_grup_adi, case when v_ic then 'ic' else 'dis' end, 'lig',
           v_biz, v_rak, v_ack, v_tff, m ->> 'id', v_hafta_no, 'futakademi')
        returning * into r;
        v_eklenen := v_eklenen + 1;
        if v_biz is not null then v_skor := v_skor || to_jsonb(r.id); end if;
      else
        if v_biz is not null and (r.skor_biz is distinct from v_biz or r.skor_rakip is distinct from v_rak) then
          v_skor := v_skor || to_jsonb(r.id);
        end if;
        update public.spor_maclar
           set tarih      = v_tarih,
               saat       = case when v_saat is not null then v_saat
                                 when r.tarih = v_tarih then r.saat else null end,
               yer        = case when v_ic then 'ic' else 'dis' end,
               rakip      = case when public.spor_tr_sade(r.rakip) = public.spor_tr_sade(v_rakip) then r.rakip else v_rakip end,
               skor_biz   = coalesce(v_biz, r.skor_biz),
               skor_rakip = case when v_biz is not null then v_rak else r.skor_rakip end,
               aciklama   = case when r.aciklama is null or r.aciklama like k.lig_adi || ' · %' then v_ack else r.aciklama end,
               tff_mac_no = v_tff,
               dis_id     = m ->> 'id',
               hafta      = v_hafta_no,
               dis_kaynak = 'futakademi'
         where id = r.id
           and (tarih, saat, yer, rakip, skor_biz, skor_rakip, aciklama, tff_mac_no, dis_id, hafta, dis_kaynak)
               is distinct from
               (v_tarih,
                case when v_saat is not null then v_saat when r.tarih = v_tarih then r.saat else null end,
                case when v_ic then 'ic' else 'dis' end,
                case when public.spor_tr_sade(r.rakip) = public.spor_tr_sade(v_rakip) then r.rakip else v_rakip end,
                coalesce(v_biz, r.skor_biz),
                case when v_biz is not null then v_rak else r.skor_rakip end,
                case when r.aciklama is null or r.aciklama like k.lig_adi || ' · %' then v_ack else r.aciklama end,
                v_tff, m ->> 'id', v_hafta_no, 'futakademi');
        if found then v_guncel := v_guncel + 1; end if;
      end if;
    exception when others then
      v_hatalar := v_hatalar || to_jsonb(coalesce(v_hafta_no::text || '. hafta: ', '') || sqlerrm);
    end;
  end loop;

  return jsonb_build_object('eklenen', v_eklenen, 'guncellenen', v_guncel, 'skor', v_skor, 'hatalar', v_hatalar);
end;
$$;

-- --------------------------------------------------------------- 7. bir maçın kadrosunu işle
-- p_detay: /leagues/matches/<id>/detay yanıtı. Dönüş: işlenen oyuncu sayısı; detay hazır değilse -1.
-- Panelde olmayan oyuncu için sporcu açılır (oyuncu kimliğinden doğum tarihi okunur).
create or replace function public.spor_fa_kadro_isle(p_mac uuid, p_detay jsonb, p_oyuncu_oku boolean default true)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  mc        public.spor_maclar%rowtype;
  k         public.spor_dis_kaynaklar%rowtype;
  v_grup_adi text;
  d         jsonb := p_detay -> 'detail';
  v_taraf   text;
  p         jsonb;
  v_ilk11   boolean;
  v_tff     text;
  v_dk      integer;
  v_gol     integer;
  v_sari    integer;
  v_kirmizi integer;
  v_kart    text;
  v_sporcu  uuid;
  v_ad      text;
  v_soyad   text;
  v_oyuncu  jsonb;
  v_adet    integer := 0;
  v_yeni    jsonb := '[]'::jsonb;
begin
  select * into mc from public.spor_maclar where id = p_mac;
  if not found then raise exception 'Maç bulunamadı'; end if;
  select * into k from public.spor_dis_kaynaklar where grup_id = mc.grup_id;
  select ad into v_grup_adi from public.spor_gruplar where id = mc.grup_id;

  if d is null or jsonb_typeof(d) <> 'object' then
    return jsonb_build_object('adet', -1);
  end if;
  v_taraf := case when p_detay -> 'match' ->> 'homeTeamId' = k.takim_id then 'home'
                  when p_detay -> 'match' ->> 'awayTeamId' = k.takim_id then 'away' end;
  if v_taraf is null then raise exception 'Maç detayında takım bulunamadı'; end if;
  if jsonb_array_length(coalesce(d -> (v_taraf || 'Lineup'), '[]'::jsonb)) = 0 then
    return jsonb_build_object('adet', -1);
  end if;

  -- Elle girilmiş kadro varsa dokunma
  if exists (select 1 from public.spor_mac_katilim where mac_id = p_mac and kaynak is distinct from 'futakademi') then
    return jsonb_build_object('adet', 0, 'atlandi', 'elle girilmiş kadro');
  end if;

  for p, v_ilk11 in
    select value, true  from jsonb_array_elements(coalesce(d -> (v_taraf || 'Lineup'), '[]'::jsonb))
    union all
    select value, false from jsonb_array_elements(coalesce(d -> (v_taraf || 'Bench'), '[]'::jsonb))
  loop
    v_tff := nullif(p ->> 'tffId', '');
    continue when v_tff is null;
    v_dk := greatest(0, least(130, coalesce((p ->> 'minutesPlayed')::integer, 0)));
    select count(*) into v_gol from jsonb_array_elements(coalesce(d -> 'goals', '[]'::jsonb)) g
     where g.value ->> 'team' = v_taraf and g.value ->> 'tffId' = v_tff
       and coalesce((g.value ->> 'ownGoal')::boolean, false) = false;
    select count(*) filter (where c.value ->> 'cardType' ~* 'yellow|sari'),
           count(*) filter (where c.value ->> 'cardType' ~* 'red|kirmizi')
      into v_sari, v_kirmizi
      from jsonb_array_elements(coalesce(d -> 'cards', '[]'::jsonb)) c
     where c.value ->> 'team' = v_taraf and c.value ->> 'tffId' = v_tff;
    v_kart := case when v_kirmizi > 0 and v_sari > 0 then 'cift_sari'
                   when v_kirmizi > 0 then 'kirmizi'
                   when v_sari >= 2 then 'cift_sari'
                   when v_sari = 1 then 'sari'
                   else 'yok' end;
    continue when v_dk = 0 and not v_ilk11 and v_gol = 0 and v_kart = 'yok';

    -- Sporcu: önce kendi grubunda, sonra kulübün başka grubunda (üst yaşta oynayan)
    select id into v_sporcu from public.spor_sporcular
     where tff_no = v_tff order by (grup_id = mc.grup_id) desc, created_at limit 1;

    if v_sporcu is null then
      v_ad := public.spor_tr_baslik(p ->> 'name');
      v_soyad := regexp_replace(v_ad, '^.* ', '');
      v_ad := nullif(btrim(left(v_ad, length(v_ad) - length(v_soyad))), '');
      v_oyuncu := null;
      if p_oyuncu_oku and coalesce(p ->> 'playerId', '') ~ '^[0-9a-f-]{36}$' then
        begin
          v_oyuncu := public.spor_fa_get('/players/' || (p ->> 'playerId'));
        exception when others then v_oyuncu := null;
        end;
      end if;
      insert into public.spor_sporcular
        (grup_id, ad, soyad, dogum_tarihi, yas_grubu, durum, aylik_aidat, tff_no, notlar)
      values
        (mc.grup_id, coalesce(v_ad, v_soyad), v_soyad,
         nullif(left(v_oyuncu ->> 'birthDate', 10), '')::date, v_grup_adi, 'aktif', 0, v_tff,
         'TFF lisans: ' || v_tff
           || coalesce(' · Doğum yeri: ' || public.spor_tr_baslik(nullif(v_oyuncu ->> 'birthPlace', '')), '')
           || ' · FutAkademi maç kadrosundan otomatik eklendi ('
           || to_char((now() at time zone 'Europe/Istanbul')::date, 'DD.MM.YYYY') || ')')
      returning id into v_sporcu;
      v_yeni := v_yeni || to_jsonb(coalesce(v_ad || ' ', '') || v_soyad);
    end if;

    insert into public.spor_mac_katilim (mac_id, sporcu_id, dakika, ilk_onbir, gol, asist, kart, kaynak)
    values (p_mac, v_sporcu, v_dk, v_ilk11, v_gol, 0, v_kart, 'futakademi')
    on conflict (mac_id, sporcu_id) do update
      set dakika = excluded.dakika, ilk_onbir = excluded.ilk_onbir, gol = excluded.gol,
          kart = excluded.kart, kaynak = 'futakademi'
      where spor_mac_katilim.kaynak = 'futakademi';
    v_adet := v_adet + 1;
  end loop;

  return jsonb_build_object('adet', v_adet, 'yeni_sporcu', v_yeni);
end;
$$;

-- --------------------------------------------------------------- 8. ajan: tüm grupları tara
-- Her grup kendi alt işleminde; biri hata verirse diğerleri sürer. Aynı anda iki çalışma olmaz.
create or replace function public.spor_futakademi_senkron(p_bugun date default null)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_bugun   date := coalesce(p_bugun, (now() at time zone 'Europe/Istanbul')::date);
  k         public.spor_dis_kaynaklar%rowtype;
  v_grup_adi text;
  v_haftalar jsonb;
  v_n       integer;
  v_hafta   jsonb;
  v_sonuc   jsonb;
  v_ozet    jsonb;
  v_skor    jsonb;
  v_hatalar jsonb;
  v_kadro   jsonb;
  v_detay   jsonb;
  v_id      jsonb;
  mc        public.spor_maclar%rowtype;
  v_genel   jsonb := '{}'::jsonb;
  v_kilit   boolean;
begin
  v_kilit := pg_try_advisory_xact_lock(hashtext('spor_futakademi_senkron'));
  if not v_kilit then
    return jsonb_build_object('atlandi', 'başka bir çalışma sürüyor');
  end if;

  for k in select * from public.spor_dis_kaynaklar where aktif and kaynak = 'futakademi' order by grup_id
  loop
    select ad into v_grup_adi from public.spor_gruplar where id = k.grup_id;
    v_ozet := jsonb_build_object('eklenen', 0, 'guncellenen', 0, 'skor', 0, 'kadro', 0, 'yeni_sporcu', '[]'::jsonb);
    v_skor := '[]'::jsonb;
    v_hatalar := '[]'::jsonb;
    begin
      -- a) fikstür ve skorlar (tüm haftalar: geç girilen sonuçlar ve ertelenen maçlar için)
      v_haftalar := public.spor_fa_get('/leagues/' || k.lig_id || '/weeks');
      if v_haftalar is null or jsonb_typeof(v_haftalar) <> 'array' or jsonb_array_length(v_haftalar) = 0 then
        raise exception 'Lig haftaları okunamadı (lig kimliği değişmiş olabilir)';
      end if;
      for v_n in select (value #>> '{}')::integer from jsonb_array_elements(v_haftalar)
      loop
        v_hafta := public.spor_fa_get('/leagues/' || k.lig_id || '/weeks/' || v_n);
        continue when v_hafta is null;
        v_sonuc := public.spor_fa_hafta_isle(k.grup_id, v_hafta, v_bugun);
        v_ozet := v_ozet || jsonb_build_object(
          'eklenen', (v_ozet ->> 'eklenen')::int + (v_sonuc ->> 'eklenen')::int,
          'guncellenen', (v_ozet ->> 'guncellenen')::int + (v_sonuc ->> 'guncellenen')::int);
        v_skor := v_skor || (v_sonuc -> 'skor');
        v_hatalar := v_hatalar || (v_sonuc -> 'hatalar');
      end loop;
      v_ozet := v_ozet || jsonb_build_object('skor', jsonb_array_length(v_skor));

      -- b) skoru belli, kadrosu boş maçlar (son 60 gün): FutAkademi detayı geç gelebilir, her turda yeniden dener
      for mc in
        select m.* from public.spor_maclar m
         where m.grup_id = k.grup_id and m.dis_kaynak = 'futakademi' and m.dis_id is not null
           and m.skor_biz is not null and m.tarih between v_bugun - 60 and v_bugun
           and not exists (select 1 from public.spor_mac_katilim x where x.mac_id = m.id)
         order by m.tarih
      loop
        begin
          v_detay := public.spor_fa_get('/leagues/matches/' || mc.dis_id || '/detay');
          continue when v_detay is null;
          v_kadro := public.spor_fa_kadro_isle(mc.id, v_detay, true);
          if (v_kadro ->> 'adet')::int > 0 then
            v_ozet := v_ozet || jsonb_build_object(
              'kadro', (v_ozet ->> 'kadro')::int + 1,
              'yeni_sporcu', (v_ozet -> 'yeni_sporcu') || coalesce(v_kadro -> 'yeni_sporcu', '[]'::jsonb));
            perform public.spor_bildirim_grup_yonetimine(
              k.grup_id, 'mac_kadro',
              v_grup_adi || ' · ' || mc.rakip || ' maçının kadrosu işlendi',
              (v_kadro ->> 'adet') || ' oyuncunun süresi, golü ve kartı FutAkademi''den aktarıldı.'
                || case when jsonb_array_length(coalesce(v_kadro -> 'yeni_sporcu', '[]'::jsonb)) > 0
                        then ' Panelde olmayan ' || jsonb_array_length(v_kadro -> 'yeni_sporcu')
                             || ' oyuncu aidatsız sporcu olarak açıldı: '
                             || (select string_agg(value #>> '{}', ', ') from jsonb_array_elements(v_kadro -> 'yeni_sporcu')) || '.'
                        else '' end,
              '/yonetim/maclar/' || mc.id, 'fa_kadro:' || mc.id);
          end if;
        exception when others then
          v_hatalar := v_hatalar || to_jsonb(mc.rakip || ' kadrosu: ' || sqlerrm);
        end;
      end loop;

      -- c) yeni skor bildirimleri
      for v_id in select value from jsonb_array_elements(v_skor)
      loop
        select * into mc from public.spor_maclar where id = (v_id #>> '{}')::uuid;
        continue when not found or mc.skor_biz is null;
        perform public.spor_bildirim_grup_yonetimine(
          k.grup_id, 'mac_sonucu',
          v_grup_adi || ' · ' || mc.rakip || ' ' || mc.skor_biz || '–' || mc.skor_rakip
            || case when mc.skor_biz > mc.skor_rakip then ' galibiyet'
                    when mc.skor_biz < mc.skor_rakip then ' mağlubiyet' else ' beraberlik' end,
          coalesce(mc.hafta || '. hafta · ', '') || case mc.yer when 'ic' then 'İç saha' else 'Deplasman' end
            || ' · Sonuç FutAkademi''den otomatik işlendi.',
          '/yonetim/maclar/' || mc.id, 'fa_skor:' || mc.id || ':' || mc.skor_biz || '-' || mc.skor_rakip);
      end loop;

      update public.spor_dis_kaynaklar
         set son_calisma = now(),
             son_durum = case when jsonb_array_length(v_hatalar) = 0 then 'tamam' else 'kısmi: ' || left(v_hatalar ->> 0, 200) end
       where grup_id = k.grup_id;
      insert into public.spor_senkron_gunlugu (grup_id, ozet, hata)
      values (k.grup_id, v_ozet || jsonb_build_object('hatalar', v_hatalar),
              case when jsonb_array_length(v_hatalar) > 0 then left(v_hatalar::text, 2000) end);
    exception when others then
      v_hatalar := v_hatalar || to_jsonb(sqlerrm);
      update public.spor_dis_kaynaklar set son_calisma = now(), son_durum = 'hata: ' || left(sqlerrm, 200)
       where grup_id = k.grup_id;
      insert into public.spor_senkron_gunlugu (grup_id, ozet, hata) values (k.grup_id, v_ozet, left(sqlerrm, 2000));
      perform public.spor_bildirim_grup_yonetimine(
        k.grup_id, 'senkron_hatasi', v_grup_adi || ' · FutAkademi aktarımı yapılamadı',
        left(sqlerrm, 300) || ' — Bir sonraki turda yeniden denenecek.',
        '/yonetim/maclar', 'fa_hata:' || k.grup_id || ':' || v_bugun);
    end;
    v_genel := v_genel || jsonb_build_object(coalesce(v_grup_adi, k.grup_id::text),
                                             v_ozet || jsonb_build_object('hatalar', v_hatalar));
  end loop;

  delete from public.spor_senkron_gunlugu where zaman < now() - interval '180 days';
  return v_genel;
end;
$$;

-- Yönetimin "şimdi güncelle" düğmesi için (kulüp geneli yetki gerekir)
create or replace function public.spor_futakademi_simdi()
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if not public.spor_kulup_geneli_mi() then
    raise exception 'Bu işlem için kulüp yönetimi yetkisi gerekir.' using errcode = '42501';
  end if;
  return public.spor_futakademi_senkron();
end;
$$;

-- --------------------------------------------------------------- 9. izinler
revoke execute on function public.spor_fa_get(text)                          from public, anon, authenticated;
revoke execute on function public.spor_fa_hafta_isle(uuid, jsonb, date)      from public, anon, authenticated;
revoke execute on function public.spor_fa_kadro_isle(uuid, jsonb, boolean)   from public, anon, authenticated;
revoke execute on function public.spor_futakademi_senkron(date)              from public, anon, authenticated;
revoke execute on function public.spor_futakademi_simdi()                    from public, anon;
grant  execute on function public.spor_futakademi_simdi()                    to authenticated;
grant  execute on function public.spor_tr_kucuk(text), public.spor_tr_buyuk(text),
                           public.spor_tr_baslik(text), public.spor_tr_sade(text) to authenticated;

-- --------------------------------------------------------------- 10. zamanlama
-- Her gün 07:10 ve 19:10 (İstanbul). FutAkademi sonuçları geç girdiği için günlük tarama.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'spor-futakademi';
    perform cron.schedule('spor-futakademi', '10 4,16 * * *',
      'set statement_timeout = ''10min''; select public.spor_futakademi_senkron()');
  end if;
exception when others then
  raise notice 'FutAkademi zamanlaması kurulamadı: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
