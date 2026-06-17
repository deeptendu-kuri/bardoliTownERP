#!/usr/bin/env bash
# Wipe ALL demo data and users, leaving a single production admin.
# Usage:
#   SUPA_PAT=sbp_xxx REF=projref SEC=sb_secret_xxx bash scripts/reset-to-prod.sh
# Optional: ADMIN_EMAIL, ADMIN_PW (defaults below).
set -euo pipefail
: "${SUPA_PAT:?set SUPA_PAT (personal access token)}"
: "${REF:?set REF (project ref)}"
: "${SEC:?set SEC (service/secret API key, for creating the owner)}"
ADMIN_EMAIL="${ADMIN_EMAIL:-ceo@bardolitown.com}"
ADMIN_PW="${ADMIN_PW:-Bardoli@782123}"
OWNER_ROLE="${OWNER_ROLE:-ceo}"
URL="https://${REF}.supabase.co"

sql() {
  python -c "import json,sys; print(json.dumps({'query': sys.argv[1]}))" "$1" \
    | curl -s -X POST "https://api.supabase.com/v1/projects/${REF}/database/query" \
        -H "Authorization: Bearer ${SUPA_PAT}" -H "Content-Type: application/json" -d @- >/dev/null
}

echo "1/5 allowlist → only ${ADMIN_EMAIL} (admin)"
sql "delete from role_allowlist; insert into role_allowlist(email,role) values ('${ADMIN_EMAIL}','${OWNER_ROLE}');"

echo "2/5 ensure the production admin account exists"
curl -s -X POST "${URL}/auth/v1/admin/users" -H "apikey: ${SEC}" -H "Authorization: Bearer ${SEC}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PW}\",\"email_confirm\":true}" >/dev/null || true

echo "3/5 wipe all operational data"
sql "truncate attachments, anchor_requests, project_notes, time_logs, review_rounds, task_events, tasks, projects, clients, notifications, ai_suggestions restart identity cascade;"

echo "4/5 delete every user except the production admin"
sql "delete from auth.users where email <> '${ADMIN_EMAIL}';"

echo "5/5 finalise the admin profile"
sql "update profiles p set role='${OWNER_ROLE}', onboarded=true, full_name=coalesce(nullif(full_name,''),'Owner') from auth.users u where u.id=p.id and u.email='${ADMIN_EMAIL}';"

echo "✅ Reset complete — only ${ADMIN_EMAIL} remains. Next project will be #1."
