-- ============================================================================
-- 2026-11-04 · Gruplar (yaş grubu / takım bazlı ayrı yönetim)
--
-- Bir kulüp yaş gruplarını tek sistemde toplayabilir ya da ayırabilir:
--   · Tek grup (varsayılan) → uygulama eskisi gibi çalışır.
--   · İki ve daha fazla grup → her grubun sporcuları, aidatı, ödemeleri, KASASI,
--     ödeme bilgileri (IBAN), antrenman / maç / duyuru / sezon arşivi ayrıdır.
--
-- Roller
--   admin             Kulüp geneli. Tüm gruplar arasında geçer, grup açar, her yetkiyi verir.
--   baskan            Kulüp geneli (kulüp başkanı). Tüm gruplar arasında geçer, her grupta
--                     yönetici yetkisi vardır; grup açamaz, admin/başkan atayamaz.
--   yonetici          Grup yöneticisi — yalnızca üye olduğu grup(lar)da.
--   antrenor, yardimci_antrenor   Yalnızca üye olduğu grup(lar)da.
--   veli, sporcu      Çocuğunun / kendi kaydının grubunda.
--
-- Nasıl çalışır
--   Her kullanıcının bir "aktif grubu" vardır (spor_profiller.aktif_grup_id). Satır düzeyi
--   güvenlik kuralları (RESTRICTIVE) her sorguyu aktif gruba daraltır; uygulama kodu
--   sorgularını değiştirmeden grup içinde kalır. Grup değiştirmek: spor_grup_sec().
--   Grup üyelikleri (personel rolleri): spor_grup_uyeleri.
--   Ayarlar: kulüp geneli spor_ayarlar + gruba özel spor_grup_ayarlari (gruptaki değer önce).
--   Aidat ve ödeme kayıtları oluştuğu grubu saklar: sporcu grup değiştirse de kasa geçmişi
--   eski grubun kasasında kalır.
--
-- Mevcut veriler "Ana grup" adlı ilk gruba aktarılır; mevcut yöneticiler o grubun yöneticisi olur.
-- Admin, kulübe özgü veri betiğiyle atanır (yeni kurulumda ilk hesap admin olur).
-- Bağımlılık: 00000000 … 20261103 göçleri.  Tekrar çalıştırılabilir.
-- ============================================================================

-- ================================================================ 1. tablolar
create table if not exists public.spor_gruplar (
  id          uuid primary key default gen_random_uuid(),
  ad          text not null check (char_length(btrim(ad)) between 1 and 40),
  kod         text not null unique check (kod ~ '^[a-z0-9][a-z0-9-]{0,23}$'),
  aciklama    text check (char_length(aciklama) <= 200),
  sira        integer not null default 0,
  kayit_acik  boolean not null default true,   -- velinin kayıtta seçebileceği gruplar
  aktif       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.spor_grup_uyeleri (
  grup_id      uuid not null references public.spor_gruplar (id) on delete cascade,
  kullanici_id uuid not null references auth.users (id) on delete cascade,
  rol          text not null check (rol in ('yonetici', 'antrenor', 'yardimci_antrenor')),
  ekleyen_id   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (grup_id, kullanici_id)
);
create index if not exists spor_grup_uyeleri_kullanici_idx on public.spor_grup_uyeleri (kullanici_id);

create table if not exists public.spor_grup_ayarlari (
  grup_id     uuid not null references public.spor_gruplar (id) on delete cascade,
  anahtar     text not null,
  deger       text,
  guncellendi timestamptz not null default now(),
  primary key (grup_id, anahtar)
);

-- İlk grup (veri aktarımı için)
insert into public.spor_gruplar (ad, kod, sira)
select 'Ana grup', 'ana', 1
 where not exists (select 1 from public.spor_gruplar);

-- ================================================================ 2. alanlar
alter table public.spor_profiller add column if not exists aktif_grup_id uuid
  references public.spor_gruplar (id) on delete set null;

alter table public.spor_profiller drop constraint if exists spor_profiller_rol_check;
alter table public.spor_profiller add constraint spor_profiller_rol_check check (rol in (
  'veli', 'sporcu', 'antrenor', 'yardimci_antrenor', 'baskan', 'yonetici', 'admin'));

alter table public.spor_rol_talepleri add column if not exists grup_id uuid
  references public.spor_gruplar (id) on delete cascade;

do $$
declare
  t text;
  v_ilk uuid := (select id from public.spor_gruplar order by sira, created_at limit 1);
begin
  foreach t in array array[
    'spor_sporcular', 'spor_antrenmanlar', 'spor_maclar', 'spor_kasa_hareketleri',
    'spor_duyurular', 'spor_aidatlar', 'spor_odemeler',
    'spor_sezonlar', 'spor_sezon_anilari', 'spor_yukselenler']
  loop
    execute format('alter table public.%I add column if not exists grup_id uuid references public.spor_gruplar (id)', t);
    execute format('update public.%I set grup_id = $1 where grup_id is null', t) using v_ilk;
    execute format('alter table public.%I alter column grup_id set not null', t);
    execute format('create index if not exists %I on public.%I (grup_id)', t || '_grup_idx', t);
  end loop;
end $$;

-- Sezonlar artık grup başına: birincil anahtar (grup_id, yil)
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'spor_sezonlar_pkey'
              and conrelid = 'public.spor_sezonlar'::regclass
              and array_length(conkey, 1) = 1) then
    alter table public.spor_sezonlar drop constraint spor_sezonlar_pkey;
    alter table public.spor_sezonlar add constraint spor_sezonlar_pkey primary key (grup_id, yil);
  end if;
end $$;

-- ======================================================== 3. temel yardımcılar
create or replace function public.spor_grup_sayisi()
returns integer
language sql stable security definer set search_path = public
as $$ select count(*)::integer from public.spor_gruplar $$;

create or replace function public.spor_admin_mi()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.spor_profiller where id = auth.uid() and rol = 'admin') $$;

-- Kulüp geneli yetki: admin ya da kulüp başkanı (tüm gruplar arasında geçer)
create or replace function public.spor_kulup_geneli_mi()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.spor_profiller where id = auth.uid() and rol in ('admin', 'baskan')) $$;

-- Kullanıcı bu gruba girebilir mi?
create or replace function public.spor_grup_erisimi(p_grup uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_grup is not null
     and exists (select 1 from public.spor_gruplar where id = p_grup)
     and (
       public.spor_kulup_geneli_mi()
       or public.spor_grup_sayisi() <= 1
       or exists (select 1 from public.spor_grup_uyeleri
                   where kullanici_id = auth.uid() and grup_id = p_grup)
       or exists (select 1 from public.spor_sporcular
                   where grup_id = p_grup
                     and (veli_id = auth.uid() or sporcu_kullanici_id = auth.uid()))
       -- Henüz çocuğu ve görevi olmayan yeni hesap: kayıtta seçtiği (kaydı açık) grup
       or (exists (select 1 from public.spor_profiller p join public.spor_gruplar g on g.id = p.aktif_grup_id
                    where p.id = auth.uid() and p.aktif_grup_id = p_grup and g.kayit_acik and g.aktif)
           and not exists (select 1 from public.spor_sporcular
                            where veli_id = auth.uid() or sporcu_kullanici_id = auth.uid())
           and not exists (select 1 from public.spor_grup_uyeleri where kullanici_id = auth.uid()))
     )
$$;

-- Aktif grup: kullanıcının seçtiği grup (erişimi varsa), yoksa erişebildiği ilk grup.
-- Oturumsuz (sistem / zamanlanmış iş) çağrıda ilk grup döner; sistem işleri grubu
-- her zaman açıkça verir, bu dönüş yalnızca sütun varsayılanıdır.
create or replace function public.spor_aktif_grup()
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_secili uuid;
  v_grup   uuid;
begin
  if v_uid is null then
    return (select id from public.spor_gruplar order by sira, created_at limit 1);
  end if;
  select aktif_grup_id into v_secili from public.spor_profiller where id = v_uid;
  if v_secili is not null and public.spor_grup_erisimi(v_secili) then
    return v_secili;
  end if;
  select g.id into v_grup
    from public.spor_gruplar g
   where public.spor_grup_erisimi(g.id)
   order by (not g.aktif), g.sira, g.created_at
   limit 1;
  return v_grup;
end;
$$;

-- Bir kullanıcının bir gruptaki rolü
create or replace function public.spor_kullanici_rolu(p_kullanici uuid, p_grup uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_temel text;
  v_uye   text;
begin
  select rol into v_temel from public.spor_profiller where id = p_kullanici;
  if v_temel is null then return null; end if;
  if v_temel in ('admin', 'baskan') then return v_temel; end if;
  select rol into v_uye from public.spor_grup_uyeleri
   where kullanici_id = p_kullanici and grup_id = p_grup;
  if v_uye is not null then return v_uye; end if;
  if v_temel in ('yonetici', 'antrenor', 'yardimci_antrenor') then
    -- Tek gruplu kulüpte profil rolü geçerlidir (eski kurulumlarla uyum)
    if public.spor_grup_sayisi() <= 1 then return v_temel; end if;
    return 'veli';
  end if;
  return v_temel;
end;
$$;

-- Oturumdaki kişinin aktif gruptaki rolü
create or replace function public.spor_rol()
returns text
language sql stable security definer set search_path = public
as $$ select public.spor_kullanici_rolu(auth.uid(), public.spor_aktif_grup()) $$;

-- Mevcut rol kapıları artık aktif gruba göre (tüm eski kurallar bunları kullanır)
create or replace function public.spor_yonetici_mi()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.spor_rol() in ('admin', 'baskan', 'yonetici'), false) $$;

create or replace function public.spor_personel_mi()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.spor_rol() in ('admin', 'baskan', 'yonetici', 'antrenor', 'yardimci_antrenor'), false) $$;

create or replace function public.spor_antrenor_mi()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.spor_rol() in ('antrenor', 'yardimci_antrenor'), false) $$;

create or replace function public.spor_sporcu_grubu(p_sporcu uuid)
returns uuid
language sql stable security definer set search_path = public
as $$ select grup_id from public.spor_sporcular where id = p_sporcu $$;

