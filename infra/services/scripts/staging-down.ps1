$ErrorActionPreference = "Stop"
$allowed = @("chatwoot", "postiz", "paperclip")
$service = $env:WEBXXL_STAGING_SERVICE
if (-not $service -or $allowed -notcontains $service) {
  throw "Set WEBXXL_STAGING_SERVICE to one of: $($allowed -join ', ')"
}
if ($env:WEBXXL_STAGING_CONFIRM -ne "I_APPROVE_ISOLATED_STAGING") {
  throw "Refusing shutdown: set WEBXXL_STAGING_CONFIRM=I_APPROVE_ISOLATED_STAGING"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")

switch ($service) {
  "chatwoot" {
    $file = Join-Path $repoRoot "infra\services\chatwoot\docker-compose.staging.yml"
    docker compose -f $file down
  }
  default {
    throw "Use the same compose project on host for $service (see service README); automated down only implemented for chatwoot in-repo"
  }
}

Write-Host "Stopped webxxl-stg-$service"
