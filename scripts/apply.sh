#!/usr/bin/env bash
# Apply a .sql file to the Supabase project via the Management API.
# Usage:  SUPA_PAT=sbp_xxx REF=projref bash scripts/apply.sh path/to/file.sql
set -euo pipefail
: "${SUPA_PAT:?set SUPA_PAT}"
: "${REF:?set REF}"
python -c "import json,sys; print(json.dumps({'query': open(sys.argv[1]).read()}))" "$1" \
  | curl -s -X POST "https://api.supabase.com/v1/projects/${REF}/database/query" \
      -H "Authorization: Bearer ${SUPA_PAT}" -H "Content-Type: application/json" -d @-
echo
