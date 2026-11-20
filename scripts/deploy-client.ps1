<#
.SYNOPSIS
  Deploy the client to Firebase Hosting. (The backend deploys through your Cloud Build triggers.)

.DESCRIPTION
  1. Preflight  tools, shared-logic sync, clean git tree, client/.env, dev-server check
  2. Backend    read-only check that the live API has the routes this client needs
  3. Tests      client unit tests and lint (skip with -SkipTests)
  4. Build      npm ci, production build, bundle checks (no direct API host or dev bypass)
  5. Deploy     firebase deploy --only hosting, then confirm the live site serves this build

  Values from client/.env are loaded into this process only and are never printed.
  If you must redeploy the backend by hand (a trigger failed), use scripts\deploy-server.ps1.

.PARAMETER DryRun
  Runs everything including the build, but does NOT run firebase deploy.

.PARAMETER SkipTests
  Skip client unit tests and lint (the build still runs).

.PARAMETER SkipInstall
  Skip `npm ci`. Use this while `npm run dev` is running (it locks esbuild.exe).

.PARAMETER SkipServerCheck
  Do not require the live API to have the planner routes before deploying.

.PARAMETER AllowDirty
  Deploy with uncommitted changes (the build uses what is on disk).

.PARAMETER Yes
  Do not ask for confirmation.

.EXAMPLE
  .\scripts\deploy-client.ps1 -DryRun
  .\scripts\deploy-client.ps1
  .\scripts\deploy-client.ps1 -SkipTests -Yes
