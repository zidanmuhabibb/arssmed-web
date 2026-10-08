-- M6 · Mesin tes diagnostik four-tier (FR-30…38, FR-41, FR-60, FR-62).
-- Siswa dan guru menulis lewat fungsi di bawah (validasi + aturan penelitian di DB).
-- Klasifikasi dihitung server aplikasi (lib/classification, fungsi murni teruji) lalu disimpan
-- lewat store_classifications yang hanya bisa dipanggil service role.

alter table public.item_responses add column updated_at timestamptz not null default now();
alter table public.test_attempts add column total_items int null;

-- Tes yang dipakai untuk kelas baru: versi aktif terbaru.
create or replace function public.active_test_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select id from public.tests where status = 'active' order by version desc, created_at desc limit 1;
$$;
revoke execute on function public.active_test_id() from public, anon;

-- Butir lengkap? (semua tier wajib terisi sesuai format)
create or replace function public.response_complete(p_content jsonb, r public.item_responses)
returns boolean language sql immutable set search_path = ''
as $$
  select r.tier1_key is not null and r.reason_key is not null and r.confidence_r is not null
     and (p_content->>'format' = 'modified_tier2' or r.confidence_a is not null);
$$;

create or replace function public.attempt_answered(p_attempt uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.item_responses r join public.test_items i on i.id = r.item_id
   where r.attempt_id = p_attempt and public.response_complete(i.content, r);
$$;
revoke execute on function public.attempt_answered(uuid) from public, anon;

-- ---------------------------------------------------------------------------
-- Guru: buka / tutup tes, kemajuan kelas
-- ---------------------------------------------------------------------------

create or replace function public.open_class_test(p_class_id uuid, p_phase text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_mode text; v_test uuid; v_ct uuid;
begin
  if not public.teaches_class(p_class_id) then
    raise exception using message = 'Kelas tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  if p_phase not in ('pre', 'post') then
    raise exception using message = 'Fase tidak dikenal.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  select mode into v_mode from public.classes where id = p_class_id;
  -- FR-62: kelas "Belajar saja" tidak menyimpan data tes penelitian.
  if v_mode <> 'research' then
    raise exception using message = 'Tes diagnostik hanya untuk kelas yang ikut penelitian.', detail = 'learn_only', errcode = 'P0001';
  end if;
  select test_id into v_test from public.class_tests where class_id = p_class_id and phase = p_phase;
  v_test := coalesce(v_test, public.active_test_id());
  if v_test is null then
    raise exception using message = 'Bank soal belum dimuat.', detail = 'no_test', errcode = 'P0001';
  end if;
  -- Pre dan post memakai versi tes yang sama.
  if p_phase = 'post' then
    select coalesce((select test_id from public.class_tests where class_id = p_class_id and phase = 'pre'), v_test) into v_test;
  end if;
  insert into public.class_tests (class_id, test_id, phase, status, opened_at)
  values (p_class_id, v_test, p_phase, 'open', now())
  on conflict (class_id, phase) do update set status = 'open', opened_at = coalesce(public.class_tests.opened_at, now()), closed_at = null
  returning id into v_ct;
  -- FR-38: setelah dibuka ke siswa, butir dibekukan.
  update public.tests set items_frozen = true where id = v_test and not items_frozen;
  perform public.write_audit('class_test.open', 'class_tests', v_ct, jsonb_build_object('phase', p_phase));
end $$;
revoke execute on function public.open_class_test(uuid, text) from public, anon;
grant execute on function public.open_class_test(uuid, text) to authenticated;

create or replace function public.close_class_test(p_class_id uuid, p_phase text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_ct uuid;
begin
  if not public.teaches_class(p_class_id) then
    raise exception using message = 'Kelas tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  update public.class_tests set status = 'closed', closed_at = now()
   where class_id = p_class_id and phase = p_phase and status = 'open'
  returning id into v_ct;
  if v_ct is not null then
    perform public.write_audit('class_test.close', 'class_tests', v_ct, jsonb_build_object('phase', p_phase));
  end if;
end $$;
revoke execute on function public.close_class_test(uuid, text) from public, anon;
grant execute on function public.close_class_test(uuid, text) to authenticated;

-- FR-41: siapa sudah/belum selesai (dibaca berkala oleh dasbor guru).
create or replace function public.class_test_overview(p_class_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_out jsonb := '[]'::jsonb; v_phase text; v_ct public.class_tests%rowtype; v_test uuid;
begin
  if not public.teaches_class(p_class_id) then
    raise exception using message = 'Kelas tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  foreach v_phase in array array['pre', 'post'] loop
    select * into v_ct from public.class_tests where class_id = p_class_id and phase = v_phase;
    v_test := coalesce(v_ct.test_id, public.active_test_id());
    v_out := v_out || jsonb_build_object(
      'phase', v_phase,
      'status', coalesce(v_ct.status, 'draft'),
      'opened_at', v_ct.opened_at,
      'closed_at', v_ct.closed_at,
      'total', (select count(*) from public.test_items where test_id = v_test),
      'students', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id, 'code', s.student_code, 'nickname', s.nickname, 'consent', s.consent_status,
          'started', a.id is not null,
          'submitted', a.submitted_at is not null,
          'answered', case when a.id is null then 0 else public.attempt_answered(a.id) end
        ) order by s.student_code)
        from public.students s
        left join public.test_attempts a on a.student_id = s.id and a.class_test_id = v_ct.id
        where s.class_id = p_class_id), '[]'::jsonb)
    );
  end loop;
  return v_out;
