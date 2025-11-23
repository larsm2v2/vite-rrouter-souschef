# Async OCR Processing with Pub/Sub

This document describes the asynchronous OCR processing implementation using Google Cloud Pub/Sub.

## Overview

The async OCR implementation allows the API to return immediately after receiving an OCR request, while processing happens in the background. This improves:
- **User Experience**: No long waits for OCR processing
- **Scalability**: Workers can scale independently from the API
- **Resilience**: Failed jobs can be retried automatically
- **Resource Efficiency**: Better CPU/memory utilization

## Architecture

```
Client → API Server → Pub/Sub → Worker(s) → Database
         ↓                                      ↑
         Database (job created)                 |
         ↓                                      |
         Return jobId to client                 |
         ↓                                      |
         Client polls /status/:jobId ←----------+
```

## Components

### 1. Database Schema (`ocr_jobs` table)

Stores job metadata and results:
- `job_id`: Unique UUID for each job
- `user_id`: Optional user association
- `status`: `pending` | `processing` | `completed` | `failed`
- `file_paths`: Array of file paths to process
- `ocr_text`: Raw OCR output
- `result`: Final cleaned recipe (JSONB)
- `error`: Error message if failed
- `processing_time_ms`: Time taken to process
- Timestamps: `created_at`, `updated_at`

**Migration**: `server/src/05_frameworks/database/migrations/003_create_ocr_jobs_table.sql`

### 2. Repository (`OcrJobRepository`)

CRUD operations for jobs:
- `create()`: Create new job with pending status
- `findByJobId()`: Get job by UUID
- `findByUserId()`: Get user's jobs
- `update()`: Update job status/result
- `deleteOldJobs()`: Cleanup completed jobs older than N days

**File**: `server/src/03_adapters/repositories/OcrJobRepository.ts`

### 3. Pub/Sub Client

Publisher for creating OCR jobs:
- `publishOcrJob()`: Publish job to `ocr-jobs` topic
- `isPubSubAvailable()`: Check if Pub/Sub is configured
- Auto-creates topic if missing
- Structured JSON logging

**File**: `server/src/05_frameworks/pubsub/client.ts`

### 4. OCR Routes (Modified)

**Async Mode** (when Pub/Sub available):
1. Store uploaded files
2. Create job record (status: `pending`)
3. Publish to Pub/Sub
4. Return `{ jobId, status, statusUrl }`

**Sync Mode** (fallback):
- Original synchronous behavior if Pub/Sub unavailable

**New Endpoint**: `GET /api/ocr/status/:jobId`
- Returns current job status
- Includes result when status = `completed`
- Includes error when status = `failed`

**File**: `server/src/routes/ocr.ts`

### 5. OCR Worker

Background worker that:
1. Subscribes to `ocr-worker-sub` (Pub/Sub subscription)
2. Pulls messages (job data)
3. Updates job status to `processing`
4. Runs Tesseract OCR on files
5. Calls clean-recipe-service
6. Updates job with result or error
7. Acks/nacks message

**File**: `server/src/workers/ocr-worker.ts`

## Setup

### 1. Run Database Migration

```bash
# From server directory
psql $PG_URL -f src/05_frameworks/database/migrations/003_create_ocr_jobs_table.sql
```

Or integrate with your existing migration runner.

### 2. Create Pub/Sub Infrastructure (GCP)

```bash
# Set project
gcloud config set project souschef4me

# Create topic
gcloud pubsub topics create ocr-jobs

# Create subscription
gcloud pubsub subscriptions create ocr-worker-sub \
  --topic=ocr-jobs \
  --ack-deadline=600 \
  --message-retention-duration=7d

# Grant permissions (if using service accounts)
# For API server (publisher)
gcloud pubsub topics add-iam-policy-binding ocr-jobs \
  --member="serviceAccount:YOUR_API_SA@souschef4me.iam.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# For worker (subscriber)
gcloud pubsub subscriptions add-iam-policy-binding ocr-worker-sub \
  --member="serviceAccount:YOUR_WORKER_SA@souschef4me.iam.gserviceaccount.com" \
  --role="roles/pubsub.subscriber"
```

### 3. Environment Variables

**API Server** (`server/env/`):
```
GCP_PROJECT_ID=souschef4me
OCR_JOBS_TOPIC=ocr-jobs  # Optional, defaults to "ocr-jobs"
```

**Worker** (same or separate deployment):
```
GCP_PROJECT_ID=souschef4me
OCR_JOBS_SUBSCRIPTION=ocr-worker-sub  # Optional, defaults to "ocr-worker-sub"
PG_URL=postgresql://...  # Database connection
CLEAN_RECIPE_SERVICE_URL=https://...  # Microservice URL
```

### 4. Running the Worker

**Development** (local):
```bash
cd server
npm run build
node dist/workers/ocr-worker.js
```

**Production** (Cloud Run):
Deploy as separate service:
```bash
gcloud run deploy ocr-worker \
  --source . \
  --region us-central1 \
  --platform managed \
  --no-allow-unauthenticated \
  --set-env-vars GCP_PROJECT_ID=souschef4me,OCR_JOBS_SUBSCRIPTION=ocr-worker-sub \
  --set-secrets PG_URL=PG_URL:latest \
  --command="node,dist/workers/ocr-worker.js"
```

Or use Cloud Functions/Cloud Run Jobs.

## Client Integration

### Before (Synchronous)

