<#
.SYNOPSIS
  One-command deploy: checks, tests, server (Cloud Run) then client (Firebase Hosting).

.DESCRIPTION
  Automates docs\DEPLOY_CHEATSHEET.md. Steps, in order (any failure stops the run):
    1. Preflight   tools, shared-logic sync, clean git tree, gcloud account, client/.env
    2. Tests       server Jest, client unit tests, lint (skip with -SkipTests)
    3. Server      gcloud builds submit server/cloudbuild.yaml, then verify the live routes
    4. Client      npm ci, production build, bundle checks, firebase deploy (hosting)
    5. Summary     timings, live URLs, smoke-test checklist and rollback commands

  The server always deploys before the client, so a new client never meets an old server.
  Values from client/.env are loaded into this process only and are never printed.

.PARAMETER Target
  all (default), server or client.

.PARAMETER DryRun
  Rehearsal: runs every check, test and the client build, and reads from gcloud, but does NOT
  submit the Cloud Build or deploy to Firebase.

.PARAMETER SkipTests
  Skip server tests, client unit tests and lint (the client still builds).

.PARAMETER SkipInstall
  Skip `npm ci` for the client. Use this while `npm run dev` is running (it locks esbuild.exe).

.PARAMETER AllowDirty
  Deploy even with uncommitted changes. Cloud Build and the client build use what is on disk.

.PARAMETER IncludeCleanService
  Also build and deploy clean-recipe-service (normally changed rarely; its trigger handles it).

.PARAMETER Yes
  Do not ask for confirmation before deploying.

.EXAMPLE
  .\scripts\deploy.ps1
  .\scripts\deploy.ps1 -DryRun
  .\scripts\deploy.ps1 -Target client -SkipTests -Yes
  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy.ps1
