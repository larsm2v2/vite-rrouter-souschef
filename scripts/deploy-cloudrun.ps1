<#
Deploy both services to Cloud Run using their Cloud Build configs.

Usage examples:
  # Use current gcloud project
  .\scripts\deploy-cloudrun.ps1

  # Specify a project explicitly
  .\scripts\deploy-cloudrun.ps1 -ProjectId my-gcp-project

Notes:
- Requires `gcloud` installed and authenticated (run `gcloud auth login`).
- The script will:
  1. Read the current project (or use -ProjectId).
  2. Discover the existing server Cloud Run URL for the service `souschef-api`.
  3. Trigger Cloud Build using `server/cloudbuild.yaml` to build+deploy the server.
  4. Trigger Cloud Build using `clean-recipe-service/cloudbuild.yaml`, passing
     the discovered server URL via the `_SERVER_URL` substitution so the clean
     microservice receives `SERVER_URL` as an env var.
#>

param(
    [string]$ProjectId = "",
    [string]$Region = "us-central1",
    [string]$ServerServiceName = "souschef-api",
    [string]$CleanServiceName = "clean-recipe-service"
)

function Fail($msg){ Write-Error $msg; exit 1 }

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)){
    Fail "gcloud CLI not found. Install and authenticate: https://cloud.google.com/sdk/docs/install"
}

if ($ProjectId -eq ""){
    $ProjectId = (& gcloud config get-value project 2>$null).Trim()
}
if (-not $ProjectId){ Fail "No GCP project configured. Provide -ProjectId or run 'gcloud config set project <id>'." }

Write-Host "Using GCP project: $ProjectId`nRegion: $Region"

$active = (& gcloud auth list --filter=status:ACTIVE --format='value(account)')
if (-not $active){ Fail "No active gcloud account. Run 'gcloud auth login' and try again." }

Write-Host "Active account: $active`n"

Write-Host "Discovering existing server Cloud Run URL for service '$ServerServiceName'..."
$serverUrl = (& gcloud run services describe $ServerServiceName --region $Region --platform managed --format "value(status.url)" )
$serverUrl = $serverUrl.Trim()
if (-not $serverUrl){ Fail "Could not find Cloud Run service '$ServerServiceName' in project $ProjectId region $Region. Deploy that first or adjust ServerServiceName." }

Write-Host "Found server URL: $serverUrl`n"

Write-Host "Starting Cloud Build for server (server/cloudbuild.yaml)..."
& gcloud builds submit --config=server/cloudbuild.yaml server --project $ProjectId
if ($LASTEXITCODE -ne 0){ Fail "Cloud Build for server failed." }

Write-Host "Server built and deployed. Triggering Clean Recipe Service build with SERVER_URL substitution..."

& gcloud builds submit --config=clean-recipe-service/cloudbuild.yaml clean-recipe-service --project $ProjectId --substitutions=_SERVER_URL=$serverUrl
if ($LASTEXITCODE -ne 0){ Fail "Cloud Build for clean-recipe-service failed." }

Write-Host "Clean-recipe-service build submitted. Verify deployments with the following commands:`n"
Write-Host "gcloud run services describe $ServerServiceName --region $Region --platform managed --project $ProjectId --format 'value(status.url)'"
Write-Host "gcloud run services describe $CleanServiceName --region $Region --platform managed --project $ProjectId --format 'value(status.url)'`

Write-Host "Done. If you need, I can add a watch loop to wait for revision readiness and print logs.`n"
