<#
Shared helpers for deploy-client.ps1 and deploy-server.ps1. Dot-source it; do not run it directly.

The calling script must define, before dot-sourcing: $root (repo root), $DryRun (switch value),
$results (a List[object]) and $info (a hashtable). Functions here read those from the caller's scope.
#>

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

# HTTP status of a GET, including error statuses (401, 404...). 0 means no response at all.
# Works in Windows PowerShell 5.1 and PowerShell 7, which report HTTP errors differently.
function Get-HttpStatus([string]$Url, [string]$Method = "GET") {
    try {
        if ($Method -eq "POST") {
            return [int](Invoke-WebRequest -Uri $Url -Method Post -Body "{}" -ContentType "application/json" -UseBasicParsing -TimeoutSec 30).StatusCode
        }
        return [int](Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec 30).StatusCode
    }
    catch {
        $response = $_.Exception.Response
        if ($response) { return [int]$response.StatusCode }
        return 0
    }
}

function Get-DotEnvValues([string]$Path) {
    $values = @{}
    foreach ($line in Get-Content $Path) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            $values[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }
    return $values
}

# Sync shared client/server logic, then require a clean git tree (the deploy uses what is on disk).
function Assert-GitReady([bool]$AllowDirty) {
    foreach ($tool in @("git", "fnm")) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "'$tool' was not found on PATH." }
    }
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
        Warn "$ahead commit(s) are not pushed yet, so the backend triggers have not built them."
    }
}

function Confirm-Deploy([string]$Plan, [bool]$Skip) {
    Write-Host ""
    Write-Host "Plan: $(if ($DryRun) { 'DRY RUN of ' })$Plan (commit $($info.Commit))" -ForegroundColor White
    if (-not $Skip -and -not $DryRun) {
        $answer = Read-Host "Type 'deploy' to continue"
        if ($answer -ne "deploy") { Write-Host "Cancelled."; exit 0 }
    }
}

function Write-StepTable {
    Write-Host ""
    Write-Host "================ summary ================" -ForegroundColor Cyan
    $results | Format-Table -AutoSize | Out-String | Write-Host
}
