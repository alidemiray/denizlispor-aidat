-- ============================================================================
-- 2026-11-08 · Ayarlar › Kullanıcılar: yalnızca seçili grubun kişileri
--
-- Önce admin ve başkan her grupta kulüpteki herkesi görüyordu. Artık liste seçili grupla
-- ilgili kişiler: grubun personeli, gruptaki sporcuların velileri (anne / baba) ve sporcu
-- hesapları, gruba yetki talebi yapanlar, gruba yeni kaydolanlar ve kulüp geneli roller.
-- Başka gruptan birini atamak için admin / başkan: spor_grup_kullanicilari_tum().
-- Bağımlılık: 20261106_ikinci_veli.sql.  Tekrar çalıştırılabilir.
-- ============================================================================

create or replace function public.spor_kullanici_grupta_mi(p_kullanici uuid, p_grup uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.spor_profiller where id = p_kullanici and rol in ('admin', 'baskan'))
      or exists (select 1 from public.spor_grup_uyeleri where kullanici_id = p_kullanici and grup_id = p_grup)
      or exists (select 1 from public.spor_sporcular
                  where grup_id = p_grup and p_kullanici in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
      or exists (select 1 from public.spor_rol_talepleri
                  where kullanici_id = p_kullanici and grup_id = p_grup and durum = 'beklemede')
      or (exists (select 1 from public.spor_profiller where id = p_kullanici and aktif_grup_id = p_grup)
          and not exists (select 1 from public.spor_sporcular
                           where p_kullanici in (veli_id, ikinci_veli_id, sporcu_kullanici_id))
          and not exists (select 1 from public.spor_grup_uyeleri where kullanici_id = p_kullanici))
$$;

create or replace function public.spor_grup_kullanicilari()
returns table (id uuid, eposta text, ad_soyad text, temel_rol text, rol text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.eposta, p.ad_soyad, p.rol,
         public.spor_kullanici_rolu(p.id, public.spor_aktif_grup()), p.created_at
    from public.spor_profiller p
   where public.spor_yonetici_mi()
     and public.spor_profil_gorunur_mu(p.id)
     and (public.spor_grup_sayisi() <= 1 or public.spor_kullanici_grupta_mi(p.id, public.spor_aktif_grup()))
   order by p.created_at desc
   limit 500
$$;

-- Admin / başkan: başka gruptan birine bu grupta pozisyon vermek için tüm kişiler
create or replace function public.spor_grup_kullanicilari_tum()
returns table (id uuid, eposta text, ad_soyad text, temel_rol text, rol text, created_at timestamptz,
               gruplar text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.eposta, p.ad_soyad, p.rol,
         public.spor_kullanici_rolu(p.id, public.spor_aktif_grup()), p.created_at,
         (select string_agg(g.ad, ', ' order by g.sira) from public.spor_gruplar g
           where public.spor_kullanici_grupta_mi(p.id, g.id)
             and not exists (select 1 from public.spor_profiller x where x.id = p.id and x.rol in ('admin', 'baskan')))
    from public.spor_profiller p
   where public.spor_kulup_geneli_mi()
   order by p.ad_soyad nulls last, p.eposta
   limit 1000
$$;

revoke execute on function public.spor_kullanici_grupta_mi(uuid, uuid) from public, anon;
grant execute on function public.spor_kullanici_grupta_mi(uuid, uuid) to authenticated;
revoke execute on function public.spor_grup_kullanicilari() from public, anon;
grant execute on function public.spor_grup_kullanicilari() to authenticated;
revoke execute on function public.spor_grup_kullanicilari_tum() from public, anon;
grant execute on function public.spor_grup_kullanicilari_tum() to authenticated;

notify pgrst, 'reload schema';
