-- 0017_new_roles.sql — add scriptwriter + salesperson roles (separate file:
-- enum values must commit before they can be referenced by later migrations,
-- exactly like 0007 did for 'anchor').
alter type user_role add value if not exists 'scriptwriter';
alter type user_role add value if not exists 'salesperson';