end $$;
revoke execute on function public.class_test_overview(uuid) from public, anon;
grant execute on function public.class_test_overview(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Siswa
-- ---------------------------------------------------------------------------

-- Status pre/post untuk halaman /tes dan Beranda (FR-01, FR-30, FR-60).
create or replace function public.student_tests()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_student uuid := public.require_student();
  s public.students%rowtype; v_mode text; v_out jsonb := '[]'::jsonb; v_phase text; v_ct public.class_tests%rowtype; a public.test_attempts%rowtype;
begin
  select * into s from public.students where id = v_student;
  select mode into v_mode from public.classes where id = s.class_id;
  foreach v_phase in array array['pre', 'post'] loop
    select * into v_ct from public.class_tests where class_id = s.class_id and phase = v_phase;
    select * into a from public.test_attempts where student_id = v_student and class_test_id = v_ct.id;
    v_out := v_out || jsonb_build_object(
      'phase', v_phase,
      'status', coalesce(v_ct.status, 'draft'),
      'blocked', case
        when v_mode <> 'research' then 'learn_only'
        when s.consent_status = 'withdrawn' then 'consent_withdrawn'
        when s.consent_status <> 'granted' then 'consent_pending'
        else null end,
      'attempt', case when a.id is null then null else jsonb_build_object(
        'answered', public.attempt_answered(a.id),
        'total', (select count(*) from public.test_items where test_id = v_ct.test_id),
        'submitted', a.submitted_at is not null) end
    );
  end loop;
  return v_out;
end $$;
revoke execute on function public.student_tests() from public, anon;
grant execute on function public.student_tests() to authenticated;

-- Mulai / lanjutkan percobaan (GET /api/tes/[fase]/mulai).
create or replace function public.start_attempt(p_phase text, p_device text default null)
returns table (attempt_id uuid, test_id uuid, submitted boolean)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.require_student();
  s public.students%rowtype; v_mode text; v_ct public.class_tests%rowtype; a public.test_attempts%rowtype;
begin
  select * into s from public.students where id = v_student;
  select mode into v_mode from public.classes where id = s.class_id;
  select * into v_ct from public.class_tests where class_id = s.class_id and phase = p_phase;
  select * into a from public.test_attempts t where t.student_id = v_student and t.class_test_id = v_ct.id;
  -- Yang sudah selesai tetap melihat layar penutup walau tes sudah ditutup.
  if a.id is not null and a.submitted_at is not null then
    return query select a.id, v_ct.test_id, true;
    return;
  end if;
  if v_ct.id is null or v_ct.status <> 'open' then
    raise exception using message = 'Tes belum dibuka. Tanyakan ke gurumu.', detail = 'closed', errcode = 'P0001';
  end if;
  if v_mode <> 'research' then
    raise exception using message = 'Tes diagnostik hanya untuk kelas penelitian.', detail = 'learn_only', errcode = 'P0001';
  end if;
  -- FR-60: tanpa persetujuan orang tua, siswa tidak mengikuti tes penelitian.
  if s.consent_status <> 'granted' then
    raise exception using message = 'Gurumu perlu mencatat persetujuan orang tuamu dulu.', detail = 'consent', errcode = 'P0001';
  end if;
  if p_device is not null and p_device not in ('android', 'ios', 'desktop', 'other') then
    p_device := 'other';
  end if;
  insert into public.test_attempts (student_id, class_test_id, device_kind, total_items)
  values (v_student, v_ct.id, p_device, (select count(*) from public.test_items i where i.test_id = v_ct.test_id))
  on conflict (student_id, class_test_id) do nothing;
  select * into a from public.test_attempts t where t.student_id = v_student and t.class_test_id = v_ct.id;
  return query select a.id, v_ct.test_id, false;
end $$;
revoke execute on function public.start_attempt(text, text) from public, anon;
grant execute on function public.start_attempt(text, text) to authenticated;

-- Pemeriksaan bersama: percobaan milik siswa ini, belum selesai, tes masih dibuka.
create or replace function public.require_open_attempt(p_attempt uuid)
returns public.test_attempts language plpgsql stable security definer set search_path = ''
as $$
declare a public.test_attempts%rowtype; v_status text;
begin
  select * into a from public.test_attempts where id = p_attempt and student_id = public.require_student();
  if a.id is null then
    raise exception using message = 'Percobaan tes tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  if a.submitted_at is not null then
    raise exception using message = 'Tes sudah diselesaikan.', detail = 'submitted', errcode = 'P0001';
  end if;
  select status into v_status from public.class_tests where id = a.class_test_id;
  if v_status <> 'open' then
    raise exception using message = 'Tes sudah ditutup gurumu.', detail = 'closed', errcode = 'P0001';
  end if;
  return a;
end $$;
revoke execute on function public.require_open_attempt(uuid) from public, anon;

-- Simpan satu butir (PUT /api/tes/attempt/[id]/respons). Idempoten per (percobaan, butir);
-- jawaban dengan cap waktu klien terbaru yang menang (PRD §12.3). Perubahan tercatat (FR-33).
create or replace function public.save_response(
  p_attempt uuid, p_item uuid, p_tier1 text, p_conf_a int, p_reason text, p_conf_r int,
  p_client_ts timestamptz, p_time_ms int default null, p_option_order jsonb default null)
returns text language plpgsql volatile security definer set search_path = ''
as $$
declare
  a public.test_attempts%rowtype := public.require_open_attempt(p_attempt);
  v_test uuid; c jsonb; v_levels int; v_rows int;
begin
  select test_id into v_test from public.class_tests where id = a.class_test_id;
  select content into c from public.test_items where id = p_item and test_id = v_test;
  if c is null then
    raise exception using message = 'Butir tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  v_levels := jsonb_array_length(c->'confidence'->'levels');
  if (p_tier1 is not null and not exists (select 1 from jsonb_array_elements(c->'tier1'->'options') o where o->>'key' = p_tier1))
     or (p_reason is not null and not exists (select 1 from jsonb_array_elements(c->'reason'->'options') o where o->>'key' = p_reason))
     or (p_conf_a is not null and (p_conf_a < 0 or p_conf_a >= v_levels or c->>'format' = 'modified_tier2'))
     or (p_conf_r is not null and (p_conf_r < 0 or p_conf_r >= v_levels))
     or (p_time_ms is not null and p_time_ms < 0) then
    raise exception using message = 'Jawaban tidak valid.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  insert into public.item_responses as r (attempt_id, item_id, tier1_key, confidence_a, reason_key, confidence_r,
    client_timestamp, response_time_ms, option_order, answered_at, updated_at)
  values (p_attempt, p_item, p_tier1, p_conf_a, p_reason, p_conf_r, p_client_ts, p_time_ms, p_option_order, now(), now())
  on conflict (attempt_id, item_id) do update set
    tier1_key = excluded.tier1_key, confidence_a = excluded.confidence_a,
    reason_key = excluded.reason_key, confidence_r = excluded.confidence_r,
    client_timestamp = excluded.client_timestamp,
    response_time_ms = coalesce(excluded.response_time_ms, r.response_time_ms),
    option_order = coalesce(r.option_order, excluded.option_order),
    updated_at = now()
  where r.client_timestamp is null or excluded.client_timestamp is null or r.client_timestamp <= excluded.client_timestamp;
  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'saved' else 'stale' end;
