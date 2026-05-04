$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot ".env"

if (-not (Test-Path $envFile)) {
  throw ".env not found at $envFile"
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*#") { return }
  if ($_ -notmatch "^[A-Za-z_][A-Za-z0-9_]*=") { return }
  $parts = $_.Split("=", 2)
  [Environment]::SetEnvironmentVariable($parts[0], $parts[1], "Process")
}

if (-not $env:APP_FIREBASE_ENABLED) {
  $env:APP_FIREBASE_ENABLED = "false"
}

Push-Location (Join-Path $repoRoot "backend")
try {
  .\mvnw.cmd spring-boot:run
}
finally {
  Pop-Location
}
