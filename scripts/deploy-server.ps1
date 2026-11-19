<#
.SYNOPSIS
  MANUAL FALLBACK: deploy the backend to Cloud Run with Cloud Build.

.DESCRIPTION
  The backend normally deploys through your Cloud Build triggers when you push. Use this only when
  a trigger did not fire or failed and you need to redeploy without a push.

    1. Preflight  tools, shared-logic sync, clean git tree, gcloud project and account
    2. Tests      server Jest (skip with -SkipTests)
    3. Deploy     gcloud builds submit server/cloudbuild.yaml, then verify the live routes

  Add -IncludeCleanService to also redeploy clean-recipe-service.

.PARAMETER DryRun
  Runs the checks and tests and reads from gcloud, but does NOT submit the Cloud Build.

.EXAMPLE
  .\scripts\deploy-server.ps1 -DryRun
  .\scripts\deploy-server.ps1 -SkipTests -Yes
#>
[CmdletBinding()]
param(
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServerService = "souschef-api",
    [string]$CleanService = "clean-recipe-service",
    [switch]$IncludeCleanService,
    [switch]$SkipTests,
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

function Invoke-Preflight {
    Assert-GitReady $AllowDirty
    if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw "'gcloud' was not found on PATH." }

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

    $cleanNote = if ($IncludeCleanService) { " + $CleanService" } else { "" }
    Confirm-Deploy "deploy the backend to Cloud Run '$ServerService' ($Region) in $ProjectId$cleanNote" $Yes
}

function Invoke-ServerDeploy {
    Mutate "submit Cloud Build for $ServerService (server/cloudbuild.yaml)" {
        try {
            Run "gcloud" @("builds", "submit", "--config=server/cloudbuild.yaml", "server", "--project", $ProjectId)
        }
        catch {
            # The submit output only says which step number failed; show the step's own log.
            $buildId = Capture "gcloud" @("builds", "list", "--project", $ProjectId, "--limit", "1", "--format", "value(id)") -AllowFailure
            if ($buildId) {
                $log = Capture "gcloud" @("builds", "log", $buildId, "--project", $ProjectId) -AllowFailure
                $tail = ($log -split "`r?`n" | Where-Object { $_ -match 'ERROR|Error|failed|Finished Step' } | Select-Object -Last 8) -join "`n"
                Write-Host "`nWhy build $buildId failed (full log: gcloud builds log $buildId):" -ForegroundColor Yellow
                Write-Host $tail
            }
            throw
        }
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

try {
    Step "Preflight" { Invoke-Preflight }
    if (-not $SkipTests) {
        Step "Tests" { InNode "server" @("npm.cmd", "test", "--", "--silent"); Ok "server tests" }
    }
    else { Warn "tests skipped (-SkipTests)" }
    Step "Deploy server (Cloud Run)" { Invoke-ServerDeploy }

    Write-StepTable
    if ($DryRun) { Write-Host "Dry run finished: nothing was deployed." -ForegroundColor Yellow; exit 0 }
    Write-Host "Deployed commit $($info.Commit) to $($info.ApiUrl)." -ForegroundColor Green
    $previous = @($info.Revisions -split "\s+" | Where-Object { $_ })
    if ($previous.Count -ge 2) {
        Write-Host "Roll back: gcloud run services update-traffic $ServerService --region $Region --to-revisions $($previous[1])=100"
    }
    exit 0
}
catch {
    Write-Host ""
    Write-Host "DEPLOY STOPPED: $($_.Exception.Message)" -ForegroundColor Red
    Write-StepTable
    exit 1
}
