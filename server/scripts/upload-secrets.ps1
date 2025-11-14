<#
.SYNOPSIS
  Parse a .env file, write each variable to a file under server/env, and add/create Google Secret Manager secrets

.DESCRIPTION
  This script reads the given .env file (default: ./server/.env), parses key=value pairs
  (ignoring empty lines and comments), creates per-variable files in ./server/env, and
  creates or adds versions to Google Secret Manager secrets with the same variable name.

.PARAMETER EnvPath
  Path to the .env file to parse. Defaults to './server/.env'.

.PARAMETER Project
  GCP project id to use when creating secrets. If omitted, uses the active gcloud project.

.PARAMETER ServiceAccount
  (Optional) Service account email to grant the secretAccessor role for each secret.

.PARAMETER OnlyPrefix
  (Optional) If provided, only process variables whose name starts with this prefix (e.g. 'PG_').

.EXAMPLE
  ./upload-secrets.ps1 -EnvPath .\server\.env -Project souschef4me -ServiceAccount "souschef-run-sa@souschef4me.iam.gserviceaccount.com"

NOTE: This script will NOT print secret values to the console. It writes them to files under ./server/env
      before uploading them to Secret Manager. Make sure to secure or delete that directory after use.
#>

param(
    [string]$EnvPath = "./server/.env",
    [string]$Project = $(if ((gcloud config get-value project 2>$null) -ne $null) { (gcloud config get-value project).Trim() } else { "" }),
    [string]$ServiceAccount = "",
    [string]$OnlyPrefix = "",
    [object]$Keys = $null,
    [switch]$Interactive,
    [switch]$DryRun,
    [switch]$Execute
)

Set-StrictMode -Version Latest

# Remember caller working directory so we can resolve user-supplied relative paths
$CallerPwd = (Get-Location).ProviderPath

