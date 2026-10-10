-- M8 · Reklasifikasi (PRD §6.2, §11 POST /api/riset/reklasifikasi; FR-55 audit perubahan aturan).
-- Jawaban mentah tidak diubah. Klasifikasi untuk aturan lain disimpan berdampingan (unik per respons ×
-- aturan) oleh server aplikasi lewat store_classifications (service role), setelah log_reclassify
-- memastikan pemanggil admin dan mencatatnya di audit.

drop function if exists public.analysis_dataset(uuid);

create or replace function public.analysis_dataset(p_class_id uuid default null, p_rule_set text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_test uuid; v_rs uuid; v_classes uuid[];
begin
  if p_class_id is null then
    if not public.is_admin() then
      raise exception using message = 'Hanya peneliti yang bisa melihat semua kelas.', detail = 'forbidden', errcode = '42501';
    end if;
    v_test := public.active_test_id();
    select coalesce(array_agg(c.id), '{}') into v_classes from public.classes c where c.mode = 'research';
  else
    if not public.teaches_class(p_class_id) then
      raise exception using message = 'Kelas tidak ditemukan.', detail = 'not_found', errcode = 'P0002';
    end if;
    v_test := coalesce(
      (select test_id from public.class_tests where class_id = p_class_id and phase = 'pre'),
      (select test_id from public.class_tests where class_id = p_class_id and phase = 'post'),
      public.active_test_id());
    v_classes := array[p_class_id];
  end if;
  if v_test is null then
    raise exception using message = 'Bank soal belum dimuat.', detail = 'no_test', errcode = 'P0001';
  end if;
  if p_rule_set is null then
    select rule_set_id into v_rs from public.tests where id = v_test;
  else
    select id into v_rs from public.rule_sets where rule_set_id = p_rule_set;
    if v_rs is null then
      raise exception using message = 'Aturan klasifikasi tidak dikenal.', detail = 'not_found', errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object(
    'test_id', v_test,
    'test_name', (select name from public.tests where id = v_test),
    'test_version', (select version from public.tests where id = v_test),
    'rule_set_id', (select rule_set_id from public.rule_sets where id = v_rs),
    'test_rule_set_id', (select r.rule_set_id from public.tests t join public.rule_sets r on r.id = t.rule_set_id where t.id = v_test),
    -- Respons percobaan selesai yang BELUM punya klasifikasi untuk aturan ini (perlu reklasifikasi).
    'unclassified', (
      select count(*) from public.item_responses r
        join public.test_attempts a on a.id = r.attempt_id
        join public.class_tests ct on ct.id = a.class_test_id
        join public.students s on s.id = a.student_id
       where s.class_id = any(v_classes) and ct.test_id = v_test and a.submitted_at is not null
         and not exists (select 1 from public.classifications k where k.item_response_id = r.id and k.rule_set_id = v_rs)),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name)
        from public.classes c where c.id = any(v_classes)), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'pseudo_id', s.pseudo_id, 'code', s.student_code, 'nickname', s.nickname,
        'class_id', s.class_id, 'consent', s.consent_status,
        'pre_submitted', exists (select 1 from public.test_attempts a join public.class_tests ct on ct.id = a.class_test_id
                                  where a.student_id = s.id and ct.phase = 'pre' and ct.test_id = v_test and a.submitted_at is not null),
        'post_submitted', exists (select 1 from public.test_attempts a join public.class_tests ct on ct.id = a.class_test_id
                                   where a.student_id = s.id and ct.phase = 'post' and ct.test_id = v_test and a.submitted_at is not null)
      ) order by s.class_id, s.student_code)
        from public.students s where s.class_id = any(v_classes)), '[]'::jsonb),
    -- Hanya percobaan yang sudah selesai, dengan klasifikasi aturan milik tes.
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', a.student_id, 'phase', ct.phase, 'item_id', r.item_id,
        'tier1', r.tier1_key, 'reason', r.reason_key, 'conf_a', r.confidence_a, 'conf_r', r.confidence_r,
        'a_correct', k.a_correct, 'r_correct', k.r_correct, 'confident', k.confident, 'category', k.category,
        'answered_at', coalesce(r.client_timestamp, r.updated_at), 'response_time_ms', r.response_time_ms,
        'answer_changes', r.answer_changes) order by a.student_id, ct.phase desc, r.item_id)
        from public.item_responses r
        join public.test_attempts a on a.id = r.attempt_id
        join public.class_tests ct on ct.id = a.class_test_id
        join public.students s on s.id = a.student_id
        join public.classifications k on k.item_response_id = r.id and k.rule_set_id = v_rs
       where s.class_id = any(v_classes) and ct.test_id = v_test and a.submitted_at is not null), '[]'::jsonb)
  );
end $$;
revoke execute on function public.analysis_dataset(uuid, text) from public, anon;
grant execute on function public.analysis_dataset(uuid, text) to authenticated;

create or replace function public.log_reclassify(p_rule_set text, p_class_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using message = 'Hanya peneliti yang bisa menghitung ulang klasifikasi.', detail = 'forbidden', errcode = '42501';
  end if;
  if not exists (select 1 from public.rule_sets where rule_set_id = p_rule_set) then
    raise exception using message = 'Aturan klasifikasi tidak dikenal.', detail = 'not_found', errcode = 'P0002';
  end if;
  perform public.write_audit('rule_set.reclassify', 'classes', p_class_id, jsonb_build_object('rule_set_id', p_rule_set));
end $$;
revoke execute on function public.log_reclassify(text, uuid) from public, anon;
grant execute on function public.log_reclassify(text, uuid) to authenticated;
