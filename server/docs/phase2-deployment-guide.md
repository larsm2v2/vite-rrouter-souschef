# Phase 2 Deployment Guide: Async OCR with Pub/Sub

This guide walks through deploying the async OCR processing infrastructure to Google Cloud Platform.

## Prerequisites

- GCP project: `souschef4me`
- `gcloud` CLI authenticated and configured
- Database migration applied (003_create_ocr_jobs_table.sql)
- Server code built: `npm run build`

## Step 1: Create Pub/Sub Topic and Subscription

```powershell
# Set project
gcloud config set project souschef4me

# Create topic for OCR jobs
gcloud pubsub topics create ocr-jobs --project souschef4me

# Create subscription for worker
gcloud pubsub subscriptions create ocr-worker-sub `
  --topic=ocr-jobs `
  --ack-deadline=600 `
  --message-retention-duration=7d `
  --project souschef4me

# Verify creation
gcloud pubsub topics list --project souschef4me
gcloud pubsub subscriptions list --project souschef4me
```

## Step 2: Run Database Migration

```powershell
# Set PG_URL (use your actual connection string)
$env:PG_URL = "postgresql://user:pass@host:5432/dbname"

# Run migration
cd c:\Users\Lawrence\Documents\GitHub\vite-rroiter-souschef\server
psql $env:PG_URL -f src/05_frameworks/database/migrations/003_create_ocr_jobs_table.sql

# Verify table creation
psql $env:PG_URL -c "SELECT * FROM ocr_jobs LIMIT 1;"
```

Or use your existing migration runner:
```powershell
npm run migrate  # If integrated into db-migration.ts
```

## Step 3: Grant Pub/Sub Permissions

```powershell
# Get service account emails
$ApiServiceAccount = "souschef-api@souschef4me.iam.gserviceaccount.com"
$WorkerServiceAccount = "souschef-api@souschef4me.iam.gserviceaccount.com"  # Same or different

# Grant publisher role to API server
gcloud pubsub topics add-iam-policy-binding ocr-jobs `
  --member="serviceAccount:$ApiServiceAccount" `
  --role="roles/pubsub.publisher" `
  --project souschef4me

# Grant subscriber role to worker
gcloud pubsub subscriptions add-iam-policy-binding ocr-worker-sub `
  --member="serviceAccount:$WorkerServiceAccount" `
  --role="roles/pubsub.subscriber" `
  --project souschef4me

# Verify permissions
gcloud pubsub topics get-iam-policy ocr-jobs --project souschef4me
gcloud pubsub subscriptions get-iam-policy ocr-worker-sub --project souschef4me
```

## Step 4: Deploy Updated API Server

```powershell
cd c:\Users\Lawrence\Documents\GitHub\vite-rrouter-souschef\server

# Build
npm run build

# Deploy to Cloud Run (existing service)
gcloud run deploy souschef-api `
  --source . `
  --region us-central1 `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars GCP_PROJECT_ID=souschef4me,OCR_JOBS_TOPIC=ocr-jobs `
  --project souschef4me

# Verify deployment
$ApiUrl = (gcloud run services describe souschef-api --region us-central1 --format 'value(status.url)' --project souschef4me)
Write-Host "API deployed to: $ApiUrl"
```

## Step 5: Deploy OCR Worker

### Option A: Cloud Run (Recommended)

```powershell
# Create worker service
gcloud run deploy ocr-worker `
  --source . `
  --region us-central1 `
  --platform managed `
  --no-allow-unauthenticated `
  --min-instances 0 `
  --max-instances 10 `
  --cpu 1 `
  --memory 1Gi `
  --timeout 600 `
  --set-env-vars GCP_PROJECT_ID=souschef4me,OCR_JOBS_SUBSCRIPTION=ocr-worker-sub,NODE_ENV=production `
  --command "node,dist/workers/ocr-worker.js" `
  --project souschef4me

# Note: Add secrets for PG_URL, CLEAN_RECIPE_SERVICE_URL, etc.
# Use --set-secrets flag or Secret Manager
```

