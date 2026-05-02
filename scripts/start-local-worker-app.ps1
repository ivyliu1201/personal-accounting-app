param(
    [switch]$SkipMigration,
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$workerDir = Join-Path $repoRoot 'worker'
$frontendDir = Join-Path $repoRoot 'frontend'
$envPath = Join-Path $repoRoot '.env'
$workerDevVarsPath = Join-Path $workerDir '.dev.vars'
$workerOut = Join-Path $repoRoot 'worker-dev.out.log'
$workerErr = Join-Path $repoRoot 'worker-dev.err.log'
$frontendOut = Join-Path $repoRoot 'frontend-dev.out.log'
$frontendErr = Join-Path $repoRoot 'frontend-dev.err.log'

function Stop-Listeners {
    param([int[]]$Ports)

    foreach ($port in $Ports) {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $processIds) {
            if ($processId -and $processId -ne 0) {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Import-DotEnv {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw ".env not found. Create .env from .env.example first."
    }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '' -or $line.StartsWith('#') -or -not $line.Contains('=')) {
            return
        }
        $parts = $line -split '=', 2
        [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
}

function Ensure-WorkerDevVars {
    param([string]$Path)

    if (Test-Path $Path) {
        return
    }

    $projectId = [Environment]::GetEnvironmentVariable('VITE_FIREBASE_PROJECT_ID', 'Process')
    if ([string]::IsNullOrWhiteSpace($projectId)) {
        throw "VITE_FIREBASE_PROJECT_ID is missing in .env, cannot create worker/.dev.vars."
    }

    Set-Content -Path $Path -Value "FIREBASE_PROJECT_ID=$projectId" -Encoding UTF8
}

function Wait-HttpOk {
    param(
        [string]$Url,
        [int]$Seconds
    )

    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 3
            if ($response.StatusCode -eq 200) {
                return
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    } while ((Get-Date) -lt $deadline)

    throw "Timed out waiting for $Url"
}

Import-DotEnv -Path $envPath
Ensure-WorkerDevVars -Path $workerDevVarsPath

Stop-Listeners -Ports @(5173, 8787)
Start-Sleep -Seconds 2

if (-not $SkipMigration) {
    Push-Location $workerDir
    try {
        npm.cmd run d1:migrate:local
    } finally {
        Pop-Location
    }
}

Remove-Item -LiteralPath $workerOut, $workerErr, $frontendOut, $frontendErr -ErrorAction SilentlyContinue

Start-Process `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev:local') `
    -WorkingDirectory $workerDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $workerOut `
    -RedirectStandardError $workerErr

Wait-HttpOk -Url 'http://localhost:8787/api/health' -Seconds 30

[Environment]::SetEnvironmentVariable('VITE_API_PROXY_TARGET', 'http://localhost:8787', 'Process')

Start-Process `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'dev', '--', '--host', 'localhost') `
    -WorkingDirectory $frontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr

Wait-HttpOk -Url 'http://localhost:5173/' -Seconds 30

if (-not $SkipSmoke) {
    Push-Location $workerDir
    try {
        npm.cmd run smoke:local
    } finally {
        Pop-Location
    }
}

Write-Host ''
Write-Host 'Local Worker app is running.'
Write-Host 'Open: http://localhost:5173'
Write-Host ''
Write-Host "Worker log:   $workerOut"
Write-Host "Frontend log: $frontendOut"
