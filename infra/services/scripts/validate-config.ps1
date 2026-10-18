# Static validation — safe on developer machines (no Docker required)
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$servicesRoot = Join-Path $repoRoot "infra\services"

$forbidden = @("stocksist", "STOCKSIST")
$requiredProjects = @(
  @{ Service = "chatwoot"; Pattern = "name:\s*webxxl-stg-chatwoot" },
  @{ Service = "postiz"; Pattern = "name:\s*webxxl-stg-postiz" },
  @{ Service = "paperclip"; Pattern = "name:\s*webxxl-stg-paperclip" }
)

Write-Host "INFRA-02 validate-config (repo: $repoRoot)"

$scanExtensions = @(".yml", ".yaml", ".ps1", ".sh", ".example")
Get-ChildItem -Path $servicesRoot -Recurse -File | Where-Object {
  ($scanExtensions -contains $_.Extension -or $_.Name -eq "env.example") -and $_.Name -notlike "validate-config*"
} | ForEach-Object {
  $text = Get-Content -Raw -LiteralPath $_.FullName
  foreach ($bad in $forbidden) {
    if ($text -match [regex]::Escape($bad)) {
      throw "Forbidden reference '$bad' in $($_.FullName)"
    }
  }
}

foreach ($proj in $requiredProjects) {
  $compose = Get-ChildItem -Path (Join-Path $servicesRoot $proj.Service) -Filter "*.yml" -Recurse
  $hit = $false
  foreach ($file in $compose) {
    $raw = Get-Content -Raw -LiteralPath $file.FullName
    if ($raw -match $proj.Pattern) { $hit = $true; break }
  }
  if (-not $hit) { throw "Missing compose project name for $($proj.Service)" }
}

$examples = Get-ChildItem -Path $servicesRoot -Recurse -Include "*.example" -File
foreach ($ex in $examples) {
  $raw = Get-Content -Raw -LiteralPath $ex.FullName
  if ($raw -match "(sk_live_|sk-ant-|postgresql://[^:]+:(?!.*PLACEHOLDER)[^@]+@|Bearer\s+[A-Za-z0-9._-]{20,})") {
    throw "Suspected secret in example file $($ex.FullName)"
  }
}

Write-Host "OK: isolation names, no Stocksist references, example files clean."