### Option B: Cloud Run Jobs

```powershell
gcloud run jobs create ocr-worker-job `
  --source . `
  --region us-central1 `
  --tasks 1 `
  --max-retries 3 `
  --cpu 1 `
  --memory 1Gi `
  --timeout 600 `
  --set-env-vars GCP_PROJECT_ID=souschef4me,OCR_JOBS_SUBSCRIPTION=ocr-worker-sub `
  --command "node,dist/workers/ocr-worker.js" `
  --project souschef4me

# Execute manually or via Cloud Scheduler
gcloud run jobs execute ocr-worker-job --region us-central1 --project souschef4me
```

### Option C: Separate Dockerfile for Worker

Create `server/Dockerfile.worker`:
```dockerfile
FROM node:20-slim

# Install Tesseract
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

CMD ["node", "dist/workers/ocr-worker.js"]
```

Build and deploy:
```powershell
cd c:\Users\Lawrence\Documents\GitHub\vite-rrouter-souschef\server

# Build worker image
gcloud builds submit --tag gcr.io/souschef4me/ocr-worker --project souschef4me

# Deploy to Cloud Run
gcloud run deploy ocr-worker `
  --image gcr.io/souschef4me/ocr-worker `
  --region us-central1 `
  --platform managed `
  --no-allow-unauthenticated `
  --min-instances 0 `
  --max-instances 10 `
  --set-env-vars GCP_PROJECT_ID=souschef4me,OCR_JOBS_SUBSCRIPTION=ocr-worker-sub `
  --project souschef4me
```

## Step 6: Verify Deployment

### Test Pub/Sub Flow

```powershell
# Publish test message
gcloud pubsub topics publish ocr-jobs `
  --message='{"jobId":"test-123","filePaths":["/tmp/test.jpg"],"userId":1}' `
  --project souschef4me

# Check worker logs
gcloud run services logs tail ocr-worker --region us-central1 --project souschef4me

# Or for Cloud Run Jobs
gcloud run jobs logs tail ocr-worker-job --region us-central1 --project souschef4me
```

### Test API Endpoint

```powershell
# Upload OCR file (requires auth token)
$Token = "YOUR_JWT_TOKEN"
$ApiUrl = "https://souschef-api-238603140451.us-central1.run.app"

curl.exe -X POST "$ApiUrl/api/ocr/upload" `
  -H "Authorization: Bearer $Token" `
  -F "image=@test-image.jpg"

# Expected response:
# {
#   "jobId": "uuid",
#   "status": "pending",
#   "statusUrl": "/api/ocr/status/uuid",
#   "message": "OCR job submitted for processing"
# }

# Check job status
$JobId = "uuid-from-response"
curl.exe "$ApiUrl/api/ocr/status/$JobId"
```

### Check Database

```powershell
psql $env:PG_URL -c "SELECT job_id, status, created_at FROM ocr_jobs ORDER BY created_at DESC LIMIT 5;"
```

## Step 7: Monitoring Setup

### Cloud Logging Filters

```
# Worker logs
resource.type="cloud_run_revision"
resource.labels.service_name="ocr-worker"
jsonPayload.type=~"ocr-job-.*"

# Failed jobs
resource.type="cloud_run_revision"
jsonPayload.type="ocr-job-processing-error"

# Pub/Sub errors
resource.type="cloud_run_revision"
jsonPayload.type="pubsub-publish-error"
```

### Metrics Dashboard

Create dashboard in GCP Console → Monitoring:
1. Pub/Sub topic publish rate
2. Subscription backlog size
3. Worker instance count
4. Average job processing time (from logs)

### Alerting Policies

```powershell
# Alert on high backlog (> 100 messages)
gcloud alpha monitoring policies create `
  --notification-channels=CHANNEL_ID `
  --display-name="OCR Backlog Alert" `
  --condition-display-name="Backlog > 100" `
  --condition-threshold-value=100 `
  --condition-threshold-duration=300s `
  --project souschef4me
```

