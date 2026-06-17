-- ============================================================================
-- 0013_fix_onboarded.sql — correct a one-time over-onboarding from 0012.
-- 0012's blanket "mark existing onboarded" also flagged self-signup accounts
-- created during earlier testing. Only pre-seeded (allowlisted) accounts should
-- skip onboarding; everyone else must complete it.
-- ============================================================================
update profiles p set onboarded = false
from auth.users u
where u.id = p.id and u.email not in (select email from role_allowlist);
