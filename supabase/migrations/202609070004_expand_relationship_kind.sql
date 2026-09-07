-- Enum additions must commit before the values are referenced by tables and functions.
alter type public.relationship_kind add value if not exists 'location';
alter type public.relationship_kind add value if not exists 'drink';