## Step 8: Cleanup Old Jobs (Optional)

Create Cloud Scheduler job to run cleanup:

```powershell
# Create service account for cleanup
gcloud iam service-accounts create ocr-cleanup `
  --display-name="OCR Jobs Cleanup" `
  --project souschef4me

# Grant database access (configure Cloud SQL Auth Proxy or IP)

# Create Cloud Scheduler job (calls HTTP endpoint)
gcloud scheduler jobs create http ocr-cleanup-job `
  --schedule="0 2 * * *" `
  --uri="$ApiUrl/api/admin/cleanup-ocr-jobs" `
  --http-method=POST `
  --oidc-service-account-email="ocr-cleanup@souschef4me.iam.gserviceaccount.com" `
  --project souschef4me
```

Or run as cron job in worker:
```typescript
// Add to worker startup
setInterval(async () => {
  await ocrJobRepository.deleteOldJobs(30); // Delete jobs > 30 days
}, 24 * 60 * 60 * 1000); // Run daily
```

## Rollback Plan

If issues occur:

### Disable Async Processing

```powershell
# Redeploy API without GCP_PROJECT_ID env var
gcloud run deploy souschef-api `
  --update-env-vars OCR_JOBS_TOPIC="" `
  --project souschef4me

# Server will fall back to synchronous processing
```

### Pause Worker

```powershell
# Scale worker to zero
gcloud run services update ocr-worker `
  --min-instances 0 `
  --max-instances 0 `
  --region us-central1 `
  --project souschef4me
```

### Delete Infrastructure

```powershell
# Delete worker service
gcloud run services delete ocr-worker --region us-central1 --project souschef4me

# Delete subscription
gcloud pubsub subscriptions delete ocr-worker-sub --project souschef4me

# Delete topic
gcloud pubsub topics delete ocr-jobs --project souschef4me

# Drop table (careful!)
psql $env:PG_URL -c "DROP TABLE IF EXISTS ocr_jobs;"
```

## Cost Estimate

**Pub/Sub**:
- 1M jobs/month ≈ 500 MB ≈ **$0.03/month**

**Cloud Run Worker**:
- 1M jobs/month, 5s avg processing = 1,389 vCPU-hours
- At $0.024/vCPU-hour ≈ **$33/month**
- Memory (512 MB): $0.003/GiB-hour ≈ **$2/month**

**Database Storage**:
- 1M jobs ≈ 500 MB ≈ **$0.02/month** (Cloud SQL storage)

**Total**: ~$35/month for 1 million OCR jobs

## Troubleshooting

**Jobs not processing**:
```powershell
# Check worker is running
gcloud run services describe ocr-worker --region us-central1 --project souschef4me

# Check subscription backlog
gcloud pubsub subscriptions describe ocr-worker-sub --project souschef4me

# Check worker logs
gcloud run services logs tail ocr-worker --region us-central1 --project souschef4me
```

**Pub/Sub permission errors**:
```powershell
# Verify IAM bindings
gcloud pubsub topics get-iam-policy ocr-jobs --project souschef4me
gcloud pubsub subscriptions get-iam-policy ocr-worker-sub --project souschef4me
```

**Database connection errors**:
```powershell
# Test connection from worker
gcloud run services update ocr-worker `
  --set-env-vars TEST_MODE=true `
  --region us-central1 `
  --project souschef4me

# Check logs for connection errors
```

## Next Steps

1. **Test locally** with Pub/Sub emulator
2. **Deploy to staging** environment first
3. **Update client** to handle async responses (polling)
4. **Monitor metrics** for first week
5. **Optimize** worker resources based on usage
6. **Consider** WebSocket/SSE for real-time updates

---

**Phase 2 Complete!** 🎉

You now have:
- ✅ Async OCR processing with Pub/Sub
- ✅ Scalable background workers
- ✅ Job status tracking
- ✅ Graceful fallback to sync mode
- ✅ Production-ready deployment
