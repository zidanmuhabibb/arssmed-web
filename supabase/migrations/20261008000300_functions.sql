-- ARSSMED Web — fungsi (RPC) dan pemicu.
-- Semua fungsi SECURITY DEFINER memakai search_path kosong dan nama tabel lengkap.
-- Pesan galat berbahasa Indonesia di `message`; kode mesin di `detail` (dipetakan oleh server).

-- ---------------------------------------------------------------------------
-- Pembangkit kode
-- ---------------------------------------------------------------------------

-- Alfabet tanpa huruf/angka yang mudah tertukar (0/O, 1/I/L).
create or replace function public.random_code(p_len int, p_alphabet text default 'ABCDEFGHJKMNPQRSTUVWXYZ23456789')
returns text language plpgsql volatile set search_path = ''
as $$
declare
  bytes bytea := extensions.gen_random_bytes(p_len);
  out text := '';
  n int := length(p_alphabet);
begin
  for i in 0 .. p_len - 1 loop
    out := out || substr(p_alphabet, (get_byte(bytes, i) % n) + 1, 1);
  end loop;
  return out;
end $$;

create or replace function public.gen_join_code()
returns text language sql volatile set search_path = ''
as $$ select public.random_code(6) $$;

alter table public.classes alter column join_code set default public.gen_join_code();

create or replace function public.gen_pseudo_id()
returns text language sql volatile set search_path = ''
as $$ select 'P-' || public.random_code(8) $$;

-- PIN 4 digit dari 3 byte acak kriptografis (bias modulo ≈ 0,004%).
create or replace function public.gen_pin()
returns text language plpgsql volatile set search_path = ''
as $$
declare b bytea := extensions.gen_random_bytes(3);
begin
  return lpad((((get_byte(b, 0) << 16) | (get_byte(b, 1) << 8) | get_byte(b, 2)) % 10000)::text, 4, '0');
end $$;

create or replace function public.hash_pin(p_pin text)
returns text language sql volatile set search_path = ''
as $$ select extensions.crypt(p_pin, extensions.gen_salt('bf', 10)) $$;

revoke execute on function public.hash_pin(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

create or replace function public.write_audit(p_action text, p_entity text, p_entity_id uuid, p_meta jsonb default '{}'::jsonb)
returns void language sql volatile security definer set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity, entity_id, meta)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb));
$$;
revoke execute on function public.write_audit(text, text, uuid, jsonb) from public, anon, authenticated;

-- Hapus siswa = hapus kaskade + catatan audit tanpa data pribadi (PRD §10, FR-61).
create or replace function public.trg_students_audit_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.write_audit('student.delete', 'students', old.id, jsonb_build_object('class_id', old.class_id));
  return old;
end $$;
create trigger students_audit_delete after delete on public.students
  for each row execute function public.trg_students_audit_delete();

-- ---------------------------------------------------------------------------
-- Profil guru otomatis untuk akun Auth non-siswa
-- ---------------------------------------------------------------------------

