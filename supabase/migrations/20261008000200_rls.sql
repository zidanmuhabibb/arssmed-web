-- ARSSMED Web — fungsi bantu otorisasi dan kebijakan RLS (PRD §9.2 prinsip 3).
--
-- Peran:
--   admin   : profiles.role = 'admin'   → semua baris
--   guru    : profiles.role = 'teacher' → hanya kelasnya sendiri
--   siswa   : students.auth_user_id = auth.uid() → hanya datanya sendiri
--   anon    : hanya konten belajar publik
--
-- Fungsi bantu SECURITY DEFINER agar kebijakan tidak saling memicu RLS (rekursi).

-- ---------------------------------------------------------------------------
-- Fungsi bantu
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('teacher', 'admin'));
$$;

create or replace function public.teaches_class(p_class_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.classes c where c.id = p_class_id and c.teacher_id = auth.uid())
      or public.is_admin();
$$;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.id from public.students s where auth.uid() is not null and s.auth_user_id = auth.uid();
$$;

create or replace function public.current_student_class_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.class_id from public.students s where auth.uid() is not null and s.auth_user_id = auth.uid();
$$;

create or replace function public.student_class_id(p_student_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select s.class_id from public.students s where s.id = p_student_id;
$$;

create or replace function public.attempt_student_id(p_attempt_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select a.student_id from public.test_attempts a where a.id = p_attempt_id;
$$;

create or replace function public.response_attempt_id(p_item_response_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select r.attempt_id from public.item_responses r where r.id = p_item_response_id;
$$;

-- ---------------------------------------------------------------------------
-- Hak kolom (Supabase memberi ALL pada tabel baru ke anon/authenticated secara bawaan)
-- ---------------------------------------------------------------------------

-- Tidak ada akses klien langsung ke tabel-tabel ini; hanya lewat fungsi SECURITY DEFINER.
revoke all on public.student_login_attempts from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated; -- dibatasi kebijakan: admin saja

-- Siswa: pin_hash dan auth_user_id tidak pernah terbaca klien; tulis hanya lewat fungsi.
revoke all on public.students from anon, authenticated;
grant select (id, created_at, class_id, student_code, nickname, pseudo_id, consent_status,
              consent_recorded_by, consent_recorded_at, withdrawn_at)
  on public.students to authenticated;
grant update (nickname) on public.students to authenticated;
grant delete on public.students to authenticated;

-- Profil: pengguna hanya boleh mengubah nama; peran diubah admin lewat SQL/service role.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Kelas: join_code dan mode diubah lewat kolom yang diizinkan; teacher_id tidak bisa dipindah klien.
revoke insert, update on public.classes from anon, authenticated;
grant insert (name, grade, academic_year, school_id, mode, teacher_id) on public.classes to authenticated;
grant update (name, grade, academic_year, mode) on public.classes to authenticated;

-- Anon tidak menyentuh data asesmen/aktivitas sama sekali.
revoke all on public.schools, public.classes, public.rule_sets, public.tests, public.test_items,
  public.class_tests, public.test_attempts, public.item_responses, public.response_events,
  public.classifications, public.unit_progress, public.prediction_responses, public.object_views,
  public.discussion_marks from anon;

-- Klasifikasi & jawaban ditulis server (service role) — tidak ada tulis dari klien di M2.
revoke insert, update, delete on public.test_attempts, public.item_responses, public.response_events,
  public.classifications from authenticated;

-- ---------------------------------------------------------------------------
-- Kebijakan
-- ---------------------------------------------------------------------------

-- schools
create policy schools_select on public.schools for select to authenticated using (true);
create policy schools_admin_write on public.schools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- classes
create policy classes_select on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin() or id = public.current_student_class_id());
create policy classes_insert on public.classes for insert to authenticated
  with check (public.is_staff() and (teacher_id = auth.uid() or public.is_admin()));
create policy classes_update on public.classes for update to authenticated
  using (public.teaches_class(id)) with check (public.teaches_class(id));
create policy classes_delete on public.classes for delete to authenticated
  using (public.teaches_class(id));

-- students
create policy students_select on public.students for select to authenticated
  using (public.teaches_class(class_id) or id = public.current_student_id());
create policy students_update on public.students for update to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));
create policy students_delete on public.students for delete to authenticated
  using (public.teaches_class(class_id));

-- konten belajar: baca publik, tulis admin
do $$
declare t text;
begin
  foreach t in array array['units', 'misconception_targets', 'ar_objects', 'annotations', 'prediction_items', 'practice_items'] loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_write', t);
  end loop;
end $$;

-- bank soal & aturan: staf baca, admin tulis. Siswa TIDAK membaca test_items (kunci jawaban, PRD §9.2 prinsip 4).
do $$
declare t text;
begin
  foreach t in array array['rule_sets', 'tests', 'test_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t || '_select', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t || '_admin_write', t);
  end loop;
end $$;

-- class_tests: guru kelas kelola; siswa hanya melihat status tes kelasnya
create policy class_tests_select on public.class_tests for select to authenticated
  using (public.teaches_class(class_id) or class_id = public.current_student_class_id());
create policy class_tests_write on public.class_tests for all to authenticated
  using (public.teaches_class(class_id)) with check (public.teaches_class(class_id));

-- test_attempts / item_responses: siswa baca miliknya, guru baca kelasnya
create policy test_attempts_select on public.test_attempts for select to authenticated
  using (student_id = public.current_student_id() or public.teaches_class(public.student_class_id(student_id)));
create policy item_responses_select on public.item_responses for select to authenticated
  using (
    public.attempt_student_id(attempt_id) = public.current_student_id()
    or public.teaches_class(public.student_class_id(public.attempt_student_id(attempt_id)))
  );
create policy response_events_select on public.response_events for select to authenticated
  using (public.teaches_class(public.student_class_id(public.attempt_student_id(public.response_attempt_id(item_response_id)))));

-- classifications: TIDAK untuk siswa (FR-36: hasil tidak ditampilkan ke siswa)
create policy classifications_select on public.classifications for select to authenticated
  using (public.teaches_class(public.student_class_id(public.attempt_student_id(public.response_attempt_id(item_response_id)))));

-- aktivitas belajar: siswa baca/tambah miliknya, guru baca kelasnya
do $$
declare t text;
begin
  foreach t in array array['unit_progress', 'prediction_responses', 'object_views', 'discussion_marks'] loop
    execute format('create policy %I on public.%I for select to authenticated using (student_id = public.current_student_id() or public.teaches_class(public.student_class_id(student_id)))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (student_id = public.current_student_id())', t || '_insert_own', t);
  end loop;
end $$;
revoke update, delete on public.unit_progress, public.prediction_responses, public.object_views, public.discussion_marks from authenticated;

-- audit_log: admin saja
create policy audit_log_select on public.audit_log for select to authenticated using (public.is_admin());