#>
[CmdletBinding()]
param(
    [ValidateSet("all", "server", "client")]
    [string]$Target = "all",
    [string]$ProjectId = "",
    [string]$FirebaseProject = "",
    [string]$Region = "us-central1",
    [string]$ServerService = "souschef-api",
    [string]$CleanService = "clean-recipe-service",
    [switch]$IncludeCleanService,
    [switch]$SkipTests,
    [switch]$SkipInstall,
    [switch]$AllowDirty,
    [switch]$DryRun,
    [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$global:LASTEXITCODE = 0

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$doServer = $Target -in @("all", "server")
$doClient = $Target -in @("all", "client")
$results = New-Object System.Collections.Generic.List[object]
$info = @{}

# ---------------------------------------------------------------- helpers

function Step {
    param([string]$Name, [scriptblock]$Body)
    Write-Host ""
    Write-Host "==> $Name" -ForegroundColor Cyan
    $watch = [Diagnostics.Stopwatch]::StartNew()
    try {
        & $Body
        $results.Add([pscustomobject]@{ Step = $Name; Result = "ok"; Seconds = [int]$watch.Elapsed.TotalSeconds })
    }
    catch {
        $results.Add([pscustomobject]@{ Step = $Name; Result = "FAILED"; Seconds = [int]$watch.Elapsed.TotalSeconds })
        throw
    }
}

# Run a native command and stop if it fails.
function Run {
    param([string]$Exe, [string[]]$CmdArgs)
    $ErrorActionPreference = "Continue"   # native stderr (progress output) is not an error; the exit code decides
    $global:LASTEXITCODE = 0
    & $Exe @CmdArgs
    if ($LASTEXITCODE -ne 0) {
        throw "'$Exe $($CmdArgs -join ' ')' failed with exit code $LASTEXITCODE"
    }
}

# Run a native command and return its stdout as text. stderr (gcloud prints status lines there)
# is kept out of the value and only shown if the command fails.
function Capture {
    param([string]$Exe, [string[]]$CmdArgs, [switch]$AllowFailure)
    $ErrorActionPreference = "Continue"
    $global:LASTEXITCODE = 0
    $all = @(& $Exe @CmdArgs 2>&1)
    $stdout = ($all | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
        $stderr = ($all | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | Out-String).Trim()
        throw "'$Exe $($CmdArgs -join ' ')' failed with exit code $LASTEXITCODE`n$stderr`n$stdout"
    }
    return $stdout
}

# npm / npx through fnm so Node 24 is used, from the given folder.
function InNode {
    param([string]$Dir, [string[]]$CmdArgs)
    Push-Location (Join-Path $root $Dir)
    try { Run "fnm" (@("exec", "--using", "24") + $CmdArgs) }
    finally { Pop-Location }
}

# Anything that changes a live system goes through here so -DryRun can skip it.
function Mutate {
    param([string]$What, [scriptblock]$Body)
    if ($DryRun) { Write-Host "[dry run] would: $What" -ForegroundColor Yellow }
    else { & $Body }
}

function Warn([string]$Message) { Write-Host "WARNING: $Message" -ForegroundColor Yellow }
function Ok([string]$Message) { Write-Host "  ok  $Message" -ForegroundColor Green }

# ---------------------------------------------------------------- steps

function Get-DotEnvValues([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}

function Invoke-Preflight {
    foreach ($tool in @("git", "fnm") + $(if ($doServer) { "gcloud" } else { @() })) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "'$tool' was not found on PATH." }
    }
    Ok "tools: git, fnm$(if ($doServer) { ', gcloud' })"

    # Sync first: if it changes anything, the tree is dirty and the check below says so.
    Run "powershell" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\sync-shared-logic.ps1"))

    $info.Commit = (Capture "git" @("rev-parse", "--short", "HEAD"))
    $info.Branch = (Capture "git" @("rev-parse", "--abbrev-ref", "HEAD"))
    $dirty = Capture "git" @("status", "--porcelain")
    if ($dirty) {
        if (-not $AllowDirty) {
            throw "Uncommitted changes:`n$dirty`nCommit them first (the deploy uses what is on disk), or pass -AllowDirty."
        }
        Warn "deploying with uncommitted changes (-AllowDirty)"
    }
    else { Ok "git tree clean ($($info.Branch) @ $($info.Commit))" }

    $ahead = Capture "git" @("rev-list", "--count", "@{u}..HEAD") -AllowFailure
    if ($ahead -match '^\d+$' -and [int]$ahead -gt 0) {
        Warn "$ahead commit(s) not pushed yet. Pushing to main also starts the Cloud Build triggers and the Firebase GitHub Action."
    }

    if ($doServer) {
        if (-not $ProjectId) { $script:ProjectId = (Capture "gcloud" @("config", "get-value", "project") -AllowFailure) }
        if (-not $ProjectId -or $ProjectId -match "unset") { throw "No GCP project. Pass -ProjectId or run: gcloud config set project <id>" }
        $exists = Capture "gcloud" @("projects", "describe", $ProjectId, "--format", "value(projectId)") -AllowFailure
        if ($exists -ne $ProjectId) {
            $known = Capture "gcloud" @("projects", "list", "--format", "table(projectId,name)") -AllowFailure
            throw "GCP project '$ProjectId' was not found (use the project ID, not its name). Yours:`n$known"
        }
        $account = Capture "gcloud" @("auth", "list", "--filter=status:ACTIVE", "--format=value(account)")
        if (-not $account) { throw "No active gcloud account. Run: gcloud auth login" }
        Ok "gcloud project $ProjectId as $account"
    }

    if ($doClient) {
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
        Ok "client/.env loaded (VITE_API_URL -> $($info.ApiHost), Firebase project $($env:FIREBASE_PROJECT))"

        if (-not $SkipInstall -and (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
            throw "The Vite dev server is running (port 5173). It locks esbuild.exe so 'npm ci' would fail. Stop it, or pass -SkipInstall."
        }
    }

    Write-Host ""
    Write-Host "Plan: $(if ($DryRun) { 'DRY RUN of ' })deploy commit $($info.Commit)" -ForegroundColor White
    $cleanNote = if ($IncludeCleanService) { " + $CleanService" } else { "" }
    if ($doServer) { Write-Host "  - server  -> Cloud Run '$ServerService' ($Region) in $ProjectId$cleanNote" }
    if ($doClient) { Write-Host "  - client  -> Firebase Hosting $($env:FIREBASE_PROJECT)" }
    if (-not $Yes -and -not $DryRun) {
        $answer = Read-Host "Type 'deploy' to continue"
        if ($answer -ne "deploy") { Write-Host "Cancelled."; exit 0 }
    }
}

function Invoke-Tests {
    if ($doServer) {
        InNode "server" @("npm.cmd", "test", "--", "--silent")
        Ok "server tests"
    }
    if ($doClient) {
        InNode "client" @("npm.cmd", "run", "test:unit")
        InNode "client" @("npm.cmd", "run", "lint")
        Ok "client unit tests and lint"
    }
}

function Invoke-ServerDeploy {
    Mutate "submit Cloud Build for $ServerService (server/cloudbuild.yaml)" {
        Run "gcloud" @("builds", "submit", "--config=server/cloudbuild.yaml", "server", "--project", $ProjectId)
    }

    $info.ApiUrl = Capture "gcloud" @("run", "services", "describe", $ServerService, "--region", $Region,
        "--platform", "managed", "--project", $ProjectId, "--format", "value(status.url)")
    if (-not $info.ApiUrl) { throw "Could not read the URL of Cloud Run service '$ServerService'." }
    Ok "service URL $($info.ApiUrl)"

    if (-not $DryRun) {
        # cloudbuild.yaml already waits for this route; confirm from here too.
        $routes = (Invoke-WebRequest -Uri "$($info.ApiUrl)/debug/routes" -UseBasicParsing -TimeoutSec 30).Content
        if ($routes -notmatch "/api/oauth/google/token") { throw "The live server is up but does not list /api/oauth/google/token." }
        Ok "live routes include the OAuth token route"
    }

    if ($IncludeCleanService) {
        Mutate "submit Cloud Build for $CleanService" {
            Run "gcloud" @("builds", "submit", "--config=clean-recipe-service/cloudbuild.yaml", "clean-recipe-service",
                "--project", $ProjectId, "--substitutions=_SERVER_URL=$($info.ApiUrl)")
        }
    }

    $info.Revisions = Capture "gcloud" @("run", "revisions", "list", "--service", $ServerService, "--region", $Region,
        "--project", $ProjectId, "--limit", "2", "--format", "value(metadata.name)")
}

function Invoke-ClientDeploy {
    if (-not $SkipInstall) { InNode "client" @("npm.cmd", "ci") }
    InNode "client" @("npm.cmd", "run", "build")

    # The bundle must point at the real API and must not contain the dev-login bypass.
    $bundle = Join-Path $root "client\dist\assets\*.js"
    if (-not (Select-String -Path $bundle -Pattern $info.ApiHost -SimpleMatch -List)) {
        throw "The built bundle does not contain $($info.ApiHost). VITE_API_URL was not baked in."
    }
    if (Select-String -Path $bundle -Pattern "VITE_DEV_BYPASS" -SimpleMatch -List) {
        throw "The built bundle contains VITE_DEV_BYPASS. Never ship the dev-login bypass."
    }
    Ok "bundle points at $($info.ApiHost) and has no dev bypass"

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

    if (-not $DryRun) {
        $status = (Invoke-WebRequest -Uri $info.SiteUrl -UseBasicParsing -TimeoutSec 30).StatusCode
        if ($status -ne 200) { throw "$($info.SiteUrl) answered HTTP $status after deploying." }
        Ok "$($info.SiteUrl) answers HTTP 200"
    }
}

function Write-Summary([bool]$Succeeded) {
    Write-Host ""
    Write-Host "================ summary ================" -ForegroundColor Cyan
    $results | Format-Table -AutoSize | Out-String | Write-Host
    if (-not $Succeeded) { return }

    if ($DryRun) { Write-Host "Dry run finished: nothing was deployed." -ForegroundColor Yellow; return }
    Write-Host "Deployed commit $($info.Commit)." -ForegroundColor Green
    if ($info.ContainsKey("ApiUrl")) { Write-Host "  API:  $($info.ApiUrl)" }
    if ($info.ContainsKey("SiteUrl")) { Write-Host "  Site: $($info.SiteUrl)  (hard-refresh the page)" }
    Write-Host ""
    Write-Host "Smoke test: log in; cook a recipe; add to the grocery list and reload; open the planner;"
    Write-Host "  drag a recipe onto a day; edit a recipe from a URL; leave the app idle past 15 minutes."
    Write-Host ""
    Write-Host "Roll back if needed:"
    if ($info.ContainsKey("Revisions") -and $info.Revisions) {
        $previous = @($info.Revisions -split "\s+" | Where-Object { $_ })
        if ($previous.Count -ge 2) {
            Write-Host "  gcloud run services update-traffic $ServerService --region $Region --to-revisions $($previous[1])=100"
        }
    }
    Write-Host "  Firebase console -> Hosting -> Release history -> Rollback"
}

# ---------------------------------------------------------------- run

try {
    Step "Preflight" { Invoke-Preflight }
    if (-not $SkipTests) { Step "Tests" { Invoke-Tests } } else { Warn "tests skipped (-SkipTests)" }
    if ($doServer) { Step "Deploy server (Cloud Run)" { Invoke-ServerDeploy } }
    if ($doClient) { Step "Deploy client (Firebase Hosting)" { Invoke-ClientDeploy } }
    Write-Summary $true
    exit 0
}
catch {
    Write-Host ""
    Write-Host "DEPLOY STOPPED: $($_.Exception.Message)" -ForegroundColor Red
    Write-Summary $false
    if ($doClient -and $results.Count -gt 0 -and $results[-1].Step -like "Deploy client*") {
        Write-Host "The server step (if any) already succeeded; fix the client problem and rerun with -Target client." -ForegroundColor Yellow
    }
    exit 1
}