#>
[CmdletBinding()]
param(
    [string]$FirebaseProject = "",
    [switch]$SkipTests,
    [switch]$SkipInstall,
    [switch]$SkipServerCheck,
    [switch]$AllowDirty,
    [switch]$DryRun,
    [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$global:LASTEXITCODE = 0

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$results = New-Object System.Collections.Generic.List[object]
$info = @{}
. (Join-Path $PSScriptRoot "deploy-common.ps1")

# Routes the current client calls (method, path); a 404 means the live backend is older than this client.
$requiredRoutes = @(
    @{ Method = "GET"; Path = "/api/planner/settings" },
    @{ Method = "GET"; Path = "/api/meal-plan" },
    @{ Method = "POST"; Path = "/auth/refresh" }
)

function Invoke-Preflight {
    Assert-GitReady $AllowDirty

    $envFile = Join-Path $root "client\.env"
    if (-not (Test-Path $envFile)) { throw "client\.env not found. It must define VITE_API_URL, VITE_GOOGLE_CLIENT_ID and FIREBASE_PROJECT." }
    foreach ($pair in (Get-DotEnvValues $envFile).GetEnumerator()) {
        Set-Item -Path "Env:$($pair.Key)" -Value $pair.Value
    }
    Remove-Item Env:VITE_DEV_BYPASS -ErrorAction SilentlyContinue   # never in a deploy build
    if ($FirebaseProject) { $env:FIREBASE_PROJECT = $FirebaseProject }

    foreach ($name in @("VITE_API_URL", "VITE_GOOGLE_CLIENT_ID", "FIREBASE_PROJECT")) {
        if (-not (Get-Item "Env:$name" -ErrorAction SilentlyContinue)) { throw "$name is missing from client\.env." }
    }
    $info.ApiHost = ([uri]$env:VITE_API_URL).Host
    if ($info.ApiHost -match "^(localhost|127\.|0\.0\.0\.0)" -or $env:VITE_API_URL -match "[<>]") {
        throw "VITE_API_URL ($($info.ApiHost)) is not publicly reachable. Point it at the Cloud Run URL."
    }
    Ok "client/.env loaded (API $($info.ApiHost), Firebase project $($env:FIREBASE_PROJECT))"

    if (-not $SkipInstall -and (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
        throw "The Vite dev server is running (port 5173). It locks esbuild.exe so 'npm ci' would fail. Stop it, or pass -SkipInstall."
    }

    Confirm-Deploy "deploy the client to Firebase Hosting '$($env:FIREBASE_PROJECT)'" $Yes
}

function Test-Backend {
    $api = $env:VITE_API_URL.TrimEnd("/")
    $missing = @()
    foreach ($route in $requiredRoutes) {
        # Unauthenticated: an existing protected route answers 401/403 (or 200/405); a missing one 404s.
        $code = Get-HttpStatus "$api$($route.Path)" $route.Method
        if ($code -eq 404 -or $code -eq 0 -or $code -ge 500) { $missing += "$($route.Method) $($route.Path) (HTTP $code)" }
    }
    if ($missing.Count -gt 0) {
        $msg = "The live backend at $($info.ApiHost) is missing routes this client needs:`n  " + ($missing -join "`n  ") +
            "`nIts Cloud Build trigger probably has not finished (check: gcloud builds list --limit 3). " +
            "Wait for it, or pass -SkipServerCheck."
        if ($SkipServerCheck) { Warn $msg } else { throw $msg }
    }
    else { Ok "live backend has the routes this client needs" }
}

function Invoke-Tests {
    InNode "client" @("npm.cmd", "run", "test:unit")
    InNode "client" @("npm.cmd", "run", "lint")
    Ok "client unit tests and lint"
}

function Invoke-Build {
    if (-not $SkipInstall) { InNode "client" @("npm.cmd", "ci") }
    InNode "client" @("npm.cmd", "run", "build")

    # Production calls use Hosting rewrites, never the cross-site Cloud Run host.
    $bundle = Join-Path $root "client\dist\assets\*.js"
    if (Select-String -Path $bundle -Pattern $info.ApiHost -SimpleMatch -List) {
        throw "The built bundle contains the direct API host $($info.ApiHost). Production requests must use same-origin Hosting rewrites."
    }
    if (Select-String -Path $bundle -Pattern "VITE_DEV_BYPASS" -SimpleMatch -List) {
        throw "The built bundle contains VITE_DEV_BYPASS. Never ship the dev-login bypass."
    }
    Ok "bundle has no direct API host or dev bypass"

    $index = Get-Content (Join-Path $root "client\dist\index.html") -Raw
    $info.Asset = [regex]::Match($index, '/assets/(index-[^"]+\.js)').Groups[1].Value
}

function Invoke-Deploy {
    # No separate "are you logged in?" probe: `login:list` alone takes minutes on a slow link and the
    # deploy authenticates anyway. A FIREBASE_TOKEN in client/.env or the environment also works.
    Mutate "firebase deploy --only hosting to $($env:FIREBASE_PROJECT)" {
        try {
            InNode "client" @("npx.cmd", "firebase-tools", "deploy", "--project", $env:FIREBASE_PROJECT, "--only", "hosting")
        }
        catch {
            throw "$($_.Exception.Message)`nIf this was an authentication error, log in once with:`n  cd client; fnm exec --using 24 npx.cmd firebase-tools login"
        }
    }
    $info.SiteUrl = "https://$($env:FIREBASE_PROJECT).web.app"
    if ($DryRun) { return }

    # Prove the live site serves the bundle we just built (not an older release).
    $live = ""
    foreach ($attempt in 1..6) {
        $html = (Invoke-WebRequest -Uri "$($info.SiteUrl)/?cb=$([guid]::NewGuid())" -UseBasicParsing -TimeoutSec 30).Content
        $live = [regex]::Match($html, '/assets/(index-[^"]+\.js)').Groups[1].Value
        if ($live -eq $info.Asset) { break }
        Start-Sleep -Seconds 5
    }
    if ($live -eq $info.Asset) { Ok "$($info.SiteUrl) serves this build ($live)" }
    else { Warn "$($info.SiteUrl) still serves $live, expected $($info.Asset). The CDN may lag a minute; hard-refresh and check again." }
}

try {
    Step "Preflight" { Invoke-Preflight }
    Step "Check live backend" { Test-Backend }
    if (-not $SkipTests) { Step "Tests" { Invoke-Tests } } else { Warn "tests skipped (-SkipTests)" }
    Step "Build client" { Invoke-Build }
    Step "Deploy to Firebase Hosting" { Invoke-Deploy }

    Write-StepTable
    if ($DryRun) { Write-Host "Dry run finished: nothing was deployed." -ForegroundColor Yellow; exit 0 }
    Write-Host "Deployed commit $($info.Commit) to $($info.SiteUrl)  (hard-refresh the page)." -ForegroundColor Green
    Write-Host ""
    Write-Host "Smoke test: log in; cook a recipe; add to the grocery list and reload; open the planner;"
    Write-Host "  drag a recipe onto a day; edit a recipe from a URL; leave the app idle past 15 minutes."
    Write-Host "Roll back: Firebase console -> Hosting -> Release history -> Rollback."
    exit 0
}
catch {
    Write-Host ""
    Write-Host "DEPLOY STOPPED: $($_.Exception.Message)" -ForegroundColor Red
    Write-StepTable
    exit 1
}
