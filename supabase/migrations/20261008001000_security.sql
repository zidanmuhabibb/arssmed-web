-- M8 · Keamanan (PRD §12.4): pembatasan laju endpoint tes & riset, pemetaan kode samaran → nama
-- (admin, tercatat), dan penghapusan data penelitian siswa yang menarik persetujuan.

-- ---------------------------------------------------------------------------
-- Pembatasan laju: jendela tetap per kunci. Batas ditentukan DI SINI (bukan oleh pemanggil).
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security; -- tanpa kebijakan: tertutup
revoke all on public.rate_limits from anon, authenticated;

create or replace function public.hit_rate_limit(p_key text, p_max int, p_window_seconds int)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_start timestamptz; v_hits int;
begin
  v_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limits as r (key, window_start, hits) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  -- Bersihkan jendela lama sesekali (murah, tanpa penjadwal).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  if v_hits > p_max then
    raise exception using message = 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.', detail = 'rate_limited', errcode = 'P0001';
  end if;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;

-- Dipanggil server aplikasi sebelum pekerjaan berat; kunci = cakupan + pengguna saat ini.
create or replace function public.consume_rate_limit(p_scope text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_max int; v_window int;
begin
  select l.max, l.win into v_max, v_window from (values
    ('tes_start', 30, 60),
    ('tes_save', 300, 60),
    ('tes_submit', 20, 60),
    ('riset_read', 60, 60),
    ('riset_export', 20, 600),
    ('riset_name_map', 5, 600)
  ) as l(scope, max, win) where l.scope = p_scope;
  if v_max is null then
    raise exception using message = 'Cakupan tidak dikenal.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  perform public.hit_rate_limit(p_scope || ':' || coalesce(auth.uid()::text, 'anon'), v_max, v_window);
end $$;
revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

-- Pertahanan berlapis: save_response bisa dipanggil langsung lewat PostgREST, jadi batasi juga di tabel.
create or replace function public.trg_item_responses_rate()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.hit_rate_limit('save_db:' || new.attempt_id::text, 400, 60);
  return new;
end $$;
create trigger item_responses_rate before insert on public.item_responses
  for each row execute function public.trg_item_responses_rate();

-- ---------------------------------------------------------------------------
-- PRD §7.4: pemetaan student_pseudo_id → kode/nama panggilan, hanya admin, tercatat di audit.
-- ---------------------------------------------------------------------------
create or replace function public.research_name_map(p_class_id uuid default null)
returns table (pseudo_id text, class_name text, student_code text, nickname text, consent text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'Hanya peneliti yang bisa mengunduh pemetaan nama.', detail = 'forbidden', errcode = '42501';
  end if;
  return query
    select s.pseudo_id, c.name, s.student_code, s.nickname, s.consent_status
      from public.students s join public.classes c on c.id = s.class_id
     where (p_class_id is null or s.class_id = p_class_id) and c.mode = 'research'
     order by c.name, s.student_code;
end $$;
revoke execute on function public.research_name_map(uuid) from public, anon;
grant execute on function public.research_name_map(uuid) to authenticated;

-- Fungsi `stable` tidak boleh menulis; audit dicatat terpisah oleh server sebelum data dikirim.
create or replace function public.log_name_map(p_class_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'Hanya peneliti yang bisa mengunduh pemetaan nama.', detail = 'forbidden', errcode = '42501';
  end if;
  perform public.write_audit('export.name_map', 'classes', p_class_id, '{}'::jsonb);
end $$;
revoke execute on function public.log_name_map(uuid) from public, anon;
grant execute on function public.log_name_map(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- PRD §12.4 / FR-61: hapus data tes siswa yang menarik persetujuan (admin atau penjadwal service role).
-- Siswa tetap ada (boleh tetap belajar); jawaban, klasifikasi, dan riwayat perubahannya dihapus.
-- ---------------------------------------------------------------------------
create or replace function public.purge_withdrawn_research_data(p_older_than interval default interval '0')
returns int language plpgsql volatile security definer set search_path = ''
as $$
declare v_n int;
begin
  -- Admin, service role, atau penjadwal basis data (pg_cron: tanpa JWT, sesi postgres).
  if not (public.is_admin() or auth.role() = 'service_role' or (auth.role() is null and session_user = 'postgres')) then
    raise exception using message = 'Hanya peneliti.', detail = 'forbidden', errcode = '42501';
  end if;
  with d as (
    delete from public.test_attempts a using public.students s
     where s.id = a.student_id and s.consent_status = 'withdrawn'
       and coalesce(s.withdrawn_at, s.consent_recorded_at, now()) <= now() - p_older_than
    returning a.student_id
  )
  select count(distinct student_id)::int into v_n from d;
  perform public.write_audit('purge.withdrawn', 'students', null, jsonb_build_object('students', v_n, 'older_than', p_older_than::text));
  return v_n;
end $$;
revoke execute on function public.purge_withdrawn_research_data(interval) from public, anon;
grant execute on function public.purge_withdrawn_research_data(interval) to authenticated, service_role;
