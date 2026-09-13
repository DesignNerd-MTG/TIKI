-- Manufacturer data only. Never create a second Filex brand or overwrite human aliases.
begin;
do $$
begin
  if (select count(*) from public.fixture_manufacturers where name = 'Fiilex' and slug = 'fiilex' and active) <> 1 then
    raise exception 'Expected exactly one active canonical Fiilex; inspect taxonomy before applying';
  end if;
  if exists (select 1 from public.fixture_manufacturers m where m.name <> 'Fiilex' and
    (public.fixture_manufacturer_key(m.name) = 'filex' or exists
      (select 1 from unnest(m.aliases) a where public.fixture_manufacturer_key(a) = 'filex'))) then
    raise exception 'Filex is already assigned elsewhere; resolve taxonomy conflict manually';
  end if;
end $$;
update public.fixture_manufacturers
set aliases = array_append(aliases, 'Filex')
where name = 'Fiilex' and slug = 'fiilex'
  and not exists (select 1 from unnest(aliases) a where public.fixture_manufacturer_key(a) = 'filex');
commit;
