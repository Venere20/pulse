-- Run after 20261012150000_visit_covers.sql.
begin;
update storage.buckets
set public = false,
    file_size_limit = 8388608,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'visit-covers';
commit;
