# Scoped staging startup — requires owner approval on isolated host
$ErrorActionPreference = "Stop"
$allowed = @("chatwoot", "postiz", "paperclip")
$service = $env:WEBXXL_STAGING_SERVICE
if (-not $service -or $allowed -notcontains $service) {
  throw "Set WEBXXL_STAGING_SERVICE to one of: $($allowed -join ', ')"
}
if ($env:WEBXXL_STAGING_CONFIRM -ne "I_APPROVE_ISOLATED_STAGING") {
  throw "Refusing startup: set WEBXXL_STAGING_CONFIRM=I_APPROVE_ISOLATED_STAGING after capacity review"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$composeDir = Join-Path $repoRoot "infra\services\$service"

switch ($service) {
  "chatwoot" {
    $file = Join-Path $composeDir "docker-compose.staging.yml"
    docker compose -f $file up -d
  }
  "postiz" {
    throw "Postiz requires cloned gitroomhq/postiz-docker-compose on host; apply postiz/docker-compose.staging.overlay.yml — not automated from repo root"
  }
  "paperclip" {
    throw "Paperclip requires cloned paperclipai/paperclip at pinned tag; use paperclip/docker-compose.staging.override.yml — not automated from repo root"
  }
}

Write-Host "Started webxxl-stg-$service (verify with health-readonly.ps1)"