# Ensure the script runs relative to its script folder when invoked from elsewhere
Push-Location -LiteralPath $PSScriptRoot
try {

function Get-Choice([string]$prompt,[array]$options,[string]$default) {
    if ([string]::IsNullOrWhiteSpace($default)) { $displayDefault = '(none)' } else { $displayDefault = $default }
    Write-Host $prompt
    for ($i=0; $i -lt $options.Count; $i++) {
        Write-Host "[$($i+1)] $($options[$i])"
    }
    Write-Host "[0] Keep current ($displayDefault)"
    $sel = Read-Host "Enter selection number (0 to keep current)"
    if ([string]::IsNullOrWhiteSpace($sel)) { return $default }
    if ($sel -eq '0') { return $default }
    $num = 0
    if ([int]::TryParse($sel,[ref]$num)) {
        if ($num -ge 1 -and $num -le $options.Count) { return $options[$num-1] }
    }
    Write-Warning "Invalid selection, keeping current: $displayDefault"
    return $default
}

# If interactive requested or missing project/sa, run an inline selection helper (local copy of select-project-and-sa.ps1)
if ($Interactive -or [string]::IsNullOrWhiteSpace($Project) -or [string]::IsNullOrWhiteSpace($ServiceAccount)) {
    # Get current configured project
    $currentProject = (gcloud config get-value project 2>$null).Trim()
    if (-not $currentProject) { $currentProject = "" }

    # Fetch up to 50 projects
    $projList = @()
    try { $projList = @(gcloud projects list --format="value(projectId)" 2>$null | Select-Object -First 50) } catch { $projList = @() }
    $projList = $projList | Where-Object { $_ -and $_ -ne $currentProject }

    # Prefer an explicitly supplied $Project string; otherwise fall back to the current gcloud project.
    if (-not [string]::IsNullOrWhiteSpace($Project)) { $chosenProject = $Project } else { $chosenProject = $currentProject }
    if ($projList.Count -gt 0) {
        $chosenProject = Get-Choice "Select GCP project to use:" $projList $chosenProject
        if ($chosenProject -and $chosenProject -ne $currentProject) {
            Write-Host "Setting active gcloud project to: $chosenProject"
            gcloud config set project $chosenProject | Out-Null
        }
    }

    if (-not $chosenProject) {
        Write-Error "No project selected or configured."
        exit 1
    }

    # List service accounts in the chosen project
    $saList = @()
    try { $saList = @(gcloud iam service-accounts list --project=$chosenProject --format="value(email)" 2>$null) } catch { $saList = @() }
    $saList = $saList | Where-Object { $_ -and $_ -ne '' }

    $selectedSa = $ServiceAccount
    if ($saList.Count -eq 0) {
        Write-Warning "No service accounts found in project: $chosenProject"
    } else {
        $selectedSa = Get-Choice "Select service account to use (0 to skip):" $saList $selectedSa
        if ([string]::IsNullOrWhiteSpace($selectedSa)) { $selectedSa = $null }
    }

    # Apply selections back to params
    $Project = $chosenProject
    $ServiceAccount = $selectedSa

    # Print JSON for downstream parsing if needed
    if (-not [string]::IsNullOrWhiteSpace($ServiceAccount)) { $saValue = $ServiceAccount } else { $saValue = $null }
    $selResult = @{ project = $Project; serviceAccount = $saValue }
    Write-Host "Selection: $($selResult | ConvertTo-Json -Compress)"
}

# Resolve EnvPath: allow the user to pass a path relative to their original CWD
$resolvedEnvPath = $EnvPath
if (-not (Test-Path $resolvedEnvPath)) {
    $candidate = Join-Path -Path $CallerPwd -ChildPath $EnvPath
    if (Test-Path $candidate) { $resolvedEnvPath = $candidate }
}
if (-not (Test-Path $resolvedEnvPath)) {
    Write-Error "Env file not found at path: $EnvPath"
    exit 1
}

# Use the resolved path from here on
$EnvPath = $resolvedEnvPath

$outDir = Join-Path -Path (Split-Path -Parent $EnvPath) -ChildPath "env"
    if (-not (Test-Path $outDir)) {
    if ($DryRun) {
        Write-Host "DRYRUN: would create directory: $outDir"
    } else {
        New-Item -ItemType Directory -Path $outDir | Out-Null
        Write-Host "Created directory: $outDir"
    }
}

Write-Host "Parsing $EnvPath..."
$content = Get-Content -Path $EnvPath -Raw -ErrorAction Stop

$pairs = @{}
foreach ($line in $content -split "`n") {
    $l = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($l)) { continue }
    if ($l.StartsWith('#')) { continue }
    $parts = $l -split('=',2)
    if ($parts.Count -lt 2) { continue }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim()
    # Remove surrounding quotes if present
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1,$val.Length-2) }
    if ($val.StartsWith("'") -and $val.EndsWith("'")) { $val = $val.Substring(1,$val.Length-2) }
    $pairs[$key] = $val
}

if ($OnlyPrefix) {
    $pairs = $pairs.GetEnumerator() | Where-Object { $_.Name.StartsWith($OnlyPrefix) } | ForEach-Object { @{$_.Name = $_.Value} } | ForEach-Object { $_ }
    # Rebuild hashtable from enumeration
    $tmp = @{}
    foreach ($kv in $pairs) { $tmp[$kv.Keys] = $kv.Values }
    $pairs = $tmp
}

# If user supplied -Keys, parse it (JSON string, comma list, or array) and filter to only those keys
if ($Keys) {
    $requested = @()
    if ($Keys -is [string]) {
        try {
            $requested = ConvertFrom-Json -InputObject $Keys
        } catch {
            # fallback to comma-separated
            $requested = $Keys -split ','
        }
    } elseif ($Keys -is [System.Collections.IEnumerable]) {
        $requested = @($Keys)
    } else {
        $requested = @($Keys.ToString())
    }
    $requested = $requested | ForEach-Object { $_.ToString().Trim() } | Where-Object { $_ -ne '' }

    $filtered = @{}
    foreach ($rk in $requested) {
        if ($pairs.ContainsKey($rk)) {
            $filtered[$rk] = $pairs[$rk]
        } else {
            Write-Warning "Requested key '$rk' not found in $EnvPath; skipping."
        }
    }
    $pairs = $filtered
}

