-- ============================================================================
-- 2026-11-05 · Grup kapsamı: personel yalnızca seçili grubu görür
--
-- Sorun: Personel (admin, başkan, yönetici, antrenör) aynı zamanda bir sporcunun velisiyse,
-- "veli kendi çocuğunu her grupta görür" kuralı yüzünden çocuğu başka grubun yönetim
-- listelerinde de görünüyordu (ör. U14'e taşınan sporcu U15 listesinde kalıyor gibi).
-- Çözüm: Kendi çocuğunu grup dışında görme kolaylığı yalnızca personel olmayan velilere.
-- Personel kendi çocuğunu, çocuğun grubunu seçince görür.
-- Bağımlılık: 20261104_gruplar.sql.  Tekrar çalıştırılabilir.
-- ============================================================================

create or replace function public.spor_sporcu_kapsamda(p_sporcu uuid, p_grup uuid default null)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(p_grup, public.spor_sporcu_grubu(p_sporcu)) = public.spor_aktif_grup()
      or (public.spor_sporcu_gorebilir_mi(p_sporcu) and not public.spor_personel_mi())
$$;

drop policy if exists grup_kapsami_okuma on public.spor_sporcular;
create policy grup_kapsami_okuma on public.spor_sporcular as restrictive for select to authenticated
  using (grup_id = (select public.spor_aktif_grup())
         or ((veli_id = auth.uid() or sporcu_kullanici_id = auth.uid())
             and not (select public.spor_personel_mi())));

notify pgrst, 'reload schema';
