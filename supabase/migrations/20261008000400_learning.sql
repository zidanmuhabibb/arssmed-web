-- M4 · Alur belajar Tebak → Amati → Bandingkan → Jelaskan (PRD §4.2, FR-20…24).
-- Siswa menulis aktivitas belajar HANYA lewat fungsi di bawah (urutan langkah & validasi
-- ditegakkan di DB, bukan di klien). Isi konten di-upsert oleh migrasi *_content.sql.

-- ---------------------------------------------------------------------------
-- Skema
-- ---------------------------------------------------------------------------

-- FR-22: guru dapat mengaktifkan mode "bebas" (tombol lanjut Amati selalu aktif).
alter table public.classes add column free_explore boolean not null default false;
grant update (free_explore) on public.classes to authenticated;

-- Soal "Tebak dulu" dikenali dengan kunci stabil dari content/learning.json.
alter table public.prediction_items
  add column key text,
  add column sort_order int not null default 0,
  add column misconception_option text null;
alter table public.prediction_items add constraint prediction_items_key_unique unique (key);
alter table public.prediction_items alter column key set not null;

-- Tebakan pertama yang berlaku (bahan penelitian: konsepsi awal sebelum mengamati).
alter table public.prediction_responses
  add constraint prediction_responses_once unique (student_id, prediction_item_id);
alter table public.discussion_marks
  add constraint discussion_marks_once unique (student_id, unit_id);
create index object_views_student_idx on public.object_views (student_id, ar_object_id);

-- Tulis langsung dari klien ditutup; pakai fungsi (validasi + urutan langkah).
revoke insert on public.unit_progress, public.prediction_responses, public.object_views,
  public.discussion_marks from authenticated;

-- ---------------------------------------------------------------------------
-- Fungsi bantu
-- ---------------------------------------------------------------------------

create or replace function public.require_student()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare v uuid := public.current_student_id();
begin
  if v is null then
    raise exception using message = 'Masuk sebagai siswa untuk menyimpan kemajuan.', detail = 'forbidden', errcode = 'P0001';
  end if;
  return v;
end $$;
revoke execute on function public.require_student() from public, anon;

create or replace function public.unit_by_slug(p_slug text)
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare v uuid;
begin
  select id into v from public.units where slug = p_slug;
  if v is null then
    raise exception using message = 'Unit tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  return v;
end $$;
revoke execute on function public.unit_by_slug(text) from public, anon;

create or replace function public.step_done(p_student uuid, p_unit uuid, p_step text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.unit_progress where student_id = p_student and unit_id = p_unit and step = p_step);
$$;
revoke execute on function public.step_done(uuid, uuid, text) from public, anon;

-- ---------------------------------------------------------------------------
-- API siswa
-- ---------------------------------------------------------------------------

-- Status belajar siswa saat ini (satu panggilan untuk semua unit).
create or replace function public.learning_state()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_student uuid := public.require_student();
begin
  return jsonb_build_object(
    'free_explore', coalesce((select c.free_explore from public.students s join public.classes c on c.id = s.class_id where s.id = v_student), false),
    'steps', coalesce((
      select jsonb_object_agg(slug, steps) from (
        select u.slug, jsonb_agg(p.step order by p.completed_at) as steps
          from public.unit_progress p join public.units u on u.id = p.unit_id
         where p.student_id = v_student group by u.slug) x), '{}'::jsonb),
    'predictions', coalesce((
      select jsonb_object_agg(i.key, r.selected_key)
        from public.prediction_responses r join public.prediction_items i on i.id = r.prediction_item_id
       where r.student_id = v_student), '{}'::jsonb),
    'viewed', coalesce((
      select jsonb_object_agg(slug, objs) from (
        select u.slug, jsonb_agg(distinct o.slug) as objs
          from public.object_views v join public.ar_objects o on o.id = v.ar_object_id join public.units u on u.id = o.unit_id
         where v.student_id = v_student group by u.slug) x), '{}'::jsonb),
    'discussed', coalesce((
      select jsonb_agg(u.slug) from public.discussion_marks d join public.units u on u.id = d.unit_id
       where d.student_id = v_student), '[]'::jsonb)
  );
end $$;
revoke execute on function public.learning_state() from public, anon;
grant execute on function public.learning_state() to authenticated;

-- FR-21: simpan tebakan. Jawaban pertama yang berlaku; kembalikan jawaban yang tersimpan.
create or replace function public.save_prediction(p_key text, p_option text)
returns text language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.require_student();
  v_item public.prediction_items%rowtype;
  v_saved text;
