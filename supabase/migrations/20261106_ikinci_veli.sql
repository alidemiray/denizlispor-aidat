-- ============================================================================
-- 2026-11-06 · İkinci veli + çift kayıt birleştirme
--
-- Sorun: Anne ve baba ayrı ayrı hesap açıp aynı çocuğu kaydedince sistemde iki sporcu oluşuyordu.
-- Çözüm
--   · Bir sporcuya iki veli bağlanır (veli_id + ikinci_veli_id). İkisi de çocuğu, aidatı ve
--     kasayı görür, ödeme bildirebilir; aidat tek açılır; bildirimler ikisine de gider.
--   · Kayıtta aynı grupta aynı ad-soyad varsa veli uyarılır; "ikinci veli olarak bağlan" isteği
--     grubun yönetimine gider (başka ailenin çocuğunun bilgisi gösterilmez).
--   · Yönetim çift kayıtları birleştirir: aidat, ödeme, yoklama, gelişim, belge, zimmet tek kayda
--     taşınır; kopyanın velisi ikinci veli olur; kopya silinir, eski hali kayıt arşivine yazılır.
-- Bağımlılık: 20261104_gruplar.sql, 20261105_grup_kapsami_personel.sql.  Tekrar çalıştırılabilir.
-- ============================================================================

alter table public.spor_sporcular
  add column if not exists ikinci_veli_id uuid references auth.users (id) on delete set null,
  add column if not exists ikinci_veli_eposta text,
  add column if not exists ikinci_veli_ad_soyad text,
  add column if not exists ikinci_veli_telefon text;
create index if not exists spor_sporcular_ikinci_veli_idx on public.spor_sporcular (ikinci_veli_id);
create index if not exists spor_sporcular_ikinci_veli_eposta_idx on public.spor_sporcular (lower(ikinci_veli_eposta));

alter table public.spor_bildirimler drop constraint if exists spor_bildirimler_tur_check;
alter table public.spor_bildirimler add constraint spor_bildirimler_tur_check check (tur in (
  'aidat_yaklasiyor', 'aidat_bugun', 'aidat_gecikti',
  'yoklama_gelmedi', 'odeme_onaylandi', 'odeme_reddedildi',
  'kayit_onaylandi', 'yeni_odeme', 'yeni_kayit', 'deneme_dersi', 'zimmet_iade', 'veli_baglama'));

-- ----------------------------------------------------------- veli kapıları
create or replace function public.spor_veli_mi(p_sporcu uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.spor_sporcular
                  where id = p_sporcu and auth.uid() in (veli_id, ikinci_veli_id))
$$;