-- Sporcuya bağlı kayıtlar: okuma → aktif grup ya da kendi çocuğu
create or replace function public.spor_sporcu_kapsamda(p_sporcu uuid, p_grup uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(p_grup, public.spor_sporcu_grubu(p_sporcu)) = public.spor_aktif_grup()
      or public.spor_sporcu_gorebilir_mi(p_sporcu)
$$;

-- Sporcuya bağlı kayıtlar: yazma → aktif grup; veli kendi çocuğu için her gruptan
-- (personel ise kendi çocuğunun grubuna geçmesi gerekir)
create or replace function public.spor_sporcu_yazilabilir(p_sporcu uuid, p_grup uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(p_grup, public.spor_sporcu_grubu(p_sporcu)) = public.spor_aktif_grup()
      or (public.spor_sporcu_gorebilir_mi(p_sporcu) and not public.spor_personel_mi())
$$;

-- Para ekranları (kasa, aidat akışı, ödemeyenler): grubun yönetimi (admin, başkan,
-- grup yöneticisi) ve grupta kaydı ONAYLANMIŞ (aktif) çocuğu olan veli.
-- Antrenör, yardımcı antrenör ve sporcu hesapları görmez.
create or replace function public.spor_kasa_gorebilir_mi()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.spor_yonetici_mi()
      or (public.spor_rol() = 'veli'
          and exists (select 1 from public.spor_sporcular
                       where veli_id = auth.uid() and durum = 'aktif'
                         and grup_id = public.spor_aktif_grup()))
$$;

-- Grup yöneticisi hangi profilleri görür: kendi grubunun personeli, velileri, sporcuları,
-- gruba yetki talebi yapanlar ve gruba yeni kaydolanlar.
create or replace function public.spor_profil_gorunur_mu(p_kullanici uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_grup uuid;
begin
  if p_kullanici = auth.uid() or public.spor_kulup_geneli_mi() then return true; end if;
  if not public.spor_yonetici_mi() then return false; end if;
  if public.spor_grup_sayisi() <= 1 then return true; end if;
  v_grup := public.spor_aktif_grup();
  return exists (select 1 from public.spor_grup_uyeleri where kullanici_id = p_kullanici and grup_id = v_grup)
      or exists (select 1 from public.spor_sporcular
                  where grup_id = v_grup and (veli_id = p_kullanici or sporcu_kullanici_id = p_kullanici))
      or exists (select 1 from public.spor_rol_talepleri
                  where kullanici_id = p_kullanici and grup_id = v_grup and durum = 'beklemede')
      or (exists (select 1 from public.spor_profiller where id = p_kullanici and aktif_grup_id = v_grup and rol in ('veli', 'sporcu'))
          and not exists (select 1 from public.spor_sporcular where veli_id = p_kullanici or sporcu_kullanici_id = p_kullanici)
          and not exists (select 1 from public.spor_grup_uyeleri where kullanici_id = p_kullanici));
end;
$$;

-- ================================================================ 4. ayarlar
-- Gruba özel anahtarlar; diğerleri (kulüp adı, sessiz saat) kulüp genelidir.
create or replace function public.spor_grup_anahtari_mi(p_anahtar text)
returns boolean
language sql immutable set search_path = public
as $$
  select p_anahtar = any (array[
    'banka_adi', 'hesap_sahibi', 'iban', 'odeme_aciklamasi', 'iletisim_telefon', 'iletisim_eposta',
    'kardes_indirimi', 'kist_hesap', 'son_odeme_gunu', 'otomatik_tahakkuk',
    'hatirlatma', 'bildirim_gelmedi', 'hatirlatma_once', 'hatirlatma_gecikme'])
$$;

create or replace function public.spor_grup_ayar(p_grup uuid, p_anahtar text, p_varsayilan text default null)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    nullif(trim((select deger from public.spor_grup_ayarlari where grup_id = p_grup and anahtar = p_anahtar)), ''),
    nullif(trim((select deger from public.spor_ayarlar where anahtar = p_anahtar)), ''),
    p_varsayilan)
$$;

create or replace function public.spor_grup_ayar_sayi(p_grup uuid, p_anahtar text, p_varsayilan numeric default 0)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v text := public.spor_grup_ayar(p_grup, p_anahtar);
begin
  if v is null then return p_varsayilan; end if;
  return replace(v, ',', '.')::numeric;
exception when others then
  return p_varsayilan;
end;
$$;

-- Eski imzalar aktif grubu kullanır
create or replace function public.spor_ayar(p_anahtar text, p_varsayilan text default null)
returns text
language sql stable security definer set search_path = public
as $$ select public.spor_grup_ayar(public.spor_aktif_grup(), p_anahtar, p_varsayilan) $$;

create or replace function public.spor_ayar_sayi(p_anahtar text, p_varsayilan numeric default 0)
returns numeric
language sql stable security definer set search_path = public
as $$ select public.spor_grup_ayar_sayi(public.spor_aktif_grup(), p_anahtar, p_varsayilan) $$;

create or replace function public.spor_grup_son_odeme(p_donem date, p_grup uuid)
returns date
language sql stable security definer set search_path = public
as $$
  select (date_trunc('month', p_donem)::date
          + (greatest(1, least(28, public.spor_grup_ayar_sayi(p_grup, 'son_odeme_gunu', 10)::integer)) - 1))
$$;

create or replace function public.spor_son_odeme(p_donem date)
returns date
language sql stable security definer set search_path = public
as $$ select public.spor_grup_son_odeme(p_donem, public.spor_aktif_grup()) $$;

-- Ekran için: aktif grubun birleştirilmiş ayarları (gruptaki değer kulüptekini ezer)
create or replace function public.spor_ayarlari()
returns table (anahtar text, deger text, grup_ozel boolean)
language sql stable security definer set search_path = public
as $$
  with g as (select public.spor_aktif_grup() as id)
  select ga.anahtar, ga.deger, true
    from public.spor_grup_ayarlari ga, g
   where ga.grup_id = g.id and nullif(trim(ga.deger), '') is not null
  union all
  select a.anahtar, a.deger, false
    from public.spor_ayarlar a, g
   where auth.uid() is not null
     and not exists (select 1 from public.spor_grup_ayarlari ga
                      where ga.grup_id = g.id and ga.anahtar = a.anahtar
                        and nullif(trim(ga.deger), '') is not null)
$$;

create or replace function public.spor_ayar_kaydet(p_ayarlar jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_grup uuid := public.spor_aktif_grup();
  r      record;
  v_adet integer := 0;
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Ayarları kulüp yönetimi değiştirir.';
  end if;
  for r in select key, value from jsonb_each_text(coalesce(p_ayarlar, '{}'::jsonb)) loop
    if r.key !~ '^[a-z_]{2,40}$' or r.key = 'son_otomatik_tahakkuk' then
      continue;
    end if;
    if public.spor_grup_anahtari_mi(r.key) then
      insert into public.spor_grup_ayarlari (grup_id, anahtar, deger, guncellendi)
      values (v_grup, r.key, left(trim(r.value), 500), now())
      on conflict (grup_id, anahtar) do update set deger = excluded.deger, guncellendi = now();
    elsif public.spor_kulup_geneli_mi() or public.spor_grup_sayisi() <= 1 then
      insert into public.spor_ayarlar (anahtar, deger, guncellendi)
      values (r.key, left(trim(r.value), 500), now())
      on conflict (anahtar) do update set deger = excluded.deger, guncellendi = now();
    else
      continue;  -- grup yöneticisi kulüp geneli ayarı değiştiremez
    end if;
    v_adet := v_adet + 1;
  end loop;
  return v_adet;
end;
$$;

-- ======================================================== 5. tetikleyiciler
-- Aidat ve ödeme oluştuğu grubu saklar (kasa geçmişi sporcu grup değiştirse de korunur)
create or replace function public.spor_kayit_grubu_ata()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.grup_id := old.grup_id;
    return new;
  end if;
  if tg_table_name = 'spor_odemeler' then
    new.grup_id := null;
    if new.aidat_id is not null then
      select grup_id into new.grup_id from public.spor_aidatlar where id = new.aidat_id;
    end if;
  else
    new.grup_id := null;
  end if;
  if new.grup_id is null then
    new.grup_id := coalesce(public.spor_sporcu_grubu(new.sporcu_id),
                            (select id from public.spor_gruplar order by sira, created_at limit 1));
  end if;
  return new;
end;
$$;

drop trigger if exists spor_aidat_grup_trg on public.spor_aidatlar;
create trigger spor_aidat_grup_trg before insert or update on public.spor_aidatlar
  for each row execute function public.spor_kayit_grubu_ata();
drop trigger if exists spor_odeme_grup_trg on public.spor_odemeler;
create trigger spor_odeme_grup_trg before insert or update on public.spor_odemeler
  for each row execute function public.spor_kayit_grubu_ata();

-- İkinci grup açılınca: tek gruplu dönemde profil rolüyle çalışan personel ilk grubun
-- üyesi yapılır; yetkisini kaybetmez, yeni gruba otomatik girmez.
create or replace function public.spor_grup_eklendi()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_ilk uuid;
begin
  if (select count(*) from public.spor_gruplar) = 2 then
    select id into v_ilk from public.spor_gruplar where id <> new.id order by sira, created_at limit 1;
    insert into public.spor_grup_uyeleri (grup_id, kullanici_id, rol)
    select v_ilk, p.id, p.rol from public.spor_profiller p
     where p.rol in ('yonetici', 'antrenor', 'yardimci_antrenor')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists spor_grup_eklendi_trg on public.spor_gruplar;
create trigger spor_grup_eklendi_trg after insert on public.spor_gruplar
  for each row execute function public.spor_grup_eklendi();

-- Rol ve aktif grup koruması (profil satırını kişi kendisi güncelleyebilir)
create or replace function public.spor_profil_rol_koru()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.spor_admin_mi() and new.rol is distinct from 'sporcu' then
      new.rol := 'veli';
    end if;
    return new;
  end if;

  if new.rol is distinct from old.rol then
    if public.spor_admin_mi() then
      null;
    elsif (public.spor_kulup_geneli_mi() or (public.spor_grup_sayisi() <= 1 and public.spor_yonetici_mi()))
          and new.id <> auth.uid()
          and old.rol not in ('admin', 'baskan') and new.rol not in ('admin', 'baskan') then
      null;
    else
      new.rol := old.rol;
    end if;
  end if;

  if new.aktif_grup_id is distinct from old.aktif_grup_id and new.aktif_grup_id is not null then
    if not (public.spor_grup_erisimi(new.aktif_grup_id)
            or exists (select 1 from public.spor_gruplar g
                        where g.id = new.aktif_grup_id and g.kayit_acik and g.aktif)) then
      new.aktif_grup_id := old.aktif_grup_id;
    end if;
  end if;
  return new;
end;
$$;

-- ================================================ 6. sütun varsayılanları
do $$
declare t text;
begin
  foreach t in array array[
    'spor_sporcular', 'spor_antrenmanlar', 'spor_maclar', 'spor_kasa_hareketleri',
    'spor_duyurular', 'spor_sezonlar', 'spor_sezon_anilari', 'spor_yukselenler']
  loop
    execute format('alter table public.%I alter column grup_id set default public.spor_aktif_grup()', t);
  end loop;
end $$;

-- ===================================================== 7. hesap ve profil
create or replace function public.spor_handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_rol    text := 'veli';
  v_istek  text := nullif(new.raw_user_meta_data->>'talep_rol', '');
  v_kod    text := lower(nullif(trim(new.raw_user_meta_data->>'grup'), ''));
  v_grup   uuid;
begin
  if not public.spor_kaydi_mi(new.raw_user_meta_data) then
    return new;
  end if;

  if not exists (select 1 from public.spor_profiller where rol in ('admin', 'yonetici', 'baskan')) then
    v_rol := 'admin';
  elsif v_istek = 'sporcu' then
    v_rol := 'sporcu';
  end if;

  if v_kod is not null then
    select id into v_grup from public.spor_gruplar
     where (kod = v_kod or id::text = v_kod) and kayit_acik and aktif;
  end if;

  insert into public.spor_profiller (id, eposta, ad_soyad, telefon, rol, aktif_grup_id)
  values (
    new.id, new.email,
    nullif(new.raw_user_meta_data->>'ad_soyad', ''),
    nullif(new.raw_user_meta_data->>'telefon', ''),
    v_rol, v_grup
  )
  on conflict (id) do nothing;

  if v_rol = 'veli' and v_istek in ('antrenor', 'yardimci_antrenor', 'baskan') then
    insert into public.spor_rol_talepleri (kullanici_id, talep_rol, grup_id)
    values (new.id, v_istek,
            case when v_istek = 'baskan' then null
                 else coalesce(v_grup, (select id from public.spor_gruplar order by sira, created_at limit 1)) end);
  end if;

  update public.spor_sporcular set veli_id = new.id
   where veli_id is null and lower(veli_eposta) = lower(new.email);
  update public.spor_sporcular set sporcu_kullanici_id = new.id
   where sporcu_kullanici_id is null and lower(sporcu_eposta) = lower(new.email);

  return new;
end;
$$;

-- Profil: rol alanı aktif gruptaki rolü, aktif_grup_id seçili grubu döner
create or replace function public.spor_profil()
returns public.spor_profiller
language plpgsql security definer set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_kayit public.spor_profiller;
  v_mail  text;
begin
  if v_uid is null then raise exception 'Oturum bulunamadı.'; end if;

  select email into v_mail from auth.users where id = v_uid;

  select * into v_kayit from public.spor_profiller where id = v_uid;
  if not found then
    insert into public.spor_profiller (id, eposta, rol)
    values (v_uid, v_mail,
            case when not exists (select 1 from public.spor_profiller
                                   where rol in ('admin', 'yonetici', 'baskan'))
                 then 'admin' else 'veli' end)
    on conflict (id) do nothing
    returning * into v_kayit;
    if v_kayit.id is null then
      select * into v_kayit from public.spor_profiller where id = v_uid;
    end if;
  end if;

  update public.spor_sporcular set veli_id = v_uid
   where veli_id is null and lower(veli_eposta) = lower(coalesce(v_mail, ''));
  update public.spor_sporcular set sporcu_kullanici_id = v_uid
   where sporcu_kullanici_id is null and lower(sporcu_eposta) = lower(coalesce(v_mail, ''));

  v_kayit.aktif_grup_id := public.spor_aktif_grup();
  v_kayit.rol := coalesce(public.spor_kullanici_rolu(v_uid, v_kayit.aktif_grup_id), v_kayit.rol);
  return v_kayit;
end;
$$;

-- ============================================================ 8. grup işlemleri
-- Erişilebilen gruplar ve her birindeki rol (grup seçici için)
create or replace function public.spor_gruplarim()
returns table (id uuid, ad text, kod text, sira integer, aktif boolean, kayit_acik boolean,
               secili boolean, rol text)
language sql stable security definer set search_path = public
as $$
  with s as (select public.spor_aktif_grup() as g)
  select g.id, g.ad, g.kod, g.sira, g.aktif, g.kayit_acik, g.id = s.g,
         public.spor_kullanici_rolu(auth.uid(), g.id)
    from public.spor_gruplar g, s
   where auth.uid() is not null and public.spor_grup_erisimi(g.id)
   order by g.sira, g.created_at
$$;

create or replace function public.spor_grup_sec(p_grup uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  if not public.spor_grup_erisimi(p_grup) then
    raise exception 'Bu gruba erişim yetkiniz yok.';
  end if;
  update public.spor_profiller set aktif_grup_id = p_grup where id = auth.uid();
  return p_grup;
end;
$$;

-- Velinin çocuk kaydederken seçebileceği gruplar
create or replace function public.spor_kayit_gruplari()
returns table (id uuid, ad text, kod text, aciklama text)
language sql stable security definer set search_path = public
as $$
  select g.id, g.ad, g.kod, g.aciklama
    from public.spor_gruplar g
   where auth.uid() is not null and g.aktif and g.kayit_acik
   order by g.sira, g.created_at
$$;

-- Aktif gruptaki kişiler ve rolleri (Ayarlar → Kullanıcılar ve yetkiler)
create or replace function public.spor_grup_kullanicilari()
returns table (id uuid, eposta text, ad_soyad text, temel_rol text, rol text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.eposta, p.ad_soyad, p.rol,
         public.spor_kullanici_rolu(p.id, public.spor_aktif_grup()), p.created_at
    from public.spor_profiller p
   where public.spor_yonetici_mi() and public.spor_profil_gorunur_mu(p.id)
   order by p.created_at desc
   limit 500
$$;

-- Yetki verme: admin/başkan yalnızca admin verir; grup rolleri aktif grupta geçerli
create or replace function public.spor_yetki_ver(p_kullanici uuid, p_rol text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_temel text;
  v_grup  uuid := public.spor_aktif_grup();
begin
  if p_kullanici = auth.uid() then
    raise exception 'Kendi yetkinizi değiştiremezsiniz.';
  end if;
  select rol into v_temel from public.spor_profiller where id = p_kullanici;
  if v_temel is null then raise exception 'Kullanıcı bulunamadı.'; end if;

  if p_rol in ('admin', 'baskan') then
    if not public.spor_admin_mi() then
      raise exception 'Admin ve kulüp başkanı yetkisini yalnızca admin verir.';
    end if;
    update public.spor_profiller set rol = p_rol where id = p_kullanici;
    return;
  end if;

  -- Pozisyonları admin ve kulüp başkanı belirler (tek gruplu eski kurulumda yönetici de)
  if not (public.spor_kulup_geneli_mi()
          or (public.spor_grup_sayisi() <= 1 and public.spor_yonetici_mi())) then
    raise exception 'Pozisyonları admin ya da kulüp başkanı belirler.';
  end if;
  if v_temel in ('admin', 'baskan') and not public.spor_admin_mi() then
    raise exception 'Kulüp geneli yetkiyi yalnızca admin değiştirir.';
  end if;

  if p_rol in ('yonetici', 'antrenor', 'yardimci_antrenor') then
    insert into public.spor_grup_uyeleri (grup_id, kullanici_id, rol, ekleyen_id)
    values (v_grup, p_kullanici, p_rol, auth.uid())
    on conflict (grup_id, kullanici_id) do update set rol = excluded.rol, ekleyen_id = excluded.ekleyen_id;
    if v_temel not in ('veli', 'sporcu') then
      update public.spor_profiller set rol = 'veli' where id = p_kullanici;
    end if;
  elsif p_rol in ('veli', 'sporcu') then
    delete from public.spor_grup_uyeleri where grup_id = v_grup and kullanici_id = p_kullanici;
    update public.spor_profiller set rol = p_rol where id = p_kullanici and rol is distinct from p_rol;
  else
    raise exception 'Geçersiz rol: %', p_rol;
  end if;
end;
$$;

create or replace function public.spor_rol_talebi_karar(p_talep uuid, p_onay boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  t public.spor_rol_talepleri%rowtype;
  v_grup uuid;
begin
  select * into t from public.spor_rol_talepleri where id = p_talep and durum = 'beklemede';
  if not found then raise exception 'Talep bulunamadı ya da sonuçlanmış.'; end if;
  if not (public.spor_kulup_geneli_mi()
          or (public.spor_grup_sayisi() <= 1 and public.spor_yonetici_mi())) then
    raise exception 'Yetki taleplerini admin ya da kulüp başkanı sonuçlandırır.';
  end if;
  if t.talep_rol = 'baskan' and not public.spor_admin_mi() then
    raise exception 'Kulüp başkanı talebini yalnızca admin onaylar.';
  end if;
  v_grup := coalesce(t.grup_id, public.spor_aktif_grup());
  if v_grup <> public.spor_aktif_grup() and not public.spor_kulup_geneli_mi() then
    raise exception 'Bu talep başka bir gruba ait.';
  end if;

  update public.spor_rol_talepleri
     set durum = case when p_onay then 'onaylandi' else 'reddedildi' end,
         karar_veren = auth.uid(), karar_tarihi = now()
   where id = p_talep;

  if p_onay then
    if t.talep_rol = 'baskan' then
      update public.spor_profiller set rol = 'baskan' where id = t.kullanici_id;
    else
      insert into public.spor_grup_uyeleri (grup_id, kullanici_id, rol, ekleyen_id)
      values (v_grup, t.kullanici_id, t.talep_rol, auth.uid())
      on conflict (grup_id, kullanici_id) do update set rol = excluded.rol;
    end if;
  end if;
end;
$$;

-- Sporcuyu başka gruba taşı (ör. sezon sonunda U13 → U14). Yalnızca kulüp geneli.
-- Geçmiş aidat ve ödemeler eski grubun kasasında kalır.
create or replace function public.spor_sporcu_grup_degistir(p_sporcu uuid, p_grup uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.spor_kulup_geneli_mi() then
    raise exception 'Sporcuyu başka gruba admin ya da kulüp başkanı taşır.';
  end if;
  if not exists (select 1 from public.spor_gruplar where id = p_grup) then
    raise exception 'Grup bulunamadı.';
  end if;
  update public.spor_sporcular set grup_id = p_grup where id = p_sporcu;
  if not found then raise exception 'Sporcu bulunamadı.'; end if;
end;
$$;

-- ======================================================= 9. aidat ve kasa
create or replace function public.spor_aidat_akisi(p_donem date)
returns table (aidat_id uuid, ad text, soyad text, yas_grubu text, tutar numeric, durum text,
               son_odeme_tarihi date, benim boolean)
language sql stable security definer set search_path = public
as $$
  select a.id, public.spor_maskele(s.ad, 'ad'), public.spor_maskele(s.soyad, 'soyad'),
         s.yas_grubu, a.tutar, a.durum, a.son_odeme_tarihi, (s.veli_id = auth.uid())
    from public.spor_aidatlar a
    join public.spor_sporcular s on s.id = a.sporcu_id
   where public.spor_kasa_gorebilir_mi()
     and a.grup_id = public.spor_aktif_grup()
     and a.donem = date_trunc('month', p_donem)::date
   order by s.yas_grubu nulls last, s.ad, s.soyad;
$$;

create or replace function public.spor_aidat_donemleri()
returns table (donem date, sporcu_sayisi integer, toplam numeric, odenen numeric, bekleyen numeric,
               odeyen_sayisi integer)
language sql stable security definer set search_path = public
as $$
  select a.donem, count(*)::integer, coalesce(sum(a.tutar), 0),
         coalesce(sum(a.tutar) filter (where a.durum = 'odendi'), 0),
         coalesce(sum(a.tutar) filter (where a.durum = 'bekliyor'), 0),
         count(*) filter (where a.durum = 'odendi')::integer
    from public.spor_aidatlar a
   where public.spor_kasa_gorebilir_mi()
     and a.grup_id = public.spor_aktif_grup()
   group by a.donem
   order by a.donem desc;
$$;

create or replace function public.spor_odemeyenler(p_donem date default null)
returns table (donem date, ad text, soyad text, yas_grubu text, tutar numeric, son_odeme_tarihi date,
               gecikti boolean, benim boolean)
language sql stable security definer set search_path = public
as $$
  select a.donem, public.spor_maskele(s.ad, 'ad'), public.spor_maskele(s.soyad, 'soyad'),
         s.yas_grubu, a.tutar, a.son_odeme_tarihi,
         (a.son_odeme_tarihi is not null and a.son_odeme_tarihi < current_date),
         (s.veli_id = auth.uid())
    from public.spor_aidatlar a
    join public.spor_sporcular s on s.id = a.sporcu_id
   where a.durum = 'bekliyor'
     and (p_donem is null or a.donem = date_trunc('month', p_donem)::date)
     and public.spor_kasa_gorebilir_mi()
     and a.grup_id = public.spor_aktif_grup()
   order by a.donem desc, s.yas_grubu nulls last, s.ad;
$$;

-- 20261107 dönüş tipine açılış sütunu ekler; tekrar çalıştırmada çakışmasın diye önce düşürülür
drop function if exists public.spor_kasa_ozeti();
create function public.spor_kasa_ozeti()
returns table (ay date, tahsilat numeric, ek_gelir numeric, aktarim numeric, gider numeric)
language sql stable security definer set search_path = public
as $$
  with izin as (
    select public.spor_aktif_grup() as grup where public.spor_kasa_gorebilir_mi()
  ),
  odemeler as (
    select date_trunc('month', o.odeme_tarihi)::date as ay, sum(o.tutar) as tutar
      from public.spor_odemeler o, izin
     where o.durum = 'onaylandi' and o.grup_id = izin.grup
     group by 1
  ),
  hareketler as (
    select date_trunc('month', k.tarih)::date as ay,
           sum(k.tutar) filter (where k.tur = 'gelir')   as ek_gelir,
           sum(k.tutar) filter (where k.tur = 'aktarim') as aktarim,
           sum(k.tutar) filter (where k.tur = 'gider')   as gider
      from public.spor_kasa_hareketleri k, izin
     where k.grup_id = izin.grup
     group by 1
  )
  select coalesce(o.ay, h.ay), coalesce(o.tutar, 0), coalesce(h.ek_gelir, 0),
         coalesce(h.aktarim, 0), coalesce(h.gider, 0)
    from odemeler o
    full outer join hareketler h on h.ay = o.ay
   order by 1 desc;
$$;

-- Aidat hesabı: grubun kuralları (kardeş indirimi aynı gruptaki kardeşlere)
create or replace function public.spor_aidat_hesapla(p_sporcu uuid, p_donem date, p_baslangic date default null)
returns table (tutar numeric, aciklama text)
language plpgsql stable security definer set search_path = public
as $$
declare
  s         public.spor_sporcular%rowtype;
  v_ay      date := date_trunc('month', p_donem)::date;
  v_ay_son  date := (date_trunc('month', p_donem) + interval '1 month - 1 day')::date;
  v_oran    numeric := 0;
  v_neden   text[] := '{}';
  v_kardes  numeric;
  v_once    integer;
  v_tutar   numeric;
  v_bas     date;
  v_gun     integer;
  v_kalan   integer;
begin
  select * into s from public.spor_sporcular where id = p_sporcu;
  if not found or coalesce(s.aylik_aidat, 0) <= 0 then
    return;
  end if;

  if s.dondurma_bas is not null and s.dondurma_bas <= v_ay
     and (s.dondurma_bit is null or s.dondurma_bit >= v_ay_son) then
    return;
  end if;

  if s.indirim_orani > 0 then
    v_oran := s.indirim_orani;
    v_neden := array[coalesce(nullif(trim(s.indirim_nedeni), ''), 'İndirim')
                     || ' %' || trim(to_char(s.indirim_orani, 'FM990.##'))];
  end if;

  v_kardes := least(100, greatest(0, public.spor_grup_ayar_sayi(s.grup_id, 'kardes_indirimi', 0)));
  if v_kardes > v_oran and s.veli_id is not null then
    select count(*) into v_once
      from public.spor_sporcular k
     where k.veli_id = s.veli_id
       and k.grup_id = s.grup_id
       and k.id <> s.id
       and k.durum = 'aktif'
       and k.aylik_aidat > 0
       and (k.kayit_tarihi, k.id) < (s.kayit_tarihi, s.id);
    if v_once >= 1 then
      v_oran := v_kardes;
      v_neden := array['Kardeş indirimi %' || trim(to_char(v_kardes, 'FM990.##'))];
    end if;
  end if;

  v_tutar := round(s.aylik_aidat * (1 - v_oran / 100), 2);

  v_bas := coalesce(p_baslangic, s.kayit_tarihi);
  if public.spor_grup_ayar(s.grup_id, 'kist_hesap', 'kapali') = 'acik'
     and v_tutar > 0 and v_bas > v_ay and v_bas <= v_ay_son then
    v_gun := extract(day from v_ay_son)::integer;
    v_kalan := (v_ay_son - v_bas) + 1;
    v_tutar := ceil(v_tutar * v_kalan / v_gun);
    v_neden := v_neden || ('Kıst ' || v_kalan || '/' || v_gun || ' gün');
  end if;

  tutar := v_tutar;
  aciklama := nullif(array_to_string(v_neden, ' · '), '');
  return next;
end;
$$;

create or replace function public.spor_donem_olustur(p_donem date, p_son_odeme date default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_ay   date := date_trunc('month', p_donem)::date;
  v_grup uuid := public.spor_aktif_grup();
  v_adet integer;
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Bu işlem için yönetici yetkisi gerekir.';
  end if;

  insert into public.spor_aidatlar (sporcu_id, donem, tutar, son_odeme_tarihi, durum, aciklama)
  select s.id, v_ay, h.tutar, coalesce(p_son_odeme, public.spor_grup_son_odeme(v_ay, s.grup_id)),
         case when h.tutar = 0 then 'muaf' else 'bekliyor' end, h.aciklama
    from public.spor_sporcular s
    cross join lateral public.spor_aidat_hesapla(s.id, v_ay) h
   where s.durum = 'aktif' and s.aylik_aidat > 0 and s.grup_id = v_grup
  on conflict (sporcu_id, donem) do nothing;

  get diagnostics v_adet = row_count;
  return v_adet;
end;
$$;

create or replace function public.spor_eksik_tahakkuk(p_donem date)
returns table (sporcu_id uuid, ad text, soyad text, yas_grubu text, aylik_aidat numeric)
language sql stable security definer set search_path = public
as $$
  select s.id, s.ad, s.soyad, s.yas_grubu, h.tutar
    from public.spor_sporcular s
    cross join lateral public.spor_aidat_hesapla(s.id, p_donem) h
   where public.spor_yonetici_mi()
     and s.grup_id = public.spor_aktif_grup()
     and s.durum = 'aktif' and s.aylik_aidat > 0
     and not exists (select 1 from public.spor_aidatlar a
                      where a.sporcu_id = s.id and a.donem = date_trunc('month', p_donem)::date)
   order by s.ad, s.soyad;
$$;

create or replace function public.spor_sporcu_aktif_tahakkuk()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_ay    date := date_trunc('month', (now() at time zone 'Europe/Istanbul'))::date;
  h       record;
begin
  if new.durum = 'aktif'
     and coalesce(new.aylik_aidat, 0) > 0
     and (tg_op = 'INSERT' or old.durum is distinct from 'aktif' or coalesce(old.aylik_aidat, 0) = 0)
  then
    select * into h from public.spor_aidat_hesapla(new.id, v_ay, greatest(new.kayit_tarihi, v_bugun));
    if found then
      insert into public.spor_aidatlar (sporcu_id, donem, tutar, son_odeme_tarihi, durum, aciklama)
      values (new.id, v_ay, h.tutar, greatest(public.spor_grup_son_odeme(v_ay, new.grup_id), v_bugun + 7),
              case when h.tutar = 0 then 'muaf' else 'bekliyor' end,
              concat_ws(' · ', 'Kayıt onayında oluşturuldu', h.aciklama))
      on conflict (sporcu_id, donem) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Otomatik tahakkuk: her grup kendi "otomatik_tahakkuk" ayarıyla
create or replace function public.spor_otomatik_tahakkuk(p_bugun date default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_bugun date := coalesce(p_bugun, (now() at time zone 'Europe/Istanbul')::date);
  v_ay    date := date_trunc('month', v_bugun)::date;
  v_adet  integer := 0;
begin
  if (select nullif(trim(deger), '') from public.spor_ayarlar where anahtar = 'son_otomatik_tahakkuk') = v_ay::text then
    return 0;
  end if;

  insert into public.spor_aidatlar (sporcu_id, donem, tutar, son_odeme_tarihi, durum, aciklama)
  select s.id, v_ay, h.tutar, public.spor_grup_son_odeme(v_ay, s.grup_id),
         case when h.tutar = 0 then 'muaf' else 'bekliyor' end,
         concat_ws(' · ', 'Otomatik', h.aciklama)
    from public.spor_sporcular s
    cross join lateral public.spor_aidat_hesapla(s.id, v_ay) h
   where s.durum = 'aktif' and s.aylik_aidat > 0
     and public.spor_grup_ayar(s.grup_id, 'otomatik_tahakkuk', 'acik') <> 'kapali'
  on conflict (sporcu_id, donem) do nothing;
  get diagnostics v_adet = row_count;

  insert into public.spor_ayarlar (anahtar, deger, guncellendi)
  values ('son_otomatik_tahakkuk', v_ay::text, now())
  on conflict (anahtar) do update set deger = excluded.deger, guncellendi = now();

  return v_adet;
end;
$$;

create or replace function public.spor_aidat_onizle(p_sporcu uuid, p_donem date default null)
returns table (tutar numeric, aciklama text)
language sql stable security definer set search_path = public
as $$
  select h.tutar, h.aciklama
    from public.spor_aidat_hesapla(p_sporcu, coalesce(p_donem, (now() at time zone 'Europe/Istanbul')::date)) h
   where public.spor_yonetici_mi()
     and public.spor_sporcu_grubu(p_sporcu) = public.spor_aktif_grup()
$$;

-- ============================================================ 10. bildirimler
create or replace function public.spor_gun_listesi(p_metin text, p_varsayilan integer[])
returns integer[]
language plpgsql immutable set search_path = public
as $$
begin
  return string_to_array(regexp_replace(coalesce(p_metin, ''), '\s', '', 'g'), ',')::integer[];
exception when others then
  return p_varsayilan;
end;
$$;

-- Grubun yönetimine (admin + başkan + o grubun yöneticileri) toplu bildirim
create or replace function public.spor_bildirim_grup_yonetimine(
  p_grup uuid, p_tur text, p_baslik text, p_govde text, p_yol text, p_anahtar text
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_adet integer := 0;
begin
  for r in
    select p.id from public.spor_profiller p
     where p.rol in ('admin', 'baskan')
        or (p.rol = 'yonetici' and public.spor_grup_sayisi() <= 1)
    union
    select u.kullanici_id from public.spor_grup_uyeleri u
     where u.rol = 'yonetici' and u.grup_id = p_grup
  loop
    if public.spor_bildirim_yaz(r.id, p_tur, p_baslik, p_govde, p_yol, p_anahtar || ':' || r.id) then
      v_adet := v_adet + 1;
    end if;
  end loop;
  return v_adet;
end;
$$;

create or replace function public.spor_bildirim_yonetime(
  p_tur text, p_baslik text, p_govde text, p_yol text, p_anahtar text
)
returns integer
language sql security definer set search_path = public
as $$ select public.spor_bildirim_grup_yonetimine(public.spor_aktif_grup(), p_tur, p_baslik, p_govde, p_yol, p_anahtar) $$;

create or replace function public.spor_aidat_hatirlatmalari(p_bugun date default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_bugun   date := coalesce(p_bugun, (now() at time zone 'Europe/Istanbul')::date);
  v_once    integer[];
  v_gecikme integer[];
  v_an      timestamptz := (v_bugun + time '10:00') at time zone 'Europe/Istanbul';
  r         record;
  v_fark    integer;
  v_tur     text;
  v_baslik  text;
  v_govde   text;
  v_adet    integer := 0;
begin
  for r in
    select a.id, a.donem, a.tutar, a.son_odeme_tarihi, a.grup_id, s.ad, s.veli_id,
           a.tutar - coalesce((select sum(o.tutar) from public.spor_odemeler o
                                where o.aidat_id = a.id and o.durum = 'onaylandi'), 0) as kalan
      from public.spor_aidatlar a
      join public.spor_sporcular s on s.id = a.sporcu_id
     where a.durum = 'bekliyor'
       and a.son_odeme_tarihi is not null
       and s.veli_id is not null
       and a.son_odeme_tarihi between v_bugun - 60 and v_bugun + 30
  loop
    if r.kalan <= 0 then continue; end if;
    if public.spor_grup_ayar(r.grup_id, 'hatirlatma', 'acik') = 'kapali' then continue; end if;
    v_once := public.spor_gun_listesi(public.spor_grup_ayar(r.grup_id, 'hatirlatma_once', '3'), array[3]);
    v_gecikme := public.spor_gun_listesi(public.spor_grup_ayar(r.grup_id, 'hatirlatma_gecikme', '3,10'), array[3, 10]);
    v_fark := r.son_odeme_tarihi - v_bugun;
    v_tur := null;
    if v_fark > 0 and v_fark = any (v_once) then
      v_tur := 'aidat_yaklasiyor';
      v_baslik := public.spor_ay_adi(r.donem) || ' aidatı · ' || v_fark || ' gün kaldı';
      v_govde := r.ad || ' için ' || public.spor_tl(r.kalan) || ' ödenecek. Son ödeme: '
                 || to_char(r.son_odeme_tarihi, 'DD.MM.YYYY') || '.';
    elsif v_fark = 0 then
      v_tur := 'aidat_bugun';
      v_baslik := public.spor_ay_adi(r.donem) || ' aidatının son günü bugün';
      v_govde := r.ad || ' için ' || public.spor_tl(r.kalan) || ' ödenecek. Ödediyseniz dekontu yüklemeyi unutmayın.';
    elsif v_fark < 0 and (-v_fark) = any (v_gecikme) then
      v_tur := 'aidat_gecikti';
      v_baslik := public.spor_ay_adi(r.donem) || ' aidatı ' || (-v_fark) || ' gün gecikti';
      v_govde := r.ad || ' için ' || public.spor_tl(r.kalan) || ' bekleniyor. Bir sorun varsa kulüple konuşabilirsiniz.';
    end if;

    if v_tur is not null and public.spor_bildirim_yaz(
         r.veli_id, v_tur, v_baslik, v_govde, '/panel/aidat',
         'aidat:' || r.id || ':' || v_tur || ':' || v_fark, v_an) then
      v_adet := v_adet + 1;
    end if;
  end loop;
  return v_adet;
end;
$$;

create or replace function public.spor_zimmet_hatirlatmalari(p_bugun date default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_bugun date := coalesce(p_bugun, (now() at time zone 'Europe/Istanbul')::date);
  v_an    timestamptz := (v_bugun + time '10:00') at time zone 'Europe/Istanbul';
  r       record;
  v_adet  integer := 0;
begin
  for r in
    select z.id, z.esya, z.adet, z.iade_beklenen, s.id as sporcu_id, s.ad, s.veli_id,
           v_bugun - z.iade_beklenen as fark
      from public.spor_zimmetler z
      join public.spor_sporcular s on s.id = z.sporcu_id
     where z.iade_edildi is null
       and z.iade_beklenen is not null
       and s.veli_id is not null
       and v_bugun - z.iade_beklenen in (1, 7)
       and public.spor_grup_ayar(s.grup_id, 'hatirlatma', 'acik') <> 'kapali'
  loop
    if public.spor_bildirim_yaz(
         r.veli_id, 'zimmet_iade',
         r.ad || ': ' || case when r.adet > 1 then r.adet || ' adet ' else '' end || r.esya || ' iadesi gecikti',
         'İade tarihi ' || to_char(r.iade_beklenen, 'DD.MM.YYYY') || ' idi. Lütfen antrenmana getirin.',
         '/panel/sporcu/' || r.sporcu_id, 'zimmet:' || r.id || ':' || r.fark, v_an) then
      v_adet := v_adet + 1;
    end if;
  end loop;
  return v_adet;
end;
$$;

create or replace function public.spor_bildirim_yoklama()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v record;
begin
  if new.durum <> 'gelmedi' or (tg_op = 'UPDATE' and old.durum = 'gelmedi') then
    return new;
  end if;
  select s.ad, s.veli_id, s.grup_id, a.tarih, a.baslik into v
    from public.spor_sporcular s, public.spor_antrenmanlar a
   where s.id = new.sporcu_id and a.id = new.antrenman_id;
  if public.spor_grup_ayar(v.grup_id, 'bildirim_gelmedi', 'acik') = 'kapali' then
    return new;
  end if;
  if v.veli_id is null or v.tarih < (now() at time zone 'Europe/Istanbul')::date - 1 then
    return new;
  end if;
  perform public.spor_bildirim_yaz(
    v.veli_id, 'yoklama_gelmedi',
    v.ad || ' antrenmana katılmadı',
    to_char(v.tarih, 'DD.MM.YYYY') || ' · ' || v.baslik || '. Bir yanlışlık varsa antrenörle konuşabilirsiniz.',
    '/panel/antrenman', 'gelmedi:' || new.id);
  return new;
end;
$$;

create or replace function public.spor_bildirim_odeme()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_ad text;
begin
  select ad || ' ' || soyad into v_ad from public.spor_sporcular where id = new.sporcu_id;

  if tg_op = 'INSERT' and new.durum = 'beklemede' then
    perform public.spor_bildirim_grup_yonetimine(
      new.grup_id, 'yeni_odeme', 'Yeni ödeme bildirimi · ' || public.spor_tl(new.tutar),
      coalesce(v_ad, 'Sporcu') || ' için dekont onay bekliyor.', '/yonetim/odemeler', 'odeme:' || new.id);
  elsif tg_op = 'UPDATE' and new.durum is distinct from old.durum and new.bildiren_id is not null then
    if new.durum = 'onaylandi' then
      perform public.spor_bildirim_yaz(
        new.bildiren_id, 'odeme_onaylandi', 'Ödemeniz onaylandı · ' || public.spor_tl(new.tutar),
        coalesce(v_ad, 'Sporcu') || ' için ödemeniz kasaya işlendi. Teşekkürler.', '/panel/aidat',
        'odeme:' || new.id || ':onaylandi');
    elsif new.durum = 'reddedildi' then
      perform public.spor_bildirim_yaz(
        new.bildiren_id, 'odeme_reddedildi', 'Ödeme bildiriminiz onaylanmadı',
        coalesce(v_ad, 'Sporcu') || ' için ' || public.spor_tl(new.tutar) || ' tutarındaki bildirim onaylanmadı. '
          || coalesce('Not: ' || nullif(new.aciklama, ''), 'Ayrıntı için kulüple görüşün.'),
        '/panel/aidat', 'odeme:' || new.id || ':reddedildi');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.spor_bildirim_sporcu()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.durum = 'onay_bekliyor' and (tg_op = 'INSERT' or old.durum is distinct from 'onay_bekliyor') then
    perform public.spor_bildirim_grup_yonetimine(
      new.grup_id, 'yeni_kayit', 'Yeni sporcu kaydı · ' || new.ad || ' ' || new.soyad,
      coalesce((select ad || ' · ' from public.spor_gruplar where id = new.grup_id and public.spor_grup_sayisi() > 1), '')
        || coalesce(new.yas_grubu || ' · ', '') || 'Veli başvurdu, onayınızı bekliyor.',
      '/yonetim/sporcular', 'kayit:' || new.id);
  elsif tg_op = 'UPDATE' and old.durum = 'onay_bekliyor' and new.durum = 'aktif' and new.veli_id is not null then
    perform public.spor_bildirim_yaz(
      new.veli_id, 'kayit_onaylandi', new.ad || ' kulübe kaydedildi',
      'Hoş geldiniz! Antrenman programı, yoklama ve gelişim takibi artık uygulamada.',
      '/panel/sporcu/' || new.id, 'kayit:' || new.id || ':onay');
  end if;
  return new;
end;
$$;

-- ============================================================ 11. sporcu kaydı
drop function if exists public.spor_sporcu_on_kayit(text, text, date, text, text, text, text, text, text, text, text, text);

create or replace function public.spor_sporcu_on_kayit(
  p_ad text, p_soyad text, p_dogum_tarihi date, p_mevki text, p_okul text, p_ayak text,
  p_veli_ad_soyad text, p_veli_telefon text, p_acil_kisi text, p_acil_telefon text,
  p_notlar text, p_sporcu_eposta text, p_grup uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rol text;
  v_mail text;
  v_sporcu_mail text := lower(nullif(trim(p_sporcu_eposta), ''));
  v_grup uuid := coalesce(p_grup, public.spor_aktif_grup());
  v_id uuid;
begin
  if v_uid is null then raise exception 'Oturum bulunamadı.'; end if;

  select rol into v_rol from public.spor_profiller where id = v_uid;
  if v_rol = 'sporcu' then
    raise exception 'Sporcu hesabı yeni kayıt oluşturamaz. Kaydınızı veliniz ya da kulüp oluşturur.';
  end if;
  if coalesce(trim(p_ad), '') = '' or coalesce(trim(p_soyad), '') = '' then
    raise exception 'Ad ve soyad zorunludur.';
  end if;
  if not exists (select 1 from public.spor_gruplar g
                  where g.id = v_grup and g.aktif
                    and (g.kayit_acik or public.spor_grup_erisimi(g.id))) then
    raise exception 'Bu gruba şu an kayıt alınmıyor.';
  end if;

  select email into v_mail from auth.users where id = v_uid;

  if (select count(*) from public.spor_sporcular where veli_id = v_uid and durum = 'onay_bekliyor') >= 5 then
    raise exception 'Onay bekleyen kayıt sayısı sınırına ulaştınız.';
  end if;

  insert into public.spor_sporcular (
    ad, soyad, dogum_tarihi, mevki, okul, ayak,
    veli_ad_soyad, veli_telefon, veli_eposta, veli_id, sporcu_eposta,
    acil_kisi, acil_telefon, notlar, aylik_aidat, durum, ekleyen_id, grup_id
  ) values (
    trim(p_ad), trim(p_soyad), p_dogum_tarihi, nullif(trim(p_mevki), ''),
    nullif(trim(p_okul), ''), nullif(trim(p_ayak), ''),
    nullif(trim(p_veli_ad_soyad), ''), nullif(trim(p_veli_telefon), ''), v_mail, v_uid, v_sporcu_mail,
    nullif(trim(p_acil_kisi), ''), nullif(trim(p_acil_telefon), ''), nullif(trim(p_notlar), ''),
    0, 'onay_bekliyor', v_uid, v_grup
  ) returning id into v_id;

  if v_sporcu_mail is not null then
    update public.spor_sporcular s set sporcu_kullanici_id = u.id
      from auth.users u
     where s.id = v_id and lower(u.email) = v_sporcu_mail;
  end if;

  -- Veli kaydettiği çocuğun grubunda açılır
  update public.spor_profiller set aktif_grup_id = v_grup where id = v_uid;
  return v_id;
end;
$$;

create or replace function public.spor_sporcu_foto_kaydet(p_id uuid, p_yol text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.spor_sporcu_gorebilir_mi(p_id)
          or (public.spor_personel_mi() and public.spor_sporcu_grubu(p_id) = public.spor_aktif_grup())) then
    raise exception 'Bu sporcu üzerinde yetkiniz yok.';
  end if;
  update public.spor_sporcular set foto_yolu = p_yol where id = p_id;
end;
$$;

create or replace function public.spor_deneme_dersi_planla(
  p_sporcu uuid, p_zaman timestamptz, p_yer text default null, p_not text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s public.spor_sporcular%rowtype;
begin
  if not public.spor_personel_mi() then
    raise exception 'Deneme dersini kulüp personeli planlar.';
  end if;
  select * into s from public.spor_sporcular where id = p_sporcu and grup_id = public.spor_aktif_grup();
  if not found or s.durum <> 'onay_bekliyor' then
    raise exception 'Yalnızca onay bekleyen başvurulara deneme dersi planlanır.';
  end if;
  if p_zaman is null then
    raise exception 'Deneme dersinin tarih ve saatini girin.';
  end if;

  update public.spor_sporcular
     set deneme_zamani = p_zaman,
         deneme_yeri = nullif(trim(p_yer), ''),
         aday_notu = coalesce(nullif(trim(p_not), ''), aday_notu)
   where id = p_sporcu;

  perform public.spor_bildirim_yaz(
    s.veli_id, 'deneme_dersi',
    s.ad || ' için deneme dersi: ' || to_char(p_zaman at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'),
    coalesce('Yer: ' || nullif(trim(p_yer), '') || '. ', '')
      || 'Rahat kıyafet, krampon ya da halı saha ayakkabısı ve su getirmeyi unutmayın.',
    '/panel', 'deneme:' || p_sporcu || ':' || extract(epoch from p_zaman)::bigint);
end;
$$;

create or replace function public.spor_aday_kapat(p_sporcu uuid, p_neden text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Başvuruyu kulüp yönetimi kapatır.';
  end if;
  update public.spor_sporcular
     set durum = 'pasif',
         aday_kapanis = (now() at time zone 'Europe/Istanbul')::date,
         aday_notu = left(concat_ws(' · ', nullif(aday_notu, ''), nullif(trim(p_neden), '')), 500)
   where id = p_sporcu and durum = 'onay_bekliyor' and grup_id = public.spor_aktif_grup();
  if not found then
    raise exception 'Bu başvuru zaten sonuçlanmış.';
  end if;
end;
$$;

-- ============================================================ 12. sezonlar (grup başına)
create or replace function public.spor_sezon_muhurlu_grup(p_tarih date, p_grup uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_tarih is not null and exists (
    select 1 from public.spor_sezonlar
     where yil = public.spor_sezon_yili(p_tarih) and grup_id = p_grup and durum = 'muhurlu')
$$;

create or replace function public.spor_sezon_muhurlu_mu(p_tarih date)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.spor_sezon_muhurlu_grup(p_tarih, public.spor_aktif_grup()) $$;

create or replace function public.spor_sezon_muhurle(p_yil integer, p_not text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_bugun date := (now() at time zone 'Europe/Istanbul')::date;
  v_grup  uuid := public.spor_aktif_grup();
  v_ozet  jsonb;
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Sezonu yalnızca kulüp yönetimi mühürleyebilir.';
  end if;
  if make_date(p_yil + 1, 8, 31) >= v_bugun then
    raise exception '% sezonu henüz bitmedi; 31 Ağustos''tan sonra mühürlenebilir.', public.spor_sezon_adi(p_yil);
  end if;
  if exists (select 1 from public.spor_sezonlar where yil = p_yil and grup_id = v_grup and durum = 'muhurlu') then
    raise exception '% sezonu zaten mühürlü.', public.spor_sezon_adi(p_yil);
  end if;

  v_ozet := public.spor_sezon_ozeti(p_yil);

  insert into public.spor_sezonlar as s
    (grup_id, yil, durum, kapanis_notu, ozet, muhurleme_zamani, muhurleyen_id, gecmis, updated_at)
  values
    (v_grup, p_yil, 'muhurlu', nullif(trim(p_not), ''), v_ozet, now(), auth.uid(),
     jsonb_build_array(jsonb_build_object('islem', 'muhurle', 'zaman', now(), 'kim', auth.uid())), now())
  on conflict (grup_id, yil) do update set
    durum            = 'muhurlu',
    kapanis_notu     = coalesce(nullif(trim(excluded.kapanis_notu), ''), s.kapanis_notu),
    ozet             = excluded.ozet,
    muhurleme_zamani = excluded.muhurleme_zamani,
    muhurleyen_id    = excluded.muhurleyen_id,
    gecmis           = s.gecmis || jsonb_build_object('islem', 'muhurle', 'zaman', now(), 'kim', auth.uid()),
    updated_at       = now();

  return v_ozet;
end;
$$;

create or replace function public.spor_sezon_muhur_ac(p_yil integer, p_neden text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Mührü yalnızca kulüp yönetimi açabilir.';
  end if;
  if char_length(trim(coalesce(p_neden, ''))) < 5 then
    raise exception 'Mührü açmak için gerekçe yazın (en az 5 karakter).';
  end if;
  update public.spor_sezonlar
     set durum = 'acik',
         gecmis = gecmis || jsonb_build_object('islem', 'muhur_ac', 'zaman', now(), 'kim', auth.uid(), 'neden', trim(p_neden)),
         updated_at = now()
   where yil = p_yil and grup_id = public.spor_aktif_grup() and durum = 'muhurlu';
  if not found then
    raise exception '% sezonu mühürlü değil.', public.spor_sezon_adi(p_yil);
  end if;
end;
$$;

create or replace function public.spor_sezon_not_kaydet(p_yil integer, p_not text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Kapanış notunu yalnızca kulüp yönetimi yazabilir.';
  end if;
  insert into public.spor_sezonlar as s (grup_id, yil, kapanis_notu, updated_at)
  values (public.spor_aktif_grup(), p_yil, nullif(trim(p_not), ''), now())
  on conflict (grup_id, yil) do update set kapanis_notu = excluded.kapanis_notu, updated_at = now();
end;
$$;

-- Mühür, kaydın kendi grubunun sezonuna bakar
create or replace function public.spor_muhur_koruma()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_eski date; v_yeni date;
  g_eski uuid; g_yeni uuid;
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_table_name in ('spor_maclar', 'spor_antrenmanlar') then
    if tg_op <> 'INSERT' then v_eski := old.tarih; g_eski := old.grup_id; end if;
    if tg_op <> 'DELETE' then v_yeni := new.tarih; g_yeni := new.grup_id; end if;
  elsif tg_table_name = 'spor_mac_katilim' then
    if tg_op <> 'INSERT' then select tarih, grup_id into v_eski, g_eski from public.spor_maclar where id = old.mac_id; end if;
    if tg_op <> 'DELETE' then select tarih, grup_id into v_yeni, g_yeni from public.spor_maclar where id = new.mac_id; end if;
  elsif tg_table_name = 'spor_yoklama' then
    if tg_op <> 'INSERT' then select tarih, grup_id into v_eski, g_eski from public.spor_antrenmanlar where id = old.antrenman_id; end if;
    if tg_op <> 'DELETE' then select tarih, grup_id into v_yeni, g_yeni from public.spor_antrenmanlar where id = new.antrenman_id; end if;
  end if;

  if public.spor_sezon_muhurlu_grup(v_eski, g_eski) or public.spor_sezon_muhurlu_grup(v_yeni, g_yeni) then
    raise exception '% sezonu mühürlendi; kayıtları değiştirilemez.',
      public.spor_sezon_adi(public.spor_sezon_yili(coalesce(v_eski, v_yeni)))
      using hint = 'Değişiklik gerekiyorsa kulüp yönetimi Sezonlar ekranından mührü gerekçe yazarak açabilir.',
            errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Gruplar ekranı (admin / başkan): her grubun sayıları
create or replace function public.spor_grup_ozetleri()
returns table (id uuid, ad text, kod text, aciklama text, sira integer, aktif boolean, kayit_acik boolean,
               sporcu integer, aday integer, personel integer)
language sql stable security definer set search_path = public
as $$
  select g.id, g.ad, g.kod, g.aciklama, g.sira, g.aktif, g.kayit_acik,
         (select count(*) from public.spor_sporcular s where s.grup_id = g.id and s.durum = 'aktif')::integer,
         (select count(*) from public.spor_sporcular s where s.grup_id = g.id and s.durum = 'onay_bekliyor')::integer,
         (select count(*) from public.spor_grup_uyeleri u where u.grup_id = g.id)::integer
    from public.spor_gruplar g
   where public.spor_kulup_geneli_mi()
   order by g.sira, g.created_at
$$;

-- Sezon geçişi (üst klasman): gruplar topluca yeni adlarına geçer, ör. U15 → U16.
-- Grup bir yaş kuşağıdır: sporcuları, velileri, kasası ve aidat geçmişi onunla gider.
-- En büyük kuşak (ör. U19) pasife alınabilir. Tek işlemde; kod çakışmasına karşı geçici kodla.
-- p_degisimler: [{"grup_id": "...", "ad": "U16", "kod": "u16", "aktif": true}, ...]
create or replace function public.spor_sezon_gecisi(p_degisimler jsonb)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r      record;
  v_adet integer := 0;
begin
  if not public.spor_admin_mi() then
    raise exception 'Sezon geçişini admin yapar.';
  end if;
  if jsonb_typeof(p_degisimler) <> 'array' or jsonb_array_length(p_degisimler) = 0 then
    raise exception 'Geçiş listesi boş.';
  end if;

  -- 1) geçici kodlar (u15→u16 ve u16→u17 aynı anda yapılabilsin)
  for r in select (e->>'grup_id')::uuid as id from jsonb_array_elements(p_degisimler) e loop
    update public.spor_gruplar set kod = 'gecis-' || left(replace(id::text, '-', ''), 17) where id = r.id;
    if not found then raise exception 'Grup bulunamadı: %', r.id; end if;
  end loop;

  -- 2) yeni ad / kod / durum
  for r in
    select (e->>'grup_id')::uuid as id, nullif(trim(e->>'ad'), '') as ad,
           lower(nullif(trim(e->>'kod'), '')) as kod, coalesce((e->>'aktif')::boolean, true) as aktif
      from jsonb_array_elements(p_degisimler) e
  loop
    if r.ad is null or r.kod is null then
      raise exception 'Her grup için yeni ad ve kod gerekli.';
    end if;
    update public.spor_gruplar
       set ad = r.ad, kod = r.kod, aktif = r.aktif,
           kayit_acik = case when r.aktif then kayit_acik else false end
     where id = r.id;
    v_adet := v_adet + 1;
  end loop;
  return v_adet;
end;
$$;

-- ============================================================ 13. erişim kuralları
alter table public.spor_gruplar enable row level security;
alter table public.spor_grup_uyeleri enable row level security;
alter table public.spor_grup_ayarlari enable row level security;
revoke all on public.spor_gruplar, public.spor_grup_uyeleri, public.spor_grup_ayarlari from anon;
grant select, insert, update, delete on public.spor_gruplar to authenticated;
grant select on public.spor_grup_uyeleri, public.spor_grup_ayarlari to authenticated;

drop policy if exists grup_okuma on public.spor_gruplar;
create policy grup_okuma on public.spor_gruplar for select to authenticated
  using (public.spor_grup_erisimi(id) or (aktif and kayit_acik));
drop policy if exists grup_admin on public.spor_gruplar;
create policy grup_admin on public.spor_gruplar for all to authenticated
  using (public.spor_admin_mi()) with check (public.spor_admin_mi());

drop policy if exists grup_uye_okuma on public.spor_grup_uyeleri;
create policy grup_uye_okuma on public.spor_grup_uyeleri for select to authenticated
  using (kullanici_id = auth.uid() or public.spor_kulup_geneli_mi()
         or (grup_id = (select public.spor_aktif_grup()) and public.spor_yonetici_mi()));

drop policy if exists grup_ayar_okuma on public.spor_grup_ayarlari;
create policy grup_ayar_okuma on public.spor_grup_ayarlari for select to authenticated
  using (public.spor_grup_erisimi(grup_id));

-- Kulüp geneli ayarlar: grup yöneticisi değiştiremez
drop policy if exists spor_ayarlar_yaz on public.spor_ayarlar;
create policy spor_ayarlar_yaz on public.spor_ayarlar for all to authenticated
  using (public.spor_yonetici_mi() and (public.spor_kulup_geneli_mi() or public.spor_grup_sayisi() <= 1))
  with check (public.spor_yonetici_mi() and (public.spor_kulup_geneli_mi() or public.spor_grup_sayisi() <= 1));

-- Profiller
drop policy if exists spor_profiller_select on public.spor_profiller;
create policy spor_profiller_select on public.spor_profiller for select to authenticated
  using (public.spor_profil_gorunur_mu(id));
drop policy if exists spor_profiller_update on public.spor_profiller;
create policy spor_profiller_update on public.spor_profiller for update to authenticated
  using (id = auth.uid() or (public.spor_yonetici_mi() and public.spor_profil_gorunur_mu(id)))
  with check (id = auth.uid() or (public.spor_yonetici_mi() and public.spor_profil_gorunur_mu(id)));
drop policy if exists spor_profiller_delete on public.spor_profiller;
create policy spor_profiller_delete on public.spor_profiller for delete to authenticated
  using (public.spor_admin_mi() or (public.spor_yonetici_mi() and public.spor_grup_sayisi() <= 1));

-- Yetki talepleri: grup yöneticisi kendi grubununkini görür
drop policy if exists spor_rol_talep_select on public.spor_rol_talepleri;
create policy spor_rol_talep_select on public.spor_rol_talepleri for select to authenticated
  using (kullanici_id = auth.uid() or public.spor_kulup_geneli_mi()
         or (public.spor_yonetici_mi()
             and (public.spor_grup_sayisi() <= 1 or grup_id = (select public.spor_aktif_grup()))));
drop policy if exists spor_rol_talep_yaz on public.spor_rol_talepleri;
create policy spor_rol_talep_yaz on public.spor_rol_talepleri for all to authenticated
  using (public.spor_kulup_geneli_mi()) with check (public.spor_kulup_geneli_mi());

-- Kasa: grubun personeli ya da grupta sporcusu olan veli
drop policy if exists spor_kasa_select on public.spor_kasa_hareketleri;
create policy spor_kasa_select on public.spor_kasa_hareketleri for select to authenticated
  using (public.spor_kasa_gorebilir_mi());

-- ---- Grup kapsamı (RESTRICTIVE: diğer kurallarla birlikte VE'lenir)
do $$
declare t text;
begin
  -- Doğrudan grup alanı olan tablolar: yalnızca aktif grup
  foreach t in array array[
    'spor_antrenmanlar', 'spor_maclar', 'spor_kasa_hareketleri', 'spor_duyurular',
    'spor_sezonlar', 'spor_sezon_anilari', 'spor_yukselenler']
  loop
    execute format('drop policy if exists grup_kapsami on public.%I', t);
    execute format($p$create policy grup_kapsami on public.%I as restrictive for all to authenticated
      using (grup_id = (select public.spor_aktif_grup()))
      with check (grup_id = (select public.spor_aktif_grup()))$p$, t);
  end loop;

  -- Sporcuya bağlı tablolar: okuma aktif grup ya da kendi çocuğu; yazma aktif grup
  foreach t in array array[
    'spor_belgeler', 'spor_degerlendirmeler', 'spor_olcumler', 'spor_sporcu_notlari',
    'spor_yoklama', 'spor_mac_katilim', 'spor_zimmetler']
  loop
    execute format('drop policy if exists grup_kapsami on public.%I', t);
    execute format('drop policy if exists grup_kapsami_okuma on public.%I', t);
    execute format('drop policy if exists grup_kapsami_ekle on public.%I', t);
    execute format('drop policy if exists grup_kapsami_degis on public.%I', t);
    execute format('drop policy if exists grup_kapsami_sil on public.%I', t);
    execute format($p$create policy grup_kapsami_okuma on public.%I as restrictive for select to authenticated
      using (public.spor_sporcu_kapsamda(sporcu_id))$p$, t);
    execute format($p$create policy grup_kapsami_ekle on public.%I as restrictive for insert to authenticated
      with check (public.spor_sporcu_yazilabilir(sporcu_id))$p$, t);
    execute format($p$create policy grup_kapsami_degis on public.%I as restrictive for update to authenticated
      using (public.spor_sporcu_yazilabilir(sporcu_id)) with check (public.spor_sporcu_yazilabilir(sporcu_id))$p$, t);
    execute format($p$create policy grup_kapsami_sil on public.%I as restrictive for delete to authenticated
      using (public.spor_sporcu_yazilabilir(sporcu_id))$p$, t);
  end loop;

  -- Aidat ve ödeme: kaydın kendi grubu
  foreach t in array array['spor_aidatlar', 'spor_odemeler']
  loop
    execute format('drop policy if exists grup_kapsami_okuma on public.%I', t);
    execute format('drop policy if exists grup_kapsami_ekle on public.%I', t);
    execute format('drop policy if exists grup_kapsami_degis on public.%I', t);
    execute format('drop policy if exists grup_kapsami_sil on public.%I', t);
    execute format($p$create policy grup_kapsami_okuma on public.%I as restrictive for select to authenticated
      using (public.spor_sporcu_kapsamda(sporcu_id, grup_id))$p$, t);
    -- Ekleme: grup_id tetikleyiciyle sporcudan gelir; denetim sporcu üzerinden
    execute format($p$create policy grup_kapsami_ekle on public.%I as restrictive for insert to authenticated
      with check (public.spor_sporcu_yazilabilir(sporcu_id))$p$, t);
    execute format($p$create policy grup_kapsami_degis on public.%I as restrictive for update to authenticated
      using (public.spor_sporcu_yazilabilir(sporcu_id, grup_id)) with check (public.spor_sporcu_yazilabilir(sporcu_id, grup_id))$p$, t);
    execute format($p$create policy grup_kapsami_sil on public.%I as restrictive for delete to authenticated
      using (public.spor_sporcu_yazilabilir(sporcu_id, grup_id))$p$, t);
  end loop;
end $$;

-- Sporcular: okuma aktif grup ya da kendi çocuğu / kendi kaydı; yazma yalnızca aktif grup
drop policy if exists grup_kapsami_okuma on public.spor_sporcular;
create policy grup_kapsami_okuma on public.spor_sporcular as restrictive for select to authenticated
  using (grup_id = (select public.spor_aktif_grup()) or veli_id = auth.uid() or sporcu_kullanici_id = auth.uid());
drop policy if exists grup_kapsami_ekle on public.spor_sporcular;
create policy grup_kapsami_ekle on public.spor_sporcular as restrictive for insert to authenticated
  with check (grup_id = (select public.spor_aktif_grup()));
drop policy if exists grup_kapsami_degis on public.spor_sporcular;
create policy grup_kapsami_degis on public.spor_sporcular as restrictive for update to authenticated
  using (grup_id = (select public.spor_aktif_grup())) with check (grup_id = (select public.spor_aktif_grup()));
drop policy if exists grup_kapsami_sil on public.spor_sporcular;
create policy grup_kapsami_sil on public.spor_sporcular as restrictive for delete to authenticated
  using (grup_id = (select public.spor_aktif_grup()));

-- Kayıt arşivi: grup yöneticisi kendi grubunun kayıtlarını görür
drop policy if exists grup_kapsami on public.spor_kayit_gecmisi;
create policy grup_kapsami on public.spor_kayit_gecmisi as restrictive for select to authenticated
  using (public.spor_kulup_geneli_mi() or public.spor_grup_sayisi() <= 1
         or coalesce(nullif(eski->>'grup_id', '')::uuid, public.spor_sporcu_grubu(nullif(eski->>'sporcu_id', '')::uuid))
            = (select public.spor_aktif_grup()));

-- Dosyalar: yönetici yalnızca kendi grubunun sporcularının dosyaları
drop policy if exists spor_dekont_select on storage.objects;
create policy spor_dekont_select on storage.objects for select to authenticated using (
  bucket_id = 'spor-dekontlar' and (
    (public.spor_yonetici_mi() and public.spor_sporcu_grubu(public.spor_dekont_sporcu(name)) = public.spor_aktif_grup())
    or public.spor_veli_mi(public.spor_dekont_sporcu(name))));
drop policy if exists spor_dekont_insert on storage.objects;
create policy spor_dekont_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'spor-dekontlar' and (
    (public.spor_yonetici_mi() and public.spor_sporcu_grubu(public.spor_dekont_sporcu(name)) = public.spor_aktif_grup())
    or public.spor_veli_mi(public.spor_dekont_sporcu(name))));
drop policy if exists spor_dekont_delete on storage.objects;
create policy spor_dekont_delete on storage.objects for delete to authenticated using (
  bucket_id = 'spor-dekontlar' and (
    (public.spor_yonetici_mi() and public.spor_sporcu_grubu(public.spor_dekont_sporcu(name)) = public.spor_aktif_grup())
    or (owner = auth.uid() and public.spor_veli_mi(public.spor_dekont_sporcu(name)))));
drop policy if exists spor_belge_select on storage.objects;
create policy spor_belge_select on storage.objects for select to authenticated using (
  bucket_id = 'spor-belgeler' and (
    (public.spor_yonetici_mi() and public.spor_sporcu_grubu(public.spor_dekont_sporcu(name)) = public.spor_aktif_grup())
    or public.spor_belge_erisimi(name)));
drop policy if exists spor_belge_insert on storage.objects;
create policy spor_belge_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'spor-belgeler' and (
    (public.spor_personel_mi() and public.spor_sporcu_grubu(public.spor_dekont_sporcu(name)) = public.spor_aktif_grup())
    or public.spor_belge_erisimi(name)));
drop policy if exists spor_belge_delete on storage.objects;
create policy spor_belge_delete on storage.objects for delete to authenticated using (
  bucket_id = 'spor-belgeler' and (
    (public.spor_yonetici_mi() and public.spor_sporcu_grubu(public.spor_dekont_sporcu(name)) = public.spor_aktif_grup())
    or (owner = auth.uid() and public.spor_veli_mi(public.spor_dekont_sporcu(name)))));

-- ============================================================ 14. veri aktarımı
-- Mevcut yönetici hesapları admin YAPILMAZ: ilk grubun grup yöneticisi olarak kalırlar.
-- Admin kulübe özgü veri betiğiyle atanır.

-- Mevcut personel ilk grubun üyesi olur
insert into public.spor_grup_uyeleri (grup_id, kullanici_id, rol)
select (select id from public.spor_gruplar order by sira, created_at limit 1), p.id, p.rol
  from public.spor_profiller p
 where p.rol in ('yonetici', 'antrenor', 'yardimci_antrenor')
on conflict do nothing;

update public.spor_rol_talepleri
   set grup_id = (select id from public.spor_gruplar order by sira, created_at limit 1)
 where grup_id is null and talep_rol <> 'baskan';

-- ============================================================ 15. izinler
do $$
declare f text;
begin
  -- Ekrandan çağrılanlar: yalnızca authenticated
  foreach f in array array[
    'spor_grup_sayisi()', 'spor_admin_mi()', 'spor_kulup_geneli_mi()', 'spor_grup_erisimi(uuid)',
    'spor_aktif_grup()', 'spor_kullanici_rolu(uuid, uuid)', 'spor_rol()', 'spor_sporcu_grubu(uuid)',
    'spor_sporcu_kapsamda(uuid, uuid)', 'spor_sporcu_yazilabilir(uuid, uuid)', 'spor_kasa_gorebilir_mi()',
    'spor_profil_gorunur_mu(uuid)', 'spor_grup_ayar(uuid, text, text)', 'spor_grup_ayar_sayi(uuid, text, numeric)',
    'spor_grup_son_odeme(date, uuid)', 'spor_ayarlari()', 'spor_ayar_kaydet(jsonb)',
    'spor_gruplarim()', 'spor_grup_sec(uuid)', 'spor_kayit_gruplari()', 'spor_grup_kullanicilari()',
    'spor_yetki_ver(uuid, text)', 'spor_rol_talebi_karar(uuid, boolean)',
    'spor_sporcu_grup_degistir(uuid, uuid)', 'spor_grup_anahtari_mi(text)',
    'spor_sporcu_on_kayit(text, text, date, text, text, text, text, text, text, text, text, text, uuid)',
    'spor_sezon_muhurlu_grup(date, uuid)', 'spor_sezon_gecisi(jsonb)', 'spor_grup_ozetleri()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;

  -- Yalnızca iç kullanım (tetikleyici / zamanlanmış iş)
  foreach f in array array[
    'spor_kayit_grubu_ata()', 'spor_grup_eklendi()', 'spor_gun_listesi(text, integer[])',
    'spor_bildirim_grup_yonetimine(uuid, text, text, text, text, text)',
    'spor_bildirim_yonetime(text, text, text, text, text)',
    'spor_aidat_hatirlatmalari(date)', 'spor_zimmet_hatirlatmalari(date)',
    'spor_otomatik_tahakkuk(date)', 'spor_aidat_hesapla(uuid, date, date)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