begin
  select * into v_item from public.prediction_items where key = p_key;
  if v_item.id is null then
    raise exception using message = 'Pertanyaan tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_item.options) o where o->>'key' = p_option) then
    raise exception using message = 'Pilihan tidak dikenal.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  insert into public.prediction_responses (student_id, prediction_item_id, selected_key)
  values (v_student, v_item.id, p_option)
  on conflict (student_id, prediction_item_id) do nothing;
  select selected_key into v_saved from public.prediction_responses where student_id = v_student and prediction_item_id = v_item.id;
  return v_saved;
end $$;
revoke execute on function public.save_prediction(text, text) from public, anon;
grant execute on function public.save_prediction(text, text) to authenticated;

-- FR-22: catat objek yang dibuka (mode 3d/ar_surface/ar_marker).
create or replace function public.record_object_view(p_unit text, p_object text, p_mode text default '3d')
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.require_student();
  v_obj uuid;
begin
  select o.id into v_obj from public.ar_objects o where o.unit_id = public.unit_by_slug(p_unit) and o.slug = p_object;
  if v_obj is null then
    raise exception using message = 'Objek tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
  end if;
  if p_mode not in ('3d', 'ar_surface', 'ar_marker') then
    raise exception using message = 'Mode tidak dikenal.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  insert into public.object_views (student_id, ar_object_id, mode) values (v_student, v_obj, p_mode);
end $$;
revoke execute on function public.record_object_view(text, text, text) from public, anon;
grant execute on function public.record_object_view(text, text, text) to authenticated;

-- FR-20…24: tandai langkah selesai. Urutan Tebak → Amati → Bandingkan → Jelaskan ditegakkan.
create or replace function public.complete_step(p_unit text, p_step text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.require_student();
  v_unit uuid := public.unit_by_slug(p_unit);
  v_order text[] := array['tebak', 'amati', 'bandingkan', 'jelaskan'];
  v_idx int := array_position(v_order, p_step);
  v_free boolean;
begin
  if v_idx is null then
    raise exception using message = 'Langkah tidak dikenal.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  if public.step_done(v_student, v_unit, p_step) then
    return; -- idempoten
  end if;
  for i in 1 .. v_idx - 1 loop
    if not public.step_done(v_student, v_unit, v_order[i]) then
      raise exception using message = 'Selesaikan langkah sebelumnya dulu.', detail = 'locked', errcode = 'P0001';
    end if;
  end loop;

  if p_step = 'tebak' and exists (
    select 1 from public.prediction_items i
     where i.unit_id = v_unit
       and not exists (select 1 from public.prediction_responses r where r.prediction_item_id = i.id and r.student_id = v_student)
  ) then
    raise exception using message = 'Jawab semua pertanyaan Tebak dulu.', detail = 'locked', errcode = 'P0001';
  end if;

  if p_step = 'amati' then
    select c.free_explore into v_free from public.students s join public.classes c on c.id = s.class_id where s.id = v_student;
    if not coalesce(v_free, false) and exists (
      select 1 from public.ar_objects o
       where o.unit_id = v_unit and o.required
         and not exists (select 1 from public.object_views v where v.ar_object_id = o.id and v.student_id = v_student)
    ) then
      raise exception using message = 'Lihat semua benda di Rel Orbit dulu.', detail = 'locked', errcode = 'P0001';
    end if;
  end if;

  insert into public.unit_progress (student_id, unit_id, step) values (v_student, v_unit, p_step)
  on conflict (student_id, unit_id, step) do nothing;
end $$;
revoke execute on function public.complete_step(text, text) from public, anon;
grant execute on function public.complete_step(text, text) to authenticated;

-- FR-24: "Sudah kudiskusikan" — penanda diskusi (bukan penilaian) sekaligus menyelesaikan Jelaskan.
create or replace function public.mark_discussed(p_unit text)
returns void language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_student uuid := public.require_student();
  v_unit uuid := public.unit_by_slug(p_unit);
begin
  perform public.complete_step(p_unit, 'jelaskan');
  insert into public.discussion_marks (student_id, unit_id) values (v_student, v_unit)
  on conflict (student_id, unit_id) do nothing;
end $$;
revoke execute on function public.mark_discussed(text) from public, anon;
grant execute on function public.mark_discussed(text) to authenticated;