end $$;
revoke execute on function public.save_response(uuid, uuid, text, int, text, int, timestamptz, int, jsonb) from public, anon;
grant execute on function public.save_response(uuid, uuid, text, int, text, int, timestamptz, int, jsonb) to authenticated;

-- Selesaikan (POST /api/tes/attempt/[id]/selesai). Butir yang belum lengkap dikembalikan, bukan diabaikan.
create or replace function public.submit_attempt(p_attempt uuid)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $$
declare
  a public.test_attempts%rowtype := public.require_open_attempt(p_attempt);
  v_test uuid; v_missing int[];
begin
  select test_id into v_test from public.class_tests where id = a.class_test_id;
  select coalesce(array_agg(i.item_order order by i.item_order), '{}') into v_missing
    from public.test_items i
    left join public.item_responses r on r.item_id = i.id and r.attempt_id = p_attempt
   where i.test_id = v_test and (r.id is null or not public.response_complete(i.content, r));
  if array_length(v_missing, 1) > 0 then
    return jsonb_build_object('ok', false, 'missing', to_jsonb(v_missing));
  end if;
  update public.test_attempts set submitted_at = now() where id = p_attempt;
  return jsonb_build_object('ok', true, 'missing', '[]'::jsonb);
end $$;
revoke execute on function public.submit_attempt(uuid) from public, anon;
grant execute on function public.submit_attempt(uuid) to authenticated;

