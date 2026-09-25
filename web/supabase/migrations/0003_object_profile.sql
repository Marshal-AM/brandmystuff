-- Free-form listings: no user-chosen categories; the AI derives an object profile.
alter table objects add column if not exists object_type text;
alter table objects add column if not exists exposure_class text;
alter table objects add column if not exists tags text[] not null default '{}';
alter table objects add column if not exists viewer_mode text;
alter table objects add column if not exists viewing_distance_m numeric;
alter table objects add column if not exists prohibited_zones text[] not null default '{}';
alter table objects alter column category_code set default 0;
update objects set object_type = coalesce(object_type, category), exposure_class = coalesce(exposure_class, 'other');
create index if not exists objects_tags_idx on objects using gin(tags);
