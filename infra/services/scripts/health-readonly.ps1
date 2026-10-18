param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("chatwoot", "postiz", "paperclip", "postiz-production-candidate")]
  [string]$Service,

  [string]$BaseUrl
)

$ErrorActionPreference = "Stop"

if (-not $BaseUrl) {
  $BaseUrl = switch ($Service) {
    "chatwoot" { "http://127.0.0.1:13000" }
    "postiz" { "http://127.0.0.1:14007" }
    "paperclip" { "http://127.0.0.1:13100" }
    "postiz-production-candidate" { "https://app.webbxxl.com" }
  }
}

$path = switch ($Service) {
  "chatwoot" { "/api" }
  default { "/" }
}

$uri = "$($BaseUrl.TrimEnd('/'))$path"
Write-Host "GET $uri (read-only)"
try {
  $resp = Invoke-WebRequest -Uri $uri -Method Get -MaximumRedirection 5 -TimeoutSec 15 -UseBasicParsing
  Write-Host "Status: $($resp.StatusCode)"
} catch {
  if ($_.Exception.Response) {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
  } else {
    throw
  }
}
