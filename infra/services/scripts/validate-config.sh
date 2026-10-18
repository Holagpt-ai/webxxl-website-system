#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SERVICES_ROOT="$REPO_ROOT/infra/services"

echo "INFRA-02 validate-config (repo: $REPO_ROOT)"

if grep -ri --include='*.yml' --include='*.yaml' --include='*.ps1' --include='*.sh' --include='*.example' -E 'stocksist|STOCKSIST' "$SERVICES_ROOT" --exclude='validate-config.*' >/dev/null 2>&1; then
  echo "Forbidden Stocksist reference in compose/scripts/examples" >&2
  exit 1
fi

for svc in chatwoot postiz paperclip; do
  if ! grep -R --include='*.yml' -E "name:[[:space:]]*webxxl-stg-${svc}" "$SERVICES_ROOT/$svc" >/dev/null; then
    echo "Missing webxxl-stg-${svc} project name under $svc" >&2
    exit 1
  fi
done

while IFS= read -r -d '' f; do
  if grep -qE 'sk_live_|sk-ant-|postgresql://[^:]+:[^@]+@' "$f"; then
    echo "Suspected secret in example: $f" >&2
    exit 1
  fi
done < <(find "$SERVICES_ROOT" -type f \( -name '*.example' -o -name 'env.example' \) -print0)

echo "OK: isolation names, no Stocksist references, example files clean."