create or replace function public.trg_handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Akun siswa dibuat server dengan app_metadata.kind = 'student' dan tidak mendapat profil staf.
  if coalesce(new.raw_app_meta_data ->> 'kind', '') <> 'student' then
    insert into public.profiles (id, role, full_name)
    values (new.id, 'teacher', nullif(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.trg_handle_new_user();

-- ---------------------------------------------------------------------------
-- Kelola siswa (guru kelas / admin)
-- ---------------------------------------------------------------------------

/*
  Membuat siswa dari daftar impor. p_rows = [{"code": "S01"|null, "nickname": "Raka"|null}, ...]
  Kode kosong → dibuat otomatis (S01, S02, …, melanjutkan nomor terbesar di kelas).
  Mengembalikan PIN dalam bentuk teks SEKALI saja (untuk kartu masuk); yang disimpan hanya hash.
*/
create or replace function public.create_students(p_class_id uuid, p_rows jsonb)
returns table (student_id uuid, student_code text, nickname text, pseudo_id text, pin text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r jsonb;
  v_code text;
  v_nick text;
  v_pin text;
  v_next int;
  v_seen text[] := '{}';
  v_count int := 0;
begin
  if not public.teaches_class(p_class_id) then
    raise exception using message = 'Anda tidak punya akses ke kelas ini.', detail = 'forbidden', errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception using message = 'Daftar siswa kosong.', detail = 'empty', errcode = 'P0001';
  end if;
  if jsonb_array_length(p_rows) + (select count(*) from public.students s where s.class_id = p_class_id) > 60 then
    raise exception using message = 'Satu kelas paling banyak 60 siswa.', detail = 'too_many', errcode = 'P0001';
  end if;

  select coalesce(max((regexp_match(s.student_code, '^S([0-9]+)$'))[1]::int), 0) + 1 into v_next
  from public.students s where s.class_id = p_class_id;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_code := upper(nullif(btrim(r ->> 'code'), ''));
    v_nick := nullif(btrim(r ->> 'nickname'), '');

    if v_code is null then
      loop
        v_code := 'S' || lpad(v_next::text, 2, '0');
        v_next := v_next + 1;
        exit when not (v_code = any (v_seen))
          and not exists (select 1 from public.students s where s.class_id = p_class_id and s.student_code = v_code);
      end loop;
    end if;

    if v_code !~ '^[A-Z0-9-]{1,12}$' then
      raise exception using message = format('Kode siswa tidak valid: %s. Pakai huruf, angka, atau tanda hubung (maks. 12).', v_code),
        detail = 'invalid_code', errcode = 'P0001';
    end if;
    if v_code = any (v_seen)
       or exists (select 1 from public.students s where s.class_id = p_class_id and s.student_code = v_code) then
      raise exception using message = format('Kode siswa sudah dipakai: %s.', v_code), detail = 'duplicate_code', errcode = 'P0001';
    end if;
    if v_nick is not null and length(v_nick) > 30 then
      raise exception using message = format('Nama panggilan terlalu panjang (maks. 30 huruf): %s', left(v_nick, 30)),
        detail = 'nickname_too_long', errcode = 'P0001';
    end if;
    v_seen := v_seen || v_code;

    v_pin := public.gen_pin();
    insert into public.students (class_id, student_code, nickname, pin_hash, pseudo_id)
    values (p_class_id, v_code, v_nick, public.hash_pin(v_pin), public.gen_pseudo_id())
    returning students.id, students.student_code, students.nickname, students.pseudo_id
      into student_id, student_code, nickname, pseudo_id;
    pin := v_pin;
    v_count := v_count + 1;
    return next;
  end loop;

  perform public.write_audit('students.create', 'classes', p_class_id, jsonb_build_object('count', v_count));
end $$;
revoke execute on function public.create_students(uuid, jsonb) from public, anon;
grant execute on function public.create_students(uuid, jsonb) to authenticated;

create or replace function public.reset_student_pin(p_student_id uuid)
returns text language plpgsql volatile security definer set search_path = ''
as $$
declare v_class uuid; v_pin text;
begin
  select s.class_id into v_class from public.students s where s.id = p_student_id;
  if v_class is null or not public.teaches_class(v_class) then
    raise exception using message = 'Siswa tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  v_pin := public.gen_pin();
  update public.students set pin_hash = public.hash_pin(v_pin) where id = p_student_id;
  perform public.write_audit('student.reset_pin', 'students', p_student_id);
  return v_pin;
end $$;
revoke execute on function public.reset_student_pin(uuid) from public, anon;
grant execute on function public.reset_student_pin(uuid) to authenticated;

-- Persetujuan diisi guru/peneliti, bukan siswa (FR-60).
create or replace function public.set_consent(p_student_id uuid, p_status text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare v_class uuid;
begin
  if p_status not in ('pending', 'granted', 'withdrawn') then
    raise exception using message = 'Status persetujuan tidak dikenal.', detail = 'invalid_status', errcode = 'P0001';
  end if;
  select s.class_id into v_class from public.students s where s.id = p_student_id;
  if v_class is null or not public.teaches_class(v_class) then
    raise exception using message = 'Siswa tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  update public.students
     set consent_status = p_status,
         consent_recorded_by = auth.uid(),
         consent_recorded_at = now(),
         withdrawn_at = case when p_status = 'withdrawn' then now() else null end
   where id = p_student_id;
  perform public.write_audit('student.consent', 'students', p_student_id, jsonb_build_object('status', p_status));
end $$;
revoke execute on function public.set_consent(uuid, text) from public, anon;
grant execute on function public.set_consent(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Masuk siswa (dipanggil server dengan service role; tidak untuk klien)
-- ---------------------------------------------------------------------------

/*
  Verifikasi kode kelas + kode siswa + PIN, dengan pembatasan laju:
  maksimal 5 percobaan gagal per (kode kelas, kode siswa) dalam 10 menit sejak masuk berhasil terakhir.
  Status: 'ok' | 'invalid' | 'rate_limited'. Tidak membedakan "kelas salah" vs "PIN salah" (anti-enumerasi).
*/
create or replace function public.student_login(p_join_code text, p_student_code text, p_pin text)
returns table (status text, student_id uuid, auth_user_id uuid, retry_after_seconds int)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_join text := upper(btrim(coalesce(p_join_code, '')));
  v_code text := upper(btrim(coalesce(p_student_code, '')));
  v_window interval := interval '10 minutes';
  v_last_ok timestamptz;
  v_fail int;
  v_oldest timestamptz;
  v_student public.students%rowtype;
  v_ok boolean := false;
begin
  select max(a.created_at) into v_last_ok from public.student_login_attempts a
   where a.join_code = v_join and a.student_code = v_code and a.succeeded;

  select count(*), min(a.created_at) into v_fail, v_oldest from public.student_login_attempts a
   where a.join_code = v_join and a.student_code = v_code and not a.succeeded
     and a.created_at > now() - v_window
     and (v_last_ok is null or a.created_at > v_last_ok);

  if v_fail >= 5 then
    status := 'rate_limited';
    retry_after_seconds := greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::int);
    return next;
    return;
  end if;

  select s.* into v_student
    from public.students s join public.classes c on c.id = s.class_id
   where c.join_code = v_join and s.student_code = v_code;

  if found then
    v_ok := p_pin ~ '^[0-9]{4}$' and extensions.crypt(p_pin, v_student.pin_hash) = v_student.pin_hash;
  else
    -- Samakan waktu respons dengan kasus siswa ditemukan.
    perform extensions.crypt(coalesce(p_pin, ''), extensions.gen_salt('bf', 10));
  end if;

  insert into public.student_login_attempts (join_code, student_code, succeeded) values (v_join, v_code, v_ok);

  if v_ok then
    status := 'ok';
    student_id := v_student.id;
    auth_user_id := v_student.auth_user_id;
  else
    status := 'invalid';
  end if;
  return next;
end $$;
revoke execute on function public.student_login(text, text, text) from public, anon, authenticated;
grant execute on function public.student_login(text, text, text) to service_role;

create or replace function public.link_student_auth_user(p_student_id uuid, p_auth_user_id uuid)
returns void language sql volatile security definer set search_path = ''
as $$
  update public.students set auth_user_id = p_auth_user_id where id = p_student_id and auth_user_id is null;
$$;
revoke execute on function public.link_student_auth_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_student_auth_user(uuid, uuid) to service_role;

-- Bersihkan catatan percobaan lama (dipanggil terjadwal atau manual).
create or replace function public.purge_login_attempts(p_older_than interval default interval '1 day')
returns int language sql volatile security definer set search_path = ''
as $$
  with d as (delete from public.student_login_attempts where created_at < now() - p_older_than returning 1)
  select count(*)::int from d;
$$;
revoke execute on function public.purge_login_attempts(interval) from public, anon, authenticated;
grant execute on function public.purge_login_attempts(interval) to service_role;

-- ---------------------------------------------------------------------------
-- Integritas asesmen
-- ---------------------------------------------------------------------------

-- FR-38: butir tes beku tidak boleh diubah; buat versi tes baru.
create or replace function public.trg_test_items_frozen()
returns trigger language plpgsql set search_path = ''
as $$
declare v_frozen boolean;
begin
  select t.items_frozen into v_frozen from public.tests t where t.id = coalesce(new.test_id, old.test_id);
  if v_frozen then
    raise exception using message = 'Butir tes sudah dibekukan. Buat versi tes baru untuk mengubahnya.',
      detail = 'items_frozen', errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger test_items_frozen before insert or update or delete on public.test_items
  for each row execute function public.trg_test_items_frozen();

-- FR-33: setiap perubahan jawaban dicatat dengan cap waktu.
create or replace function public.trg_item_responses_audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare f text; o text; n text; changed int := 0;
begin
  foreach f in array array['tier1_key', 'reason_key', 'confidence_a', 'confidence_r'] loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f) into o, n using old, new;
    if o is distinct from n then
      insert into public.response_events (item_response_id, field, old_value, new_value) values (new.id, f, o, n);
      changed := changed + 1;
    end if;
  end loop;
  if changed > 0 and tg_op = 'UPDATE' then
    new.answer_changes := old.answer_changes + 1;
  end if;
  return new;
end $$;
create trigger item_responses_audit before update on public.item_responses
  for each row execute function public.trg_item_responses_audit();
