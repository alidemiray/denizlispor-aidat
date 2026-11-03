-- =====================================================================
-- 20261111 · FutAkademi ajanı sezon sonunda kendini kapatır
--
--   · Bir grubun ligindeki tüm maçlar skorlandıktan sonra, geç gelen kadrolar için 45 gün
--     daha tarar; sonra o grubun kaynağını kapatır (aktif = false) ve yönetime bildirir.
--   · FutAkademi bir maçın sonucunu hiç girmese bile son maçtan 90 gün sonra kapanır.
--   · Açık kaynak kalmayınca zamanlanmış görev (pg_cron 'spor-futakademi') silinir.
--   · Yeni sezon: spor_dis_kaynaklar satırı yeni lig/takım kimliğiyle güncellenip aktif yapılınca
--     görev kendiliğinden yeniden kurulur.
-- =====================================================================

alter table public.spor_bildirimler drop constraint if exists spor_bildirimler_tur_check;
alter table public.spor_bildirimler add constraint spor_bildirimler_tur_check check (tur in (
  'aidat_yaklasiyor', 'aidat_bugun', 'aidat_gecikti',
  'yoklama_gelmedi', 'odeme_onaylandi', 'odeme_reddedildi',
  'kayit_onaylandi', 'yeni_odeme', 'yeni_kayit', 'deneme_dersi', 'zimmet_iade', 'veli_baglama',
  'kasa_acilis', 'mac_sonucu', 'mac_kadro', 'senkron_hatasi', 'sezon_bitti'));

alter table public.spor_dis_kaynaklar add column if not exists bitis_tarihi date;

-- Zamanlamayı aç / kapat (pg_cron yoksa sessizce geçer)
create or replace function public.spor_futakademi_zamanlama()
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_acik boolean := exists (select 1 from public.spor_dis_kaynaklar where aktif and kaynak = 'futakademi');
  v_var  boolean;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    return 'pg_cron yok';
  end if;
  execute 'select exists (select 1 from cron.job where jobname = ''spor-futakademi'')' into v_var;
  if v_acik and not v_var then
    execute $q$select cron.schedule('spor-futakademi', '10 4,16 * * *',
      'set statement_timeout = ''10min''; select public.spor_futakademi_senkron()')$q$;
    return 'kuruldu';
  elsif not v_acik and v_var then
    execute $q$select cron.unschedule('spor-futakademi')$q$;
    return 'kaldırıldı';
  end if;
  return case when v_acik then 'açık' else 'kapalı' end;
exception when others then
  raise warning 'FutAkademi zamanlaması ayarlanamadı: %', sqlerrm;
  return 'hata: ' || sqlerrm;
end;
$$;

create or replace function public.spor_dis_kaynak_degisti()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (new.lig_id, new.takim_id, new.sezon) is distinct from (old.lig_id, old.takim_id, old.sezon) then
    new.bitis_tarihi := null;   -- yeni sezon
  end if;
  return new;
end;
$$;
drop trigger if exists spor_dis_kaynak_degisti_trg on public.spor_dis_kaynaklar;
create trigger spor_dis_kaynak_degisti_trg before update on public.spor_dis_kaynaklar
  for each row execute function public.spor_dis_kaynak_degisti();

create or replace function public.spor_dis_kaynak_zamanla()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.spor_futakademi_zamanlama();
  return null;
end;
$$;
drop trigger if exists spor_dis_kaynak_zamanla_trg on public.spor_dis_kaynaklar;
create trigger spor_dis_kaynak_zamanla_trg after insert or update of aktif or delete on public.spor_dis_kaynaklar
  for each statement execute function public.spor_dis_kaynak_zamanla();

-- Hafta işleyici artık sezon bilgisini de döndürür: son_tarih (ligdeki son maçımız), skorsuz (skoru olmayan maçımız)
create or replace function public.spor_fa_sezon_durumu(p_takim text, p_hafta jsonb)
returns jsonb
language sql immutable
as $$
  select jsonb_build_object(
    'son_tarih', max((((m ->> 'playedAt')::timestamptz) at time zone 'Europe/Istanbul')::date),
    'skorsuz',   count(*) filter (where m ->> 'homeScore' is null or m ->> 'awayScore' is null),
    'mac',       count(*))
    from jsonb_array_elements(coalesce(p_hafta -> 'matches', '[]'::jsonb)) m
   where m ->> 'homeTeamId' = p_takim or m ->> 'awayTeamId' = p_takim