create or replace function public.spor_sporcu_gorebilir_mi(p_sporcu uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.spor_sporcular
                  where id = p_sporcu and auth.uid() in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
$$;

-- Sporcunun velileri (bildirim için); birinci veli önce
create or replace function public.spor_sporcu_velileri(p_sporcu uuid)
returns table (kullanici_id uuid, ikinci boolean)
language sql stable security definer set search_path = public
as $$
  select veli_id, false from public.spor_sporcular where id = p_sporcu and veli_id is not null
  union all
  select ikinci_veli_id, true from public.spor_sporcular
   where id = p_sporcu and ikinci_veli_id is not null and ikinci_veli_id is distinct from veli_id
$$;

-- ------------------------------------------- iki veliyi tanıyan fonksiyonlar
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
                     and auth.uid() in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
       -- Henüz çocuğu ve görevi olmayan yeni hesap: kayıtta seçtiği (kaydı açık) grup
       or (exists (select 1 from public.spor_profiller p join public.spor_gruplar g on g.id = p.aktif_grup_id
                    where p.id = auth.uid() and p.aktif_grup_id = p_grup and g.kayit_acik and g.aktif)
           and not exists (select 1 from public.spor_sporcular
                            where auth.uid() in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
           and not exists (select 1 from public.spor_grup_uyeleri where kullanici_id = auth.uid()))
     )
$$;

create or replace function public.spor_kasa_gorebilir_mi()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.spor_yonetici_mi()
      or (public.spor_rol() = 'veli'
          and exists (select 1 from public.spor_sporcular
                       where auth.uid() in (veli_id, ikinci_veli_id) and durum = 'aktif'
                         and grup_id = public.spor_aktif_grup()))
$$;

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
                  where grup_id = v_grup and p_kullanici in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
      or exists (select 1 from public.spor_rol_talepleri
                  where kullanici_id = p_kullanici and grup_id = v_grup and durum = 'beklemede')
      or (exists (select 1 from public.spor_profiller where id = p_kullanici and aktif_grup_id = v_grup and rol in ('veli', 'sporcu'))
          and not exists (select 1 from public.spor_sporcular where p_kullanici in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
          and not exists (select 1 from public.spor_grup_uyeleri where kullanici_id = p_kullanici));
end;
$$;

create or replace function public.spor_aidat_akisi(p_donem date)
returns table (aidat_id uuid, ad text, soyad text, yas_grubu text, tutar numeric, durum text,
               son_odeme_tarihi date, benim boolean)
language sql stable security definer set search_path = public
as $$
  select a.id, public.spor_maskele(s.ad, 'ad'), public.spor_maskele(s.soyad, 'soyad'),
         s.yas_grubu, a.tutar, a.durum, a.son_odeme_tarihi, coalesce(auth.uid() in (s.veli_id, s.ikinci_veli_id), false)
    from public.spor_aidatlar a
    join public.spor_sporcular s on s.id = a.sporcu_id
   where public.spor_kasa_gorebilir_mi()
     and a.grup_id = public.spor_aktif_grup()
     and a.donem = date_trunc('month', p_donem)::date
   order by s.yas_grubu nulls last, s.ad, s.soyad;
$$;

create or replace function public.spor_odemeyenler(p_donem date default null)
returns table (donem date, ad text, soyad text, yas_grubu text, tutar numeric, son_odeme_tarihi date,
               gecikti boolean, benim boolean)
language sql stable security definer set search_path = public
as $$
  select a.donem, public.spor_maskele(s.ad, 'ad'), public.spor_maskele(s.soyad, 'soyad'),
         s.yas_grubu, a.tutar, a.son_odeme_tarihi,
         (a.son_odeme_tarihi is not null and a.son_odeme_tarihi < current_date),
         coalesce(auth.uid() in (s.veli_id, s.ikinci_veli_id), false)
    from public.spor_aidatlar a
    join public.spor_sporcular s on s.id = a.sporcu_id
   where a.durum = 'bekliyor'
     and (p_donem is null or a.donem = date_trunc('month', p_donem)::date)
     and public.spor_kasa_gorebilir_mi()
     and a.grup_id = public.spor_aktif_grup()
   order by a.donem desc, s.yas_grubu nulls last, s.ad;
$$;

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
  if v_kardes > v_oran and coalesce(s.veli_id, s.ikinci_veli_id) is not null then
    select count(*) into v_once
      from public.spor_sporcular k
     where (k.veli_id in (s.veli_id, s.ikinci_veli_id) or k.ikinci_veli_id in (s.veli_id, s.ikinci_veli_id))
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
  update public.spor_sporcular set ikinci_veli_id = new.id
   where ikinci_veli_id is null and veli_id is distinct from new.id
     and lower(ikinci_veli_eposta) = lower(new.email);
  update public.spor_sporcular set sporcu_kullanici_id = new.id
   where sporcu_kullanici_id is null and lower(sporcu_eposta) = lower(new.email);

  return new;
end;
$$;

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
  update public.spor_sporcular set ikinci_veli_id = v_uid
   where ikinci_veli_id is null and veli_id is distinct from v_uid
     and lower(ikinci_veli_eposta) = lower(coalesce(v_mail, ''));
  update public.spor_sporcular set sporcu_kullanici_id = v_uid
   where sporcu_kullanici_id is null and lower(sporcu_eposta) = lower(coalesce(v_mail, ''));

  v_kayit.aktif_grup_id := public.spor_aktif_grup();
  v_kayit.rol := coalesce(public.spor_kullanici_rolu(v_uid, v_kayit.aktif_grup_id), v_kayit.rol);
  return v_kayit;
end;
$$;

-- ------------------------------------------------ bildirimler iki veliye
-- İkinci velinin anahtarı ":v2" ile ayrılır (birinci velinin mevcut anahtarları değişmez)
create or replace function public.spor_bildirim_velilere(
  p_sporcu uuid, p_tur text, p_baslik text, p_govde text, p_yol text, p_anahtar text,
  p_an timestamptz default now()
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_adet integer := 0;
begin
  for r in select * from public.spor_sporcu_velileri(p_sporcu) loop
    if public.spor_bildirim_yaz(r.kullanici_id, p_tur, p_baslik, p_govde, p_yol,
         p_anahtar || case when r.ikinci then ':v2' else '' end, p_an) then
      v_adet := v_adet + 1;
    end if;
  end loop;
  return v_adet;
end;
$$;

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
    select a.id, a.donem, a.tutar, a.son_odeme_tarihi, a.grup_id, s.id as sporcu_id, s.ad,
           a.tutar - coalesce((select sum(o.tutar) from public.spor_odemeler o
                                where o.aidat_id = a.id and o.durum = 'onaylandi'), 0) as kalan
      from public.spor_aidatlar a
      join public.spor_sporcular s on s.id = a.sporcu_id
     where a.durum = 'bekliyor'
       and a.son_odeme_tarihi is not null
       and coalesce(s.veli_id, s.ikinci_veli_id) is not null
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

    if v_tur is not null then
      v_adet := v_adet + public.spor_bildirim_velilere(
        r.sporcu_id, v_tur, v_baslik, v_govde, '/panel/aidat',
        'aidat:' || r.id || ':' || v_tur || ':' || v_fark, v_an);
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
    select z.id, z.esya, z.adet, z.iade_beklenen, s.id as sporcu_id, s.ad, v_bugun - z.iade_beklenen as fark
      from public.spor_zimmetler z
      join public.spor_sporcular s on s.id = z.sporcu_id
     where z.iade_edildi is null
       and z.iade_beklenen is not null
       and coalesce(s.veli_id, s.ikinci_veli_id) is not null
       and v_bugun - z.iade_beklenen in (1, 7)
       and public.spor_grup_ayar(s.grup_id, 'hatirlatma', 'acik') <> 'kapali'
  loop
    v_adet := v_adet + public.spor_bildirim_velilere(
      r.sporcu_id, 'zimmet_iade',
      r.ad || ': ' || case when r.adet > 1 then r.adet || ' adet ' else '' end || r.esya || ' iadesi gecikti',
      'İade tarihi ' || to_char(r.iade_beklenen, 'DD.MM.YYYY') || ' idi. Lütfen antrenmana getirin.',
      '/panel/sporcu/' || r.sporcu_id, 'zimmet:' || r.id || ':' || r.fark, v_an);
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
  select s.ad, s.grup_id, a.tarih, a.baslik into v
    from public.spor_sporcular s, public.spor_antrenmanlar a
   where s.id = new.sporcu_id and a.id = new.antrenman_id;
  if public.spor_grup_ayar(v.grup_id, 'bildirim_gelmedi', 'acik') = 'kapali' then
    return new;
  end if;
  if v.tarih < (now() at time zone 'Europe/Istanbul')::date - 1 then
    return new;
  end if;
  perform public.spor_bildirim_velilere(
    new.sporcu_id, 'yoklama_gelmedi',
    v.ad || ' antrenmana katılmadı',
    to_char(v.tarih, 'DD.MM.YYYY') || ' · ' || v.baslik || '. Bir yanlışlık varsa antrenörle konuşabilirsiniz.',
    '/panel/antrenman', 'gelmedi:' || new.id);
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
  elsif tg_op = 'UPDATE' and old.durum = 'onay_bekliyor' and new.durum = 'aktif' then
    perform public.spor_bildirim_velilere(
      new.id, 'kayit_onaylandi', new.ad || ' kulübe kaydedildi',
      'Hoş geldiniz! Antrenman programı, yoklama ve gelişim takibi artık uygulamada.',
      '/panel/sporcu/' || new.id, 'kayit:' || new.id || ':onay');
  end if;
  return new;
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

  perform public.spor_bildirim_velilere(
    p_sporcu, 'deneme_dersi',
    s.ad || ' için deneme dersi: ' || to_char(p_zaman at time zone 'Europe/Istanbul', 'DD.MM.YYYY HH24:MI'),
    coalesce('Yer: ' || nullif(trim(p_yer), '') || '. ', '')
      || 'Rahat kıyafet, krampon ya da halı saha ayakkabısı ve su getirmeyi unutmayın.',
    '/panel', 'deneme:' || p_sporcu || ':' || extract(epoch from p_zaman)::bigint);
end;
$$;

-- ------------------------------------------------------------ erişim kuralları
drop policy if exists spor_sporcular_select on public.spor_sporcular;
create policy spor_sporcular_select on public.spor_sporcular for select to authenticated
  using (auth.uid() in (veli_id, ikinci_veli_id, sporcu_kullanici_id) or public.spor_personel_mi());

drop policy if exists grup_kapsami_okuma on public.spor_sporcular;
create policy grup_kapsami_okuma on public.spor_sporcular as restrictive for select to authenticated
  using (grup_id = (select public.spor_aktif_grup())
         or (auth.uid() in (veli_id, ikinci_veli_id, sporcu_kullanici_id)
             and not (select public.spor_personel_mi())));

drop policy if exists spor_zimmetler_select on public.spor_zimmetler;
create policy spor_zimmetler_select on public.spor_zimmetler for select to authenticated
  using (public.spor_personel_mi() or public.spor_sporcu_gorebilir_mi(sporcu_id));

-- ------------------------------------------------------- ikinci veli atama
-- Yönetim, sporcuya ikinci veliyi e-postasıyla ekler; o e-postayla hesap varsa hemen bağlanır,
-- yoksa veli hesap açınca bağlanır. Boş e-posta ikinci veliyi kaldırır.
create or replace function public.spor_ikinci_veli_ata(
  p_sporcu uuid, p_eposta text, p_ad_soyad text default null, p_telefon text default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_mail text := lower(nullif(trim(p_eposta), ''));
  s      public.spor_sporcular%rowtype;
  v_uid  uuid;
begin
  if not public.spor_yonetici_mi() then
    raise exception 'İkinci veliyi kulüp yönetimi ekler.';
  end if;
  select * into s from public.spor_sporcular where id = p_sporcu and grup_id = public.spor_aktif_grup();
  if not found then raise exception 'Sporcu bu grupta bulunamadı.'; end if;

  if v_mail is null then
    update public.spor_sporcular
       set ikinci_veli_id = null, ikinci_veli_eposta = null, ikinci_veli_ad_soyad = null, ikinci_veli_telefon = null
     where id = p_sporcu;
    return false;
  end if;
  if v_mail = lower(coalesce(s.veli_eposta, '')) then
    raise exception 'Bu e-posta zaten birinci velinin.';
  end if;

  select id into v_uid from auth.users where lower(email) = v_mail;
  update public.spor_sporcular
     set ikinci_veli_eposta = v_mail,
         ikinci_veli_ad_soyad = coalesce(nullif(trim(p_ad_soyad), ''), ikinci_veli_ad_soyad),
         ikinci_veli_telefon = coalesce(nullif(trim(p_telefon), ''), ikinci_veli_telefon),
         ikinci_veli_id = case when v_uid is distinct from veli_id then v_uid end
   where id = p_sporcu;
  return v_uid is not null;
end;
$$;

-- ------------------------------------------------ kayıtta çift kayıt uyarısı
create or replace function public.spor_ad_anahtari(p text)
returns text
language sql immutable set search_path = public
as $$
  select regexp_replace(translate(lower(coalesce(p, '')), 'çğıiöşüâîûİI', 'cgiiosuaiuii'), '[^a-z]', '', 'g')
$$;

-- Aynı grupta aynı ad-soyadla (doğum tarihi girildiyse o da tutan) başka ailenin kaydı var mı?
-- Yalnızca evet/hayır döner; kimin kaydı olduğu gösterilmez.
create or replace function public.spor_benzer_kayit_var_mi(
  p_ad text, p_soyad text, p_dogum date default null, p_grup uuid default null
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.spor_sporcular s
     where s.grup_id = coalesce(p_grup, public.spor_aktif_grup())
       and s.durum <> 'pasif'
       and public.spor_ad_anahtari(s.ad) = public.spor_ad_anahtari(p_ad)
       and public.spor_ad_anahtari(s.soyad) = public.spor_ad_anahtari(p_soyad)
       and (p_dogum is null or s.dogum_tarihi is null or s.dogum_tarihi = p_dogum)
       and not coalesce(auth.uid() in (s.veli_id, s.ikinci_veli_id), false)
  )
$$;

-- Veli: "Bu çocuk eşimin hesabında kayıtlı, beni de bağlayın" isteği → grubun yönetimine bildirim
create or replace function public.spor_ikinci_veli_istegi(
  p_ad text, p_soyad text, p_dogum date default null, p_grup uuid default null, p_not text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_grup uuid := coalesce(p_grup, public.spor_aktif_grup());
  v_mail text;
  v_ad   text;
  v_tel  text;
  v_id   uuid;
begin
  if auth.uid() is null then raise exception 'Oturum bulunamadı.'; end if;
  if not public.spor_benzer_kayit_var_mi(p_ad, p_soyad, p_dogum, v_grup) then
    raise exception 'Bu grupta bu isimde bir kayıt bulunamadı.';
  end if;
  select u.email, p.ad_soyad, p.telefon into v_mail, v_ad, v_tel
    from auth.users u left join public.spor_profiller p on p.id = u.id where u.id = auth.uid();

  select s.id into v_id from public.spor_sporcular s
   where s.grup_id = v_grup and s.durum <> 'pasif'
     and public.spor_ad_anahtari(s.ad) = public.spor_ad_anahtari(p_ad)
     and public.spor_ad_anahtari(s.soyad) = public.spor_ad_anahtari(p_soyad)
     and (p_dogum is null or s.dogum_tarihi is null or s.dogum_tarihi = p_dogum)
   order by s.created_at limit 1;

  -- Kayıtta ikinci veli boşsa e-posta hazır yazılır; yönetim sporcu sayfasından onaylar
  update public.spor_sporcular
     set ikinci_veli_eposta = coalesce(ikinci_veli_eposta, lower(v_mail)),
         ikinci_veli_ad_soyad = coalesce(ikinci_veli_ad_soyad, v_ad),
         ikinci_veli_telefon = coalesce(ikinci_veli_telefon, v_tel)
   where id = v_id and ikinci_veli_id is null and ikinci_veli_eposta is null;

  update public.spor_profiller set aktif_grup_id = v_grup where id = auth.uid();

  return public.spor_bildirim_grup_yonetimine(
    v_grup, 'veli_baglama',
    'İkinci veli isteği · ' || trim(p_ad) || ' ' || trim(p_soyad),
    coalesce(v_ad, v_mail) || ' (' || v_mail || ') bu sporcunun velisi olarak bağlanmak istiyor.'
      || coalesce(' Not: ' || nullif(trim(p_not), ''), '') || ' Sporcu sayfasında İkinci veli bölümünden onaylayın.',
    '/yonetim/sporcular/' || v_id, 'veli_baglama:' || v_id || ':' || auth.uid());
end;
$$;

-- --------------------------------------------------- çift kayıt birleştirme
-- Kopyadaki her şey ana kayda taşınır; kopyanın velisi ana kaydın ikinci velisi olur.
-- Aynı döneme iki aidat varsa kopyanın ödemeleri ana aidata aktarılır. Kopya silinir;
-- eski hali kayıt arşivine "BIRLESTIR" olarak yazılır.
create or replace function public.spor_sporcu_birlestir(p_ana uuid, p_kopya uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  a public.spor_sporcular%rowtype;
  k public.spor_sporcular%rowtype;
  v_ikinci uuid;
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Kayıtları kulüp yönetimi birleştirir.';
  end if;
  if p_ana = p_kopya then raise exception 'Aynı kayıt seçildi.'; end if;
  select * into a from public.spor_sporcular where id = p_ana and grup_id = public.spor_aktif_grup();
  select * into k from public.spor_sporcular where id = p_kopya and grup_id = public.spor_aktif_grup();
  if a.id is null or k.id is null then
    raise exception 'İki kayıt da seçili grupta olmalı.';
  end if;

  -- Veliler: ana kaydın velisi kalır, kopyanın velisi ikinci veli olur
  v_ikinci := coalesce(a.ikinci_veli_id,
                       case when k.veli_id is distinct from a.veli_id then k.veli_id end,
                       case when k.ikinci_veli_id is distinct from a.veli_id then k.ikinci_veli_id end);
  if a.veli_id is null and v_ikinci is not null then
    a.veli_id := v_ikinci; v_ikinci := null;
  end if;

  update public.spor_sporcular set
    veli_id              = a.veli_id,
    ikinci_veli_id       = v_ikinci,
    ikinci_veli_eposta   = coalesce(a.ikinci_veli_eposta,
                             case when v_ikinci is not null and v_ikinci = k.veli_id then k.veli_eposta end,
                             k.ikinci_veli_eposta),
    ikinci_veli_ad_soyad = coalesce(a.ikinci_veli_ad_soyad,
                             case when v_ikinci is not null and v_ikinci = k.veli_id then k.veli_ad_soyad end,
                             k.ikinci_veli_ad_soyad),
    ikinci_veli_telefon  = coalesce(a.ikinci_veli_telefon,
                             case when v_ikinci is not null and v_ikinci = k.veli_id then k.veli_telefon end,
                             k.ikinci_veli_telefon),
    dogum_tarihi  = coalesce(a.dogum_tarihi, k.dogum_tarihi),
    yas_grubu     = coalesce(a.yas_grubu, k.yas_grubu),
    mevki         = coalesce(a.mevki, k.mevki),
    forma_no      = coalesce(a.forma_no, k.forma_no),
    okul          = coalesce(a.okul, k.okul),
    ayak          = coalesce(a.ayak, k.ayak),
    foto_yolu     = coalesce(a.foto_yolu, k.foto_yolu),
    acil_kisi     = coalesce(a.acil_kisi, k.acil_kisi),
    acil_telefon  = coalesce(a.acil_telefon, k.acil_telefon),
    sporcu_eposta = coalesce(a.sporcu_eposta, k.sporcu_eposta),
    sporcu_kullanici_id = coalesce(a.sporcu_kullanici_id, k.sporcu_kullanici_id),
    notlar        = nullif(concat_ws(' · ', nullif(a.notlar, ''), nullif(k.notlar, '')), ''),
    aylik_aidat   = case when a.aylik_aidat > 0 then a.aylik_aidat else k.aylik_aidat end,
    durum         = case when 'aktif' in (a.durum, k.durum) then 'aktif' else a.durum end
  where id = p_ana;

  -- Aidat: aynı dönem iki kayıtta varsa kopyanın ödemeleri ana aidata
  update public.spor_odemeler o
     set aidat_id = aa.id
    from public.spor_aidatlar ka
    join public.spor_aidatlar aa on aa.sporcu_id = p_ana and aa.donem = ka.donem
   where ka.sporcu_id = p_kopya and o.aidat_id = ka.id;
  update public.spor_aidatlar set sporcu_id = p_ana
   where sporcu_id = p_kopya
     and donem not in (select donem from public.spor_aidatlar where sporcu_id = p_ana);
  update public.spor_odemeler set sporcu_id = p_ana where sporcu_id = p_kopya;

  update public.spor_yoklama set sporcu_id = p_ana
   where sporcu_id = p_kopya and antrenman_id not in (select antrenman_id from public.spor_yoklama where sporcu_id = p_ana);
  update public.spor_mac_katilim set sporcu_id = p_ana
   where sporcu_id = p_kopya and mac_id not in (select mac_id from public.spor_mac_katilim where sporcu_id = p_ana);
  update public.spor_degerlendirmeler set sporcu_id = p_ana
   where sporcu_id = p_kopya and donem not in (select donem from public.spor_degerlendirmeler where sporcu_id = p_ana);
  update public.spor_olcumler set sporcu_id = p_ana
   where sporcu_id = p_kopya and tarih not in (select tarih from public.spor_olcumler where sporcu_id = p_ana);
  update public.spor_belgeler      set sporcu_id = p_ana where sporcu_id = p_kopya;
  update public.spor_sporcu_notlari set sporcu_id = p_ana where sporcu_id = p_kopya;
  update public.spor_zimmetler     set sporcu_id = p_ana where sporcu_id = p_kopya;
  update public.spor_yukselenler   set sporcu_id = p_ana where sporcu_id = p_kopya;

  insert into public.spor_kayit_gecmisi (tablo, kayit_id, islem, eski, yapan_id)
  values ('spor_sporcular', p_kopya, 'BIRLESTIR', to_jsonb(k) || jsonb_build_object('birlestirildigi', p_ana), auth.uid());

  delete from public.spor_sporcular where id = p_kopya;

  -- Velinin aidatı birleşen kayıtta tahakkuk ettiyse durum yeniden hesaplanır
  update public.spor_aidatlar ad set durum = case
      when (select coalesce(sum(o.tutar), 0) from public.spor_odemeler o
             where o.aidat_id = ad.id and o.durum = 'onaylandi') >= ad.tutar then 'odendi' else 'bekliyor' end
   where ad.sporcu_id = p_ana and ad.durum <> 'muaf';
end;
$$;

-- Yönetim için: seçili grupta aynı ad-soyadlı olası çift kayıtlar
create or replace function public.spor_olasi_ciftler()
returns table (ana_id uuid, kopya_id uuid, ad text, soyad text, ana_veli text, kopya_veli text)
language sql stable security definer set search_path = public
as $$
  select a.id, k.id, a.ad, a.soyad,
         coalesce(a.veli_ad_soyad, a.veli_eposta), coalesce(k.veli_ad_soyad, k.veli_eposta)
    from public.spor_sporcular a
    join public.spor_sporcular k
      on k.grup_id = a.grup_id and k.id <> a.id
     and public.spor_ad_anahtari(k.ad) = public.spor_ad_anahtari(a.ad)
     and public.spor_ad_anahtari(k.soyad) = public.spor_ad_anahtari(a.soyad)
     and (a.dogum_tarihi is null or k.dogum_tarihi is null or a.dogum_tarihi = k.dogum_tarihi)
     and (a.created_at, a.id) < (k.created_at, k.id)
   where public.spor_yonetici_mi()
     and a.grup_id = public.spor_aktif_grup()
     and a.durum <> 'pasif' and k.durum <> 'pasif'
   order by a.soyad, a.ad
$$;

-- ------------------------------------------------------------------ izinler
do $$
declare f text;
begin
  foreach f in array array[
    'spor_ikinci_veli_ata(uuid, text, text, text)', 'spor_benzer_kayit_var_mi(text, text, date, uuid)',
    'spor_ikinci_veli_istegi(text, text, date, uuid, text)', 'spor_sporcu_birlestir(uuid, uuid)',
    'spor_olasi_ciftler()', 'spor_ad_anahtari(text)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array[
    'spor_sporcu_velileri(uuid)',
    'spor_bildirim_velilere(uuid, text, text, text, text, text, timestamptz)',
    'spor_aidat_hatirlatmalari(date)', 'spor_zimmet_hatirlatmalari(date)', 'spor_aidat_hesapla(uuid, date, date)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