if ($pairs.Keys.Count -eq 0) {
    Write-Error "No variables parsed from $EnvPath"
    exit 1
}

Write-Host "Found $($pairs.Keys.Count) variables. Writing files to $outDir (values are not printed)."

# Guard: require explicit confirmation for live runs (unless DryRun).
if (-not $DryRun) {
    if (-not $Execute) {
        Write-Host "WARNING: You are about to perform LIVE changes against project: $Project"
        $confirm = Read-Host "Type 'EXECUTE' (all caps) to proceed, or anything else to abort"
        if ($confirm -ne 'EXECUTE') {
            Write-Host "Aborted by user. No changes were made."
            exit 0
        }
    } else {
        Write-Host "-Execute provided: proceeding with live updates."
    }
} else {
    Write-Host "Dry run: no live changes will be made."
}

foreach ($k in $pairs.Keys) {
    $filePath = Join-Path -Path $outDir -ChildPath $k
    if ($DryRun) {
        Write-Host "DRYRUN: would write file for $k -> $filePath (value omitted)"
    } else {
        # Write the secret value without adding extra newlines
        [System.IO.File]::WriteAllText($filePath, $pairs[$k])
        Write-Host "Wrote file for $k -> $filePath"
    }
}

if (-not $Project) {
    Write-Host "No --Project specified. Using gcloud's active project."
    $Project = (gcloud config get-value project 2>$null).Trim()
}

if (-not $Project) {
    Write-Error "No GCP project available. Set --Project or run 'gcloud config set project <PROJECT>'"
    exit 1
}

Write-Host "Uploading secrets to project: $Project"

foreach ($k in $pairs.Keys) {
    $filePath = Join-Path -Path $outDir -ChildPath $k
    if (-not (Test-Path $filePath)) { Write-Warning "File missing for $k, skipping"; continue }

    # Determine if secret exists
    $exists = $false
    try {
        # It's safe to describe secrets even in DryRun (read-only) so we can determine existence accurately.
        $res = gcloud secrets describe $k --project=$Project --format="value(name)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $res) { $exists = $true }
    } catch {
        $exists = $false
    }

    if ($exists) {
        if ($DryRun) {
            Write-Host "DRYRUN: would add new version to existing secret: $k"
            Write-Host ('DRYRUN: gcloud secrets versions add {0} --data-file={1} --project={2}' -f $k, $filePath, $Project)
        } else {
            Write-Host "Adding new version to existing secret: $k"
            gcloud secrets versions add $k --data-file=$filePath --project=$Project
            if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to add version for $k" }
        }
    } else {
        if ($DryRun) {
            Write-Host "DRYRUN: would create secret: $k"
            Write-Host ('DRYRUN: gcloud secrets create {0} --data-file={1} --project={2}' -f $k, $filePath, $Project)
        } else {
            Write-Host "Creating secret: $k"
            gcloud secrets create $k --data-file=$filePath --project=$Project
            if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to create secret $k" }
        }
    }

    if ($ServiceAccount) {
        if ($DryRun) {
            Write-Host "DRYRUN: would grant roles/secretmanager.secretAccessor to $ServiceAccount on $k"
            Write-Host ('DRYRUN: gcloud secrets add-iam-policy-binding {0} --project={1} --member="serviceAccount:{2}" --role="roles/secretmanager.secretAccessor"' -f $k, $Project, $ServiceAccount)
        } else {
            Write-Host "Granting secretAccessor to $ServiceAccount on $k"
            gcloud secrets add-iam-policy-binding $k --project=$Project --member="serviceAccount:$ServiceAccount" --role="roles/secretmanager.secretAccessor"
            if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to add IAM binding for $k and $ServiceAccount" }
        }
    }
}

Write-Host "Done. Remember to secure or delete the folder: $outDir when finished."

} finally {
    # Restore caller's working directory
    Pop-Location
}