$$;

-- Ajanın yeni sürümü: 20261110'daki gövde + sezon sonu denetimi
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
  v_sezon   jsonb;
  v_son     date;
  v_skorsuz integer;
  v_mac     integer;
  v_ozet    jsonb;
  v_skor    jsonb;
  v_hatalar jsonb;
  v_kadro   jsonb;
  v_detay   jsonb;
  v_id      jsonb;
  mc        public.spor_maclar%rowtype;
  v_genel   jsonb := '{}'::jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtext('spor_futakademi_senkron')) then
    return jsonb_build_object('atlandi', 'başka bir çalışma sürüyor');
  end if;

  for k in select * from public.spor_dis_kaynaklar where aktif and kaynak = 'futakademi' order by grup_id
  loop
    select ad into v_grup_adi from public.spor_gruplar where id = k.grup_id;
    v_ozet := jsonb_build_object('eklenen', 0, 'guncellenen', 0, 'skor', 0, 'kadro', 0, 'yeni_sporcu', '[]'::jsonb);
    v_skor := '[]'::jsonb;
    v_hatalar := '[]'::jsonb;
    v_son := null; v_skorsuz := 0; v_mac := 0;
    begin
      -- a) fikstür ve skorlar
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
        v_sezon := public.spor_fa_sezon_durumu(k.takim_id, v_hafta);
        v_son := greatest(v_son, (v_sezon ->> 'son_tarih')::date);
        v_skorsuz := v_skorsuz + (v_sezon ->> 'skorsuz')::int;
        v_mac := v_mac + (v_sezon ->> 'mac')::int;
      end loop;
      v_ozet := v_ozet || jsonb_build_object('skor', jsonb_array_length(v_skor), 'lig_maci', v_mac,
                                             'skorsuz', v_skorsuz, 'son_mac', v_son);

      -- b) skoru belli, kadrosu boş maçlar (son 60 gün)
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

      -- d) sezon sonu: tüm maçlar skorlu + 45 gün, ya da son maçtan 90 gün geçti
      if v_mac > 0 and v_son is not null
         and ((v_skorsuz = 0 and v_bugun > v_son + 45) or v_bugun > v_son + 90) then
        update public.spor_dis_kaynaklar
           set aktif = false, bitis_tarihi = v_bugun, son_calisma = now(),
               son_durum = 'sezon bitti · son maç ' || to_char(v_son, 'DD.MM.YYYY')
                           || case when v_skorsuz > 0 then ' · ' || v_skorsuz || ' maçın sonucu FutAkademi''de hiç girilmedi' else '' end
         where grup_id = k.grup_id;
        perform public.spor_bildirim_grup_yonetimine(
          k.grup_id, 'sezon_bitti', v_grup_adi || ' · ' || k.sezon || ' sezonu FutAkademi taraması tamamlandı',
          'Ligdeki ' || v_mac || ' maçın fikstürü, skoru ve kadrosu işlendi; otomatik tarama bu grup için durdu.'
            || case when v_skorsuz > 0 then ' ' || v_skorsuz || ' maçın sonucu FutAkademi''de hiç girilmedi.' else '' end
            || ' Yeni sezonda lig ve takım kimliği girilince kendiliğinden yeniden başlar.',
          '/yonetim/maclar', 'fa_sezon:' || k.grup_id || ':' || k.sezon);
        v_ozet := v_ozet || jsonb_build_object('sezon_bitti', true);
      else
        update public.spor_dis_kaynaklar
           set son_calisma = now(),
               son_durum = case when jsonb_array_length(v_hatalar) = 0 then 'tamam' else 'kısmi: ' || left(v_hatalar ->> 0, 200) end
         where grup_id = k.grup_id;
      end if;

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

revoke execute on function public.spor_futakademi_senkron(date)   from public, anon, authenticated;
revoke execute on function public.spor_futakademi_zamanlama()     from public, anon, authenticated;
revoke execute on function public.spor_dis_kaynak_zamanla()       from public, anon, authenticated;
revoke execute on function public.spor_dis_kaynak_degisti()       from public, anon, authenticated;
revoke execute on function public.spor_fa_sezon_durumu(text, jsonb) from public, anon, authenticated;

select public.spor_futakademi_zamanlama();

notify pgrst, 'reload schema';
