# Validates merged compose effective config (requires Docker Compose v2.24+).
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$servicesRoot = Join-Path $repoRoot "infra\services"

function Test-ComposeJson {
  param([string]$Label, [string[]]$ComposeArgs, [hashtable]$EnvExtra)
  foreach ($k in $EnvExtra.Keys) { Set-Item -Path "env:$k" -Value $EnvExtra[$k] }
  $json = & docker compose @ComposeArgs config --format json 2>&1
  if ($LASTEXITCODE -ne 0) { throw "${Label}: docker compose config failed: $json" }
  $cfg = $json | ConvertFrom-Json
  return $cfg
}

function Assert-NoPublicPorts {
  param($Cfg, [string]$Label)
  foreach ($svc in $Cfg.services.PSObject.Properties) {
    $name = $svc.Name
    $ports = $svc.Value.ports
    if ($null -eq $ports) { continue }
    foreach ($p in $ports) {
      if ($p -is [string]) {
        $hostPart = ($p -split ':')[0]
        if ($hostPart -match '^\d+$') { throw "${Label}: service $name publishes all interfaces ($p)" }
        if ($hostPart -ne '127.0.0.1') { throw "${Label}: service $name publishes non-localhost ($p)" }
        continue
      }
      $hostIp = $p.host_ip
      if ([string]::IsNullOrEmpty($hostIp)) {
        throw "${Label}: service $name publishes without host_ip (defaults to 0.0.0.0)"
      }
      if ($hostIp -ne '127.0.0.1') {
        throw "${Label}: service $name publishes non-localhost host_ip: $hostIp"
      }
    }
  }
}

function Assert-NoContainerNames {
  param($Cfg, [string]$Label)
  foreach ($svc in $Cfg.services.PSObject.Properties) {
    if ($svc.Value.container_name) {
      throw "${Label}: fixed container_name remains on $($svc.Name): $($svc.Value.container_name)"
    }
  }
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host "PENDING: Docker not available; effective compose validation skipped."
  exit 0
}

$ver = (docker compose version --short 2>$null)
Write-Host "Docker Compose version: $ver"

# Chatwoot standalone (ephemeral .env for config validation only)
$chatwootDir = Join-Path $servicesRoot "chatwoot"
$chatwootEnvFile = Join-Path $chatwootDir ".env.compose-validate"
@"
SECRET_KEY_BASE=local-config-test-only-secret-key-base-minimum-sixty-four-characters-long!!
FRONTEND_URL=http://127.0.0.1:13000
"@ | Set-Content -LiteralPath $chatwootEnvFile -Encoding utf8
$chatwootDotEnv = Join-Path $chatwootDir ".env"
Copy-Item -LiteralPath $chatwootEnvFile -Destination $chatwootDotEnv -Force
$chatwootEnv = @{
  POSTGRES_PASSWORD = "local-config-test-only"
  REDIS_PASSWORD = "local-config-test-only"
}
try {
  $chatwoot = Test-ComposeJson -Label "chatwoot" -ComposeArgs @(
    "-f", (Join-Path $chatwootDir "docker-compose.staging.yml")
  ) -EnvExtra $chatwootEnv
} finally {
  Remove-Item -LiteralPath $chatwootEnvFile -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $chatwootDotEnv -Force -ErrorAction SilentlyContinue
}
if ($chatwoot.name -ne "webxxl-stg-chatwoot") { throw "chatwoot project name mismatch" }
if ($chatwoot.services.base) { throw "chatwoot must not define a runnable base service" }
Assert-NoPublicPorts $chatwoot "chatwoot"

# Paperclip merge
$paperEnv = @{
  BETTER_AUTH_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  PAPERCLIP_TOOL_ACTION_SIGNING_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  PAPERCLIP_POSTGRES_USER = "paperclip"
  PAPERCLIP_POSTGRES_PASSWORD = "local-config-test-only"
}
$paperclip = Test-ComposeJson -Label "paperclip" -ComposeArgs @(
  "-f", (Join-Path $servicesRoot "paperclip\fixtures\upstream.docker-compose.yml"),
  "-f", (Join-Path $servicesRoot "paperclip\docker-compose.staging.override.yml")
) -EnvExtra $paperEnv
if ($paperclip.name -ne "webxxl-stg-paperclip") { throw "paperclip project name mismatch" }
Assert-NoPublicPorts $paperclip "paperclip"
if ($paperclip.services.db.ports -and $paperclip.services.db.ports.Count -gt 0) {
  throw "paperclip db must not publish host ports"
}
if ($paperclip.services.server.ports.Count -ne 1) { throw "paperclip server must have exactly one port mapping" }

# Postiz merge
$postEnv = @{
  POSTIZ_JWT_SECRET = "local-config-test-only-jwt"
  POSTIZ_DATABASE_URL = "postgresql://postiz:local-config-test-only@postiz-postgres:5432/postiz"
  POSTIZ_POSTGRES_PASSWORD = "local-config-test-only"
  POSTIZ_POSTGRES_USER = "postiz-user"
  POSTIZ_POSTGRES_DB = "postiz-db-local"
  TEMPORAL_POSTGRES_PASSWORD = "local-config-test-only"
}
$postiz = Test-ComposeJson -Label "postiz" -ComposeArgs @(
  "-f", (Join-Path $servicesRoot "postiz\fixtures\upstream.docker-compose.yaml"),
  "-f", (Join-Path $servicesRoot "postiz\docker-compose.staging.overlay.yml")
) -EnvExtra $postEnv
if ($postiz.name -ne "webxxl-stg-postiz") { throw "postiz project name mismatch" }
Assert-NoPublicPorts $postiz "postiz"
Assert-NoContainerNames $postiz "postiz"
if ($postiz.services.postiz.image -notmatch "v2\.25\.1") { throw "postiz image not pinned to v2.25.1" }

Write-Host "OK: effective merged compose configurations passed isolation checks."
