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
    [string]$OnlyPrefix = ""
)

Set-StrictMode -Version Latest

if (-not (Test-Path $EnvPath)) {
    Write-Error "Env file not found at path: $EnvPath"
    exit 1
}

$outDir = Join-Path -Path (Split-Path -Parent $EnvPath) -ChildPath "env"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
    Write-Host "Created directory: $outDir"
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

if ($pairs.Keys.Count -eq 0) {
    Write-Error "No variables parsed from $EnvPath"
    exit 1
}

Write-Host "Found $($pairs.Keys.Count) variables. Writing files to $outDir (values are not printed)."

foreach ($k in $pairs.Keys) {
    $filePath = Join-Path -Path $outDir -ChildPath $k
    # Write the secret value without adding extra newlines
    [System.IO.File]::WriteAllText($filePath, $pairs[$k])
    Write-Host "Wrote file for $k -> $filePath"
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
        $res = gcloud secrets describe $k --project=$Project --format="value(name)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $res) { $exists = $true }
    } catch {
        $exists = $false
    }

    if ($exists) {
        Write-Host "Adding new version to existing secret: $k"
        gcloud secrets versions add $k --data-file=$filePath --project=$Project
        if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to add version for $k" }
    } else {
        Write-Host "Creating secret: $k"
        gcloud secrets create $k --data-file=$filePath --project=$Project
        if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to create secret $k" }
    }

    if ($ServiceAccount) {
        Write-Host "Granting secretAccessor to $ServiceAccount on $k"
        gcloud secrets add-iam-policy-binding $k --project=$Project --member="serviceAccount:$ServiceAccount" --role="roles/secretmanager.secretAccessor"
        if ($LASTEXITCODE -ne 0) { Write-Warning "Failed to add IAM binding for $k and $ServiceAccount" }
    }
}

Write-Host "Done. Remember to secure or delete the folder: $outDir when finished."
