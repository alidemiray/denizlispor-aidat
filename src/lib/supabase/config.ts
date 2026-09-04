// Supabase bağlantı bilgileri.
// Publishable (anon) anahtar tarayıcıda görünmek üzere tasarlanmıştır;
// asıl güvenlik veritabanındaki RLS politikalarıyla sağlanır.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://uoesccavfuthvwuchelj.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_Xe-A2kqerV1m741CWXbydg_dkpUYA70";
