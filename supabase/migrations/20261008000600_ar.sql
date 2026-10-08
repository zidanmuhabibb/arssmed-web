-- M5 · AR permukaan (FR-14, FR-17). Catat jenis perangkat (kategori kasar, anonim) per tampilan
-- objek, sebagai kovariat deskriptif bagi peneliti (PRD §16.2). Tidak menyimpan user agent.

alter table public.object_views
  add column device_kind text null check (device_kind is null or device_kind in ('android', 'ios', 'desktop', 'other'));

drop function if exists public.record_object_view(text, text, text);

create or replace function public.record_object_view(p_unit text, p_object text, p_mode text default '3d', p_device text default null)
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
  if p_device is not null and p_device not in ('android', 'ios', 'desktop', 'other') then
    raise exception using message = 'Jenis perangkat tidak dikenal.', detail = 'invalid_input', errcode = 'P0001';
  end if;
  insert into public.object_views (student_id, ar_object_id, mode, device_kind) values (v_student, v_obj, p_mode, p_device);
end $$;
revoke execute on function public.record_object_view(text, text, text, text) from public, anon;
grant execute on function public.record_object_view(text, text, text, text) to authenticated;

-- Tautan berkas AR per objek (konten di repo; jalur tetap). Diisi oleh migrasi konten.
