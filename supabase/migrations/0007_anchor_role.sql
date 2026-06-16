-- 0007_anchor_role.sql — add the anchor role (separate file: enum value must
-- commit before it can be referenced by later migrations).
alter type user_role add value if not exists 'anchor';
