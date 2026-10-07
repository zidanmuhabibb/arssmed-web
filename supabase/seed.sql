-- Data contoh untuk Supabase LOKAL (`pnpm db:reset`). JANGAN dijalankan di produksi.
-- Akun:
--   Guru     : guru@contoh.id      / rahasia123  (kelas 6A, kode kelas K7M2QX)
--   Peneliti : peneliti@contoh.id  / rahasia123  (admin)
--   Siswa 6A : S01 PIN 1234 (Raka, persetujuan diberikan), S02 PIN 5678 (Sinta, menunggu)
-- Butir tes TIDAK di-seed di sini: diimpor dari data/items.json (M6).

do $$
declare
  v_guru uuid := '00000000-0000-4000-a000-000000000001';
  v_peneliti uuid := '00000000-0000-4000-a000-000000000002';
  v_school uuid;
  v_class uuid;
  u record;
begin
  for u in
    select * from (values (v_guru, 'guru@contoh.id', 'Bu Dewi'), (v_peneliti, 'peneliti@contoh.id', 'Peneliti')) as t(id, email, name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('rahasia123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(),
      '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now())
    on conflict do nothing;
  end loop;

  -- Pemicu on_auth_user_created sudah membuat profil 'teacher'; jadikan peneliti admin.
  update public.profiles set role = 'admin' where id = v_peneliti;

  insert into public.schools (name) values ('SD Contoh') returning id into v_school;
  update public.profiles set school_id = v_school where id in (v_guru, v_peneliti);

  insert into public.classes (school_id, teacher_id, name, academic_year, join_code, mode)
  values (v_school, v_guru, '6A', '2026/2027', 'K7M2QX', 'research') returning id into v_class;

  insert into public.students (class_id, student_code, nickname, pin_hash, pseudo_id, consent_status, consent_recorded_by, consent_recorded_at)
  values
    (v_class, 'S01', 'Raka', public.hash_pin('1234'), public.gen_pseudo_id(), 'granted', v_guru, now()),
    (v_class, 'S02', 'Sinta', public.hash_pin('5678'), public.gen_pseudo_id(), 'pending', null, null);
end $$;
