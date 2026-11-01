-- ============================================================================
-- 2026-11-07 · Kasa açılış bakiyesi (grup başına)
--
-- Her grubun kasası uygulamaya geçmeden önceki bir tutarla başlar. Açılış bakiyesi kasa
-- hareketi olarak tutulur (tur = 'acilis', grup başına bir tane) ve havuza eklenir.
-- Girilmemiş gruplarda grubun yöneticilerine bildirim gider; yönetim özetinde de uyarı çıkar.
-- Bağımlılık: 20261104_gruplar.sql, 20261106_ikinci_veli.sql.  Tekrar çalıştırılabilir.
-- ============================================================================

alter table public.spor_kasa_hareketleri drop constraint if exists spor_kasa_hareketleri_tur_check;
alter table public.spor_kasa_hareketleri add constraint spor_kasa_hareketleri_tur_check
  check (tur in ('gelir', 'gider', 'aktarim', 'acilis'));
-- Açılış sıfır olabilir (kasa boş başladıysa); diğer hareketler sıfırdan büyük
alter table public.spor_kasa_hareketleri drop constraint if exists spor_kasa_hareketleri_tutar_check;
alter table public.spor_kasa_hareketleri add constraint spor_kasa_hareketleri_tutar_check
  check (tutar > 0 or (tur = 'acilis' and tutar >= 0));
create unique index if not exists spor_kasa_acilis_tek on public.spor_kasa_hareketleri (grup_id) where tur = 'acilis';

alter table public.spor_bildirimler drop constraint if exists spor_bildirimler_tur_check;
alter table public.spor_bildirimler add constraint spor_bildirimler_tur_check check (tur in (
  'aidat_yaklasiyor', 'aidat_bugun', 'aidat_gecikti',
  'yoklama_gelmedi', 'odeme_onaylandi', 'odeme_reddedildi',
  'kayit_onaylandi', 'yeni_odeme', 'yeni_kayit', 'deneme_dersi', 'zimmet_iade', 'veli_baglama',
  'kasa_acilis'));

-- Kasa özeti: açılış ayrı sütunda (havuz = açılış + tahsilat + ek gelir − aktarım − gider)
drop function if exists public.spor_kasa_ozeti();
create function public.spor_kasa_ozeti()
returns table (ay date, tahsilat numeric, ek_gelir numeric, aktarim numeric, gider numeric, acilis numeric)
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
           sum(k.tutar) filter (where k.tur = 'gider')   as gider,
           sum(k.tutar) filter (where k.tur = 'acilis')  as acilis
      from public.spor_kasa_hareketleri k, izin
     where k.grup_id = izin.grup
     group by 1
  )
  select coalesce(o.ay, h.ay), coalesce(o.tutar, 0), coalesce(h.ek_gelir, 0),
         coalesce(h.aktarim, 0), coalesce(h.gider, 0), coalesce(h.acilis, 0)
    from odemeler o
    full outer join hareketler h on h.ay = o.ay
   order by 1 desc;
$$;

-- Açılış bakiyesini kaydet / düzelt (grubun yönetimi)
create or replace function public.spor_kasa_acilis_kaydet(p_tutar numeric, p_tarih date, p_aciklama text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_grup uuid := public.spor_aktif_grup();
begin
  if not public.spor_yonetici_mi() then
    raise exception 'Açılış bakiyesini grubun yönetimi girer.';
  end if;
  if p_tutar is null or p_tutar < 0 then
    raise exception 'Açılış tutarı sıfır ya da daha büyük olmalı.';
  end if;
  if p_tarih is null then raise exception 'Açılış tarihini girin.'; end if;

  update public.spor_kasa_hareketleri
     set tutar = p_tutar, tarih = p_tarih,
         aciklama = coalesce(nullif(trim(p_aciklama), ''), 'Açılış bakiyesi')
   where grup_id = v_grup and tur = 'acilis';
  if not found then
    insert into public.spor_kasa_hareketleri (grup_id, tarih, tur, tutar, kategori, aciklama, ekleyen_id)
    values (v_grup, p_tarih, 'acilis', p_tutar, 'Açılış bakiyesi',
            coalesce(nullif(trim(p_aciklama), ''), 'Açılış bakiyesi'), auth.uid());
  end if;
end;
$$;

revoke execute on function public.spor_kasa_ozeti() from public, anon;
grant execute on function public.spor_kasa_ozeti() to authenticated;
revoke execute on function public.spor_kasa_acilis_kaydet(numeric, date, text) from public, anon;
grant execute on function public.spor_kasa_acilis_kaydet(numeric, date, text) to authenticated;

-- Açılışı girilmemiş her grubun yöneticilerine bir kez bildirim
do $$
declare r record;
begin
  for r in
    select g.id as grup_id, g.ad, u.kullanici_id
      from public.spor_gruplar g
      join public.spor_grup_uyeleri u on u.grup_id = g.id and u.rol = 'yonetici'
     where g.aktif
       and not exists (select 1 from public.spor_kasa_hareketleri k where k.grup_id = g.id and k.tur = 'acilis')
  loop
    perform public.spor_bildirim_yaz(
      r.kullanici_id, 'kasa_acilis', r.ad || ' kasası · açılış bakiyesini girin',
      'Kasanın uygulamaya geçmeden önceki tutarını Yönetim › Kasa ekranından girin. Havuz bu tutarla başlar.',
      '/yonetim/kasa', 'kasa_acilis:' || r.grup_id || ':' || r.kullanici_id);
  end loop;
end $$;

notify pgrst, 'reload schema';