-- Klasifikasi dari server aplikasi (service role saja; PRD §10: dihitung di server).
create or replace function public.store_classifications(p_attempt uuid, p_rule_set text, p_rows jsonb)
returns int language plpgsql volatile security definer set search_path = ''
as $$
declare v_rs uuid; v_n int;
begin
  select id into v_rs from public.rule_sets where rule_set_id = p_rule_set;
  if v_rs is null then
    raise exception using message = 'Aturan klasifikasi tidak dikenal.', detail = 'not_found', errcode = 'P0002';
  end if;
  insert into public.classifications (item_response_id, rule_set_id, a_correct, r_correct, confident, confident_a, confident_r, category, computed_at)
  select r.id, v_rs, (x->>'a_correct')::boolean, (x->>'r_correct')::boolean, (x->>'confident')::boolean,
         (x->>'confident_a')::boolean, (x->>'confident_r')::boolean, x->>'category', now()
    from jsonb_array_elements(p_rows) x
    join public.item_responses r on r.attempt_id = p_attempt and r.item_id = (x->>'item_id')::uuid
  on conflict (item_response_id, rule_set_id) do update set
    a_correct = excluded.a_correct, r_correct = excluded.r_correct, confident = excluded.confident,
    confident_a = excluded.confident_a, confident_r = excluded.confident_r, category = excluded.category, computed_at = now();
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.store_classifications(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.store_classifications(uuid, text, jsonb) to service_role;
