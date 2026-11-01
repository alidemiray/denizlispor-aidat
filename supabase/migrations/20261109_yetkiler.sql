-- ============================================================================
-- 2026-11-09 · Admin yetki ekranı, grup görünürlüğü, tahsilat silme
--
--   · Görünürlük (grup başına, admin / başkan açar-kapatır): veliler kasayı, ödemeyenler
--     listesini, aidat akışını görsün mü. Varsayılan açık. Grup yönetimi her zaman görür.
--   · Yetki tablosu: admin / başkan, grup değiştirmeden kişiye her grupta pozisyon verir/alır.
--   · Onaylanmış tahsilatı silmek yalnızca admin ve başkanda (tek gruplu kurulumda yönetici);
--     silinen ve değiştirilen ödemelerin eski hali kayıt arşivine yazılır.
-- Bağımlılık: 20261106_ikinci_veli.sql.  Tekrar çalıştırılabilir.
-- ============================================================================

create or replace function public.spor_grup_anahtari_mi(p_anahtar text)
returns boolean
language sql immutable set search_path = public
as $$
  select p_anahtar = any (array[
    'banka_adi', 'hesap_sahibi', 'iban', 'odeme_aciklamasi', 'iletisim_telefon', 'iletisim_eposta',
    'kardes_indirimi', 'kist_hesap', 'son_odeme_gunu', 'otomatik_tahakkuk',
    'hatirlatma', 'bildirim_gelmedi', 'hatirlatma_once', 'hatirlatma_gecikme',
    'veli_kasa', 'veli_odemeyenler', 'veli_aidat_akisi'])
$$;

create or replace function public.spor_kasa_gorebilir_mi()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.spor_yonetici_mi()
      or (public.spor_rol() = 'veli'
          and public.spor_ayar('veli_kasa', 'acik') <> 'kapali'
          and exists (select 1 from public.spor_sporcular
                       where auth.uid() in (veli_id, ikinci_veli_id) and durum = 'aktif'
                         and grup_id = public.spor_aktif_grup()))
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
     and (public.spor_yonetici_mi() or public.spor_ayar('veli_aidat_akisi', 'acik') <> 'kapali')
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
     and (public.spor_yonetici_mi() or public.spor_ayar('veli_odemeyenler', 'acik') <> 'kapali')
     and a.grup_id = public.spor_aktif_grup()
   order by a.donem desc, s.yas_grubu nulls last, s.ad;
$$;

-- --------------------------------------------- admin: başka grubun ayarını yaz
create or replace function public.spor_grup_ayar_yaz(p_grup uuid, p_anahtar text, p_deger text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.spor_kulup_geneli_mi() then
    raise exception 'Bu ayarı admin ya da kulüp başkanı değiştirir.';
  end if;
  if not public.spor_grup_anahtari_mi(p_anahtar) then
    raise exception 'Geçersiz ayar: %', p_anahtar;
  end if;
  insert into public.spor_grup_ayarlari (grup_id, anahtar, deger, guncellendi)
  values (p_grup, p_anahtar, left(trim(coalesce(p_deger, '')), 500), now())
  on conflict (grup_id, anahtar) do update set deger = excluded.deger, guncellendi = now();
end;
$$;

-- ------------------------------------------------------ admin: yetki tablosu
-- Kişi başına: kulüp rolü, gruplardaki pozisyonları, çocuğunun olduğu gruplar
create or replace function public.spor_yetki_tablosu()
returns table (id uuid, ad_soyad text, eposta text, temel_rol text, uyelikler jsonb, cocuk_gruplari uuid[])
language sql stable security definer set search_path = public
as $$
  select p.id, p.ad_soyad, p.eposta, p.rol,
         coalesce((select jsonb_object_agg(u.grup_id::text, u.rol) from public.spor_grup_uyeleri u
                    where u.kullanici_id = p.id), '{}'::jsonb),
         coalesce((select array_agg(distinct s.grup_id) from public.spor_sporcular s
                    where p.id in (s.veli_id, s.ikinci_veli_id, s.sporcu_kullanici_id)), '{}')
    from public.spor_profiller p
   where public.spor_kulup_geneli_mi()
   order by (p.rol in ('admin', 'baskan')) desc, p.ad_soyad nulls last, p.eposta
$$;

-- Admin / başkan: kişiye bir grupta pozisyon ver ya da al ('yok'), grup değiştirmeden
create or replace function public.spor_grup_yetkisi_ver(p_kullanici uuid, p_grup uuid, p_rol text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_temel text;
begin
  if not public.spor_kulup_geneli_mi() then
    raise exception 'Pozisyonları admin ya da kulüp başkanı belirler.';
  end if;
  if p_kullanici = auth.uid() then raise exception 'Kendi yetkinizi değiştiremezsiniz.'; end if;
  select rol into v_temel from public.spor_profiller where id = p_kullanici;
  if v_temel is null then raise exception 'Kullanıcı bulunamadı.'; end if;
  if v_temel in ('admin', 'baskan') then
    raise exception 'Admin ve kulüp başkanı tüm gruplarda zaten yetkili.';
  end if;
  if not exists (select 1 from public.spor_gruplar where id = p_grup) then
    raise exception 'Grup bulunamadı.';
  end if;

  if p_rol = 'yok' then
    delete from public.spor_grup_uyeleri where grup_id = p_grup and kullanici_id = p_kullanici;
  elsif p_rol in ('yonetici', 'antrenor', 'yardimci_antrenor') then
    insert into public.spor_grup_uyeleri (grup_id, kullanici_id, rol, ekleyen_id)
    values (p_grup, p_kullanici, p_rol, auth.uid())
    on conflict (grup_id, kullanici_id) do update set rol = excluded.rol, ekleyen_id = excluded.ekleyen_id;
  else
    raise exception 'Geçersiz pozisyon: %', p_rol;
  end if;

  -- Eski kurulumdan kalan profil rolü (yonetici/antrenor) gruptaki üyeliğe bırakılır
  if v_temel in ('yonetici', 'antrenor', 'yardimci_antrenor') then
    update public.spor_profiller set rol = 'veli' where id = p_kullanici;
  end if;
end;
$$;

-- --------------------------------------------------------- tahsilat silme
drop policy if exists spor_odemeler_sil on public.spor_odemeler;
create policy spor_odemeler_sil on public.spor_odemeler for delete to authenticated
  using (public.spor_kulup_geneli_mi()
         or (public.spor_grup_sayisi() <= 1 and public.spor_yonetici_mi())
         or (bildiren_id = auth.uid() and durum = 'beklemede'));

drop trigger if exists spor_odeme_gecmis on public.spor_odemeler;
create trigger spor_odeme_gecmis before delete or update on public.spor_odemeler
  for each row execute function public.spor_gecmis_kaydet();

-- ------------------------------------------------------------------ izinler
do $$
declare f text;
begin
  foreach f in array array[
    'spor_grup_ayar_yaz(uuid, text, text)', 'spor_yetki_tablosu()', 'spor_grup_yetkisi_ver(uuid, uuid, text)',
    'spor_aidat_akisi(date)', 'spor_odemeyenler(date)', 'spor_kasa_gorebilir_mi()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';