```typescript
// Upload and wait for result
const response = await fetch('/api/ocr/upload', {
  method: 'POST',
  body: formData
});
const { parsed } = await response.json();
displayRecipe(parsed);
```

### After (Asynchronous)

```typescript
// 1. Submit job
const response = await fetch('/api/ocr/upload', {
  method: 'POST',
  body: formData
});
const { jobId, statusUrl } = await response.json();

// 2. Poll for completion
const pollInterval = setInterval(async () => {
  const statusResponse = await fetch(statusUrl);
  const job = await statusResponse.json();
  
  if (job.status === 'completed') {
    clearInterval(pollInterval);
    displayRecipe(job.result);
  } else if (job.status === 'failed') {
    clearInterval(pollInterval);
    displayError(job.error);
  }
  // Keep polling if status is 'pending' or 'processing'
}, 2000); // Poll every 2 seconds
```

Or use WebSockets/Server-Sent Events for real-time updates (future enhancement).

## Monitoring

### Job Status Query

```sql
-- Recent jobs
SELECT job_id, status, created_at, updated_at, processing_time_ms
FROM ocr_jobs
ORDER BY created_at DESC
LIMIT 20;

-- Failed jobs
SELECT job_id, error, created_at
FROM ocr_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;

-- Average processing time
SELECT AVG(processing_time_ms) as avg_ms
FROM ocr_jobs
WHERE status = 'completed';
```

### Pub/Sub Metrics (GCP Console)

- Topic: `ocr-jobs` → Message publish rate
- Subscription: `ocr-worker-sub` → Oldest unacked message age, backlog

### Logs

All components log structured JSON:
```json
{
  "type": "ocr-job-created",
  "jobId": "uuid",
  "userId": 123,
  "fileCount": 2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Search Cloud Logging:
```
resource.type="cloud_run_revision"
jsonPayload.type="ocr-job-processing-error"
```

## Maintenance

### Cleanup Old Jobs

Run periodically (cron/Cloud Scheduler):
```typescript
import { ocrJobRepository } from './src/03_adapters/repositories/OcrJobRepository';

// Delete completed jobs older than 30 days
await ocrJobRepository.deleteOldJobs(30);
```

### Retry Failed Jobs

Manual retry (future enhancement):
```sql
-- Find failed job
SELECT job_id, file_paths, ocr_text FROM ocr_jobs WHERE job_id = 'uuid';

-- Reset to pending and republish (implement in admin endpoint)
UPDATE ocr_jobs SET status = 'pending', error = NULL WHERE job_id = 'uuid';
-- Then republish to Pub/Sub
```

## Fallback Behavior

If Pub/Sub is **not available** (local dev, Pub/Sub outage):
- `isPubSubAvailable()` returns `false`
- Routes automatically fall back to **synchronous processing**
- No code changes needed
- Check startup logs: `"OCR async processing disabled (Pub/Sub unavailable, using sync mode)"`

## Cost Considerations

**Pub/Sub Pricing** (as of 2024):
- First 10 GB/month: Free
- Beyond 10 GB: $0.06/GB

**Typical OCR job message**: ~500 bytes
- 1 million jobs ≈ 500 MB ≈ **$0.03**

**Cloud Run Worker**:
- Pay only when processing messages
- Scales to zero when idle
- Recommend: 1 vCPU, 512 MB memory, max 10 instances

## Testing

### Local Development (Pub/Sub Emulator)

```bash
# Install emulator
gcloud components install pubsub-emulator

# Start emulator
gcloud beta emulators pubsub start --project=souschef4me

# In another terminal, set env
export PUBSUB_EMULATOR_HOST=localhost:8085
export GCP_PROJECT_ID=souschef4me

# Run worker
node dist/workers/ocr-worker.js

# Run server
npm run dev
```

### Manual Testing

```bash
# Submit job
curl -X POST https://your-api.run.app/api/ocr/upload \
  -F "image=@test.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response: { "jobId": "uuid", "status": "pending", "statusUrl": "/api/ocr/status/uuid" }

# Check status
curl https://your-api.run.app/api/ocr/status/UUID

# Watch worker logs
gcloud run logs tail ocr-worker --project souschef4me
```

## Future Enhancements

1. **WebSocket/SSE**: Real-time status updates (no polling)
2. **Batch Processing**: Process multiple jobs together
3. **Priority Queues**: Premium users get faster processing
4. **Result Caching**: Store OCR results in Cloud Storage
5. **Admin Dashboard**: View all jobs, retry failures
6. **Metrics/Alerting**: Track job success rate, processing time

## Troubleshooting

**Jobs stuck in `pending`**:
- Check worker logs: `gcloud run logs tail ocr-worker`
- Verify subscription exists: `gcloud pubsub subscriptions list`
- Check Pub/Sub backlog: GCP Console → Pub/Sub → Subscriptions

**Jobs fail with Tesseract error**:
- Ensure worker container has `tesseract-ocr` installed
- Check Dockerfile: `RUN apt-get install -y tesseract-ocr`

**Pub/Sub permission errors**:
- Verify service account has `pubsub.publisher` (API) and `pubsub.subscriber` (worker) roles
- Check IAM bindings: `gcloud pubsub topics get-iam-policy ocr-jobs`

**Database connection errors in worker**:
- Verify `PG_URL` secret is set
- Check Cloud SQL connection (public IP or Cloud SQL Proxy)
- Test connection: `psql $PG_URL -c "SELECT 1"`
