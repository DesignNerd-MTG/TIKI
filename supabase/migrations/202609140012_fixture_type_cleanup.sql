-- Retire the standalone legacy Wash fixture type without deleting fixtures.
-- Mover Wash and LED Brick/Wash are intentionally unaffected.
begin;

update public.fixtures
set fixture_type = null
where lower(btrim(fixture_type)) = 'wash';

commit;
