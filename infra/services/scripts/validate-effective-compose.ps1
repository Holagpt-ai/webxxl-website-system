# Validates merged compose effective config (requires Docker Compose v2.24+).
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$servicesRoot = Join-Path $repoRoot "infra\services"

function Test-ComposeJson {
  param(
    [string]$Label,
    [string[]]$ComposeArgs,
    [hashtable]$EnvExtra,
    [string]$ProjectDirectory = $repoRoot
  )
  foreach ($k in $EnvExtra.Keys) { Set-Item -Path "env:$k" -Value $EnvExtra[$k] }
  Push-Location $ProjectDirectory
  try {
    $json = & docker compose @ComposeArgs config --format json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "${Label}: docker compose config failed: $json" }
    return ($json | ConvertFrom-Json)
  } finally {
    Pop-Location
  }
}

function Get-OperationalEnvSnapshot {
  param([string]$EnvPath)
  if (-not (Test-Path -LiteralPath $EnvPath)) {
    return @{ Existed = $false; Content = $null; MtimeMs = $null; Path = $EnvPath }
  }
  $item = Get-Item -LiteralPath $EnvPath
  return @{
    Existed = $true
    Content = Get-Content -Raw -LiteralPath $EnvPath
    MtimeMs = $item.LastWriteTimeUtc.Ticks
    Path = $EnvPath
  }
}

function Assert-OperationalEnvUntouched {
  param($Before)
  $after = Get-OperationalEnvSnapshot -EnvPath $Before.Path
  if ($Before.Existed -ne $after.Existed) {
    throw "Operational env $($Before.Path) existence changed"
  }
  if (-not $Before.Existed) { return }
  if ($Before.Content -ne $after.Content) {
    throw "Operational env $($Before.Path) content was modified"
  }
  if ($Before.MtimeMs -ne $after.MtimeMs) {
    throw "Operational env $($Before.Path) timestamp changed"
  }
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

function New-ChatwootValidateSandbox {
  $sourceCompose = Join-Path $servicesRoot "chatwoot\docker-compose.staging.yml"
  $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("webxxl-chatwoot-compose-validate-" + [guid]::NewGuid().ToString("n"))
  New-Item -ItemType Directory -Path $workDir -Force | Out-Null
  Copy-Item -LiteralPath $sourceCompose -Destination (Join-Path $workDir "docker-compose.staging.yml")
  @"
SECRET_KEY_BASE=local-config-test-only-secret-key-base-minimum-sixty-four-characters-long!!
FRONTEND_URL=http://127.0.0.1:13000
"@ | Set-Content -LiteralPath (Join-Path $workDir ".env") -Encoding utf8
  return $workDir
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host "PENDING: Docker not available; effective compose validation skipped."
  exit 0
}

$ver = (docker compose version --short 2>$null)
Write-Host "Docker Compose version: $ver"

# Chatwoot — isolated temp sandbox only (never infra/services/chatwoot/.env)
$operationalEnv = Join-Path $servicesRoot "chatwoot\.env"
$envBefore = Get-OperationalEnvSnapshot -EnvPath $operationalEnv
$chatwootSandbox = New-ChatwootValidateSandbox
try {
  $chatwootEnv = @{
    POSTGRES_PASSWORD = "local-config-test-only"
    REDIS_PASSWORD = "local-config-test-only"
  }
  $chatwoot = Test-ComposeJson -Label "chatwoot" -ComposeArgs @(
    "-f", (Join-Path $chatwootSandbox "docker-compose.staging.yml")
  ) -EnvExtra $chatwootEnv -ProjectDirectory $chatwootSandbox
} finally {
  Remove-Item -LiteralPath $chatwootSandbox -Recurse -Force -ErrorAction SilentlyContinue
}
Assert-OperationalEnvUntouched $envBefore
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
