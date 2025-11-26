# API Gateway & Async Communication Architecture Plan

**Date:** November 22, 2025  
**Project:** SousChef Recipe Application  
**Status:** Planning Document

## Executive Summary

This document outlines the evolution of the current client → server → microservice architecture to a more robust pattern using:

- **API Gateway** for client-facing requests
- **Synchronous HTTP/gRPC** for real-time service-to-service communication
- **Asynchronous Pub/Sub** for background/long-running operations

**Key Principle:** Improve the existing 3-service setup (client, server, clean-recipe-service) without adding new services.

---

## Current Architecture Analysis

### What We Have Today

```
┌─────────────┐
│   Client    │ (React + Vite)
│ (Browser)   │
└──────┬──────┘
       │ HTTP/HTTPS
       │ withCredentials: true
       │ Authorization: Bearer <JWT>
       ▼
┌─────────────────────────────────────┐
│   Server (souschef-api)             │
│   - Express.js                      │
│   - JWT auth + refresh tokens       │
│   - PostgreSQL (recipes, users)     │
│   - Routes: /auth, /api/recipes,    │
│     /api/ocr, /api/grocery          │
└──────┬──────────────────────────────┘
       │ HTTP (synchronous)
       │ Authorization: Bearer <ID_TOKEN>
       │ (GCP metadata-issued)
       ▼
┌─────────────────────────────────────┐
│   clean-recipe-service              │
│   - Node/Express microservice       │
│   - Native Tesseract + image libs   │
│   - POST /clean-recipe              │
│   - Stateless recipe cleaning       │
└─────────────────────────────────────┘
```

### Current Strengths

✅ **Clean separation of concerns**

- Server handles auth, DB, business logic
- Microservice isolates native dependencies (Tesseract)
- Client is framework-isolated (React SPA)

✅ **Service-to-service auth**

- ID token-based authentication (GCP metadata)
- Cached tokens with expiry tracking
- Fallback to local cleaner if microservice unavailable

✅ **Client auth flow**

- HttpOnly refresh tokens (rotation on `/auth/refresh`)
- Access token in localStorage
- Axios interceptor handles token refresh + retry queue

### Current Pain Points

❌ **Tightly coupled synchronous flow**

- Client waits for server → microservice round trip
- OCR processing (Tesseract) blocks the HTTP response
- No way to handle long-running tasks (image preprocessing, batch OCR)

❌ **No centralized gateway**

- Client directly hits different server routes (`/auth`, `/api/*`)
- CORS, rate limiting, and auth logic scattered across routes
- Hard to add cross-cutting concerns (logging, metrics, circuit breakers)

❌ **Limited scalability**

- Server forwards requests synchronously to microservice
- If clean-recipe-service is slow/down, entire OCR flow fails
- No queue for retry or background processing

❌ **Lack of async capabilities**

- All operations are request-response
- Cannot defer heavy processing (e.g., batch recipe imports, scheduled grocery list updates)

---

## Proposed Architecture

### High-Level Pattern

```
┌─────────────┐
│   Client    │ (React + Vite)
└──────┬──────┘
       │
       │ HTTPS
       │ Authorization: Bearer <JWT>
       ▼
┌─────────────────────────────────────┐
│   API Gateway Layer                 │  ← NEW
│   (Cloud Run service or             │
│    enhanced Express middleware)     │
│                                     │
│   - Auth validation (JWT)           │
│   - Rate limiting                   │
│   - CORS                            │
│   - Request routing                 │
│   - Circuit breaker                 │
│   - Logging/metrics                 │
└──────┬──────────────────────────────┘
       │
       ├──────────────────────┬─────────────────┐
       │                      │                 │
       ▼                      ▼                 ▼
┌─────────────┐      ┌─────────────┐   ┌──────────────┐
│   Server    │      │  Pub/Sub    │   │ Other future │
│ (souschef-  │      │  Topics     │   │  services    │
│  api)       │      │             │   └──────────────┘
│             │      │ - ocr-jobs  │
│ Synchronous │      │ - batch-    │
│ operations: │      │   imports   │
│ - Auth      │      │             │
│ - CRUD      │      └──────┬──────┘
│ - Real-time │             │ Pub/Sub messages
│   queries   │             │ (async, deferred)
└──────┬──────┘             │
       │                    ▼
       │ HTTP/gRPC   ┌─────────────────────┐
       │ (sync)      │  Background Workers │  ← NEW
       └────────────►│  (Cloud Run jobs or │
                     │   server instances  │
                     │   subscribed to     │
                     │   Pub/Sub)          │
                     │                     │
                     │ - OCR processing    │
                     │ - Recipe cleaning   │
                     │ - Batch imports     │
                     └──────┬──────────────┘
                            │ HTTP
                            │ Authorization: Bearer <ID_TOKEN>
                            ▼
                     ┌─────────────────────┐
                     │ clean-recipe-service│
                     │ (existing)          │
                     └─────────────────────┘
```

### Communication Patterns

#### 1. Client → API Gateway → Server (Synchronous)

**Use for:**

- User authentication (login, register, refresh)
- Real-time queries (get recipes, get user profile)
- CRUD operations requiring immediate response

**Protocol:** HTTPS / REST  
**Auth:** JWT access token + refresh token (HttpOnly cookie)

#### 2. API Gateway → Pub/Sub → Workers (Asynchronous)

**Use for:**

- OCR image processing (can take 5-30 seconds)
- Batch recipe imports
- Scheduled tasks (grocery list aggregation, meal plan generation)

**Protocol:** Google Cloud Pub/Sub (or equivalent message queue)  
**Auth:** Service account credentials

#### 3. Server ↔ clean-recipe-service (Synchronous)

**Use for:**

- Recipe cleaning/normalization (fast, stateless)
- Real-time text parsing

**Protocol:** HTTP / gRPC  
**Auth:** GCP ID token (metadata server)

---

## Implementation Plan

### Phase 1: API Gateway Layer (Immediate)

**Goal:** Centralize cross-cutting concerns without changing client code significantly.

#### Option A: Enhanced Express Middleware (Low effort, immediate)

Add a gateway router in the server that consolidates:

- Auth validation
- Rate limiting
- CORS
- Logging/metrics

**Steps:**

1. Create `server/src/05_frameworks/myexpress/gateway/index.ts`
2. Move CORS, rate limiting, JWT validation to gateway middleware
3. Mount gateway before route handlers
4. Add circuit breaker for microservice calls (use `opossum` or similar)

**Files to create/modify:**

```
server/src/05_frameworks/myexpress/gateway/
├── index.ts          # Main gateway router
├── auth.middleware.ts # JWT validation
├── rateLimit.ts      # Rate limiting
├── cors.ts           # CORS config
├── circuitBreaker.ts # Circuit breaker for external services
└── logging.ts        # Structured logging
```

**Pros:**

- No new infrastructure
- Reuses existing Express server
- Easy to test locally

**Cons:**

- Still a monolith (gateway + business logic in one service)
- Harder to scale gateway independently

#### Option B: Separate Cloud Run Gateway Service (Medium effort, better long-term)

Deploy a lightweight Express/Fastify service as a dedicated gateway.

**Steps:**

1. Create `gateway/` folder at workspace root
2. Implement thin gateway service (auth, routing, rate limit)
3. Deploy to Cloud Run with `--allow-unauthenticated` (public-facing)
4. Route requests to `souschef-api` (make it private, require invoker role)
5. Update client `VITE_API_URL` to point to gateway

**Pros:**

- Clear separation of concerns
- Can scale gateway independently
- Easier to add future services

**Cons:**

- More deployment complexity
- Extra network hop (minimal latency with Cloud Run regional deployment)

**Recommendation:** Start with **Option A** (enhanced middleware) for immediate improvement, migrate to **Option B** when scaling becomes a priority.

---

### Phase 2: Async Processing with Pub/Sub (High-impact)

**Goal:** Decouple slow operations (OCR, batch imports) from HTTP request-response cycle.

#### Architecture

```
Client submits OCR job
       ↓
API Gateway validates + publishes message to Pub/Sub topic
       ↓
Immediate response: { jobId: "abc123", status: "pending" }
       ↓
Client polls /api/ocr/status/:jobId or uses WebSocket/SSE
       ↓
Background worker pulls message from Pub/Sub subscription
       ↓
Worker calls clean-recipe-service, updates job status in DB
       ↓
Client retrieves result when status = "completed"
```

#### Implementation Steps

**1. Add Pub/Sub topic and subscription**

```powershell
# Create topic for OCR jobs
gcloud pubsub topics create ocr-jobs --project souschef4me

# Create subscription for worker
gcloud pubsub subscriptions create ocr-worker-sub --topic ocr-jobs --project souschef4me
```

**2. Modify server to publish messages instead of blocking**

Create `server/src/05_frameworks/pubsub/client.ts`:

```typescript
import { PubSub } from "@google-cloud/pubsub";

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });

export async function publishOcrJob(jobId: string, imageData: any) {
  const topic = pubsub.topic("ocr-jobs");
  const message = {
    jobId,
    imageData,
    timestamp: Date.now(),
  };
  await topic.publishMessage({ json: message });
}
```

**3. Update OCR route to be async-first**

Modify `server/src/routes/ocr.ts`:

```typescript
router.post("/ocr/upload", async (req, res) => {
  const jobId = generateJobId();

  // Store job metadata in DB (status: pending)
  await ocrJobRepository.create({
    jobId,
    status: "pending",
    userId: req.user.id,
  });

  // Publish to Pub/Sub
  await publishOcrJob(jobId, { files: req.files });

  // Immediate response
  res.json({ jobId, status: "pending", statusUrl: `/api/ocr/status/${jobId}` });
});

router.get("/ocr/status/:jobId", async (req, res) => {
  const job = await ocrJobRepository.findById(req.params.jobId);
  res.json(job);
});
```

**4. Create background worker**

Option 1: Separate Cloud Run job (triggered by Pub/Sub push subscription)
Option 2: Long-running server process that pulls from subscription

Create `server/src/workers/ocr-worker.ts`:

```typescript
import { PubSub } from "@google-cloud/pubsub";
import { cleanRecipe } from "../05_frameworks/cleanRecipe/client";

const pubsub = new PubSub();
const subscription = pubsub.subscription("ocr-worker-sub");

subscription.on("message", async (message) => {
  const { jobId, imageData } = message.json;

  try {
    // Process OCR (run Tesseract)
    const ocrText = await runTesseract(imageData);

    // Call clean-recipe-service
    const cleaned = await cleanRecipe({ text: ocrText });

    // Update job status
    await ocrJobRepository.update(jobId, {
      status: "completed",
      result: cleaned,
    });

    message.ack();
  } catch (err) {
    await ocrJobRepository.update(jobId, {
      status: "failed",
      error: err.message,
    });
    message.nack();
  }
});
```

**5. Add job status table**

Migration:

```sql
CREATE TABLE ocr_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL, -- pending, processing, completed, failed
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX idx_ocr_jobs_status ON ocr_jobs(status);
```

**6. Client updates**

Update `client/src/utils/ocr.ts`:

```typescript
export async function uploadOcrImages(files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("images", f));

  // Submit job
  const { jobId, statusUrl } = await apiClient.post(
    "/api/ocr/upload",
    formData
  );

  // Poll for result
  return pollJobStatus(statusUrl);
}

async function pollJobStatus(url: string, interval = 2000, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const { status, result, error } = await apiClient.get(url);

    if (status === "completed") return result;
    if (status === "failed") throw new Error(error);

    await sleep(interval);
  }
  throw new Error("Job timed out");
}
```

---

### Phase 3: gRPC for Server ↔ Microservice (Optional, Performance)

**Goal:** Replace HTTP with gRPC for faster, more efficient service-to-service calls.

**When to use:**

- High-volume inter-service communication
- Need for streaming (e.g., batch recipe processing)
- Strict typing and code generation

**Trade-offs:**

- More complex setup (protobuf definitions, code generation)
- Requires gRPC libraries on both sides
- Debugging is harder (binary protocol)

**Recommendation:** Defer this until request volume justifies the complexity. HTTP with connection pooling is sufficient for current scale.

---

## Migration Strategy

### Step-by-Step Rollout

#### Week 1: Gateway Middleware (Phase 1A)

- [ ] Create gateway middleware folder structure
- [ ] Move CORS config to `gateway/cors.ts`
- [ ] Move rate limiting to `gateway/rateLimit.ts`
- [ ] Add circuit breaker for clean-recipe-service calls
- [ ] Add structured logging (Winston or Pino)
- [ ] Test locally
- [ ] Deploy to staging
- [ ] Monitor logs and metrics

#### Week 2-3: Pub/Sub Infrastructure (Phase 2)

- [ ] Set up Pub/Sub topic and subscription in GCP
- [ ] Create OCR jobs table migration
- [ ] Implement `publishOcrJob` function
- [ ] Update `/api/ocr/upload` to publish messages
- [ ] Create `/api/ocr/status/:jobId` endpoint
- [ ] Test message publishing locally (use emulator)

#### Week 4: Background Worker (Phase 2)

- [ ] Create `ocr-worker.ts` subscriber
- [ ] Test worker locally with Pub/Sub emulator
- [ ] Deploy worker as Cloud Run job or long-running service
- [ ] Grant worker service account access to Pub/Sub and DB
- [ ] Monitor worker logs and dead-letter queue

#### Week 5: Client Updates (Phase 2)

- [ ] Update OCR modal to poll job status
- [ ] Add loading/progress UI
- [ ] Add error handling for failed jobs
- [ ] Test end-to-end flow
- [ ] Deploy to production

#### Week 6+: Optional Enhancements

- [ ] Add WebSocket/SSE for real-time status updates (avoid polling)
- [ ] Implement job retry logic (exponential backoff)
- [ ] Add dead-letter queue for failed messages
- [ ] Metrics dashboard (Cloud Monitoring)
- [ ] Evaluate gRPC for high-volume routes

---

## Technology Choices

### API Gateway Options

| Option                 | Pros                 | Cons              | Recommendation |
| ---------------------- | -------------------- | ----------------- | -------------- |
| **Express middleware** | Simple, no new infra | Coupled to server | ✅ Start here  |
| **Cloud Run service**  | Scalable, decoupled  | Extra deploy step | Next phase     |
| **Cloud Endpoints**    | GCP-native, OpenAPI  | Vendor lock-in    | Evaluate later |
| **Kong/Nginx**         | Feature-rich, OSS    | Complex setup     | Overkill       |

### Message Queue Options

| Option            | Pros                     | Cons          | Recommendation   |
| ----------------- | ------------------------ | ------------- | ---------------- |
| **GCP Pub/Sub**   | Native, scalable, simple | GCP-only      | ✅ Best for GCP  |
| **Cloud Tasks**   | HTTP push, retries       | Less flexible | Good alternative |
| **RabbitMQ**      | Self-hosted, flexible    | Ops overhead  | Avoid            |
| **Redis Streams** | Fast, simple             | Not durable   | Dev/test only    |

### Service Communication

| Protocol      | Use Case                 | Recommendation      |
| ------------- | ------------------------ | ------------------- |
| **HTTP/REST** | Most routes              | ✅ Current, keep    |
| **gRPC**      | High-volume, streaming   | Future optimization |
| **WebSocket** | Real-time client updates | Add for job status  |

---

## Observability & Monitoring

### Key Metrics to Track

1. **Gateway metrics**

   - Request rate (requests/sec)
   - Error rate (4xx, 5xx)
   - Latency (p50, p95, p99)
   - Circuit breaker state changes

2. **Pub/Sub metrics**

   - Message publish rate
   - Message processing latency
   - Dead-letter queue size
   - Worker backlog

3. **Service-to-service metrics**
   - clean-recipe-service response time
   - Token refresh frequency
   - Fallback invocations (local cleaner usage)

### Logging Strategy

**Structured logging with context:**

```typescript
logger.info("OCR job submitted", {
  jobId,
  userId: req.user.id,
  fileCount: files.length,
  source: "api-gateway",
  timestamp: Date.now(),
});
```

**Trace propagation:**

- Add `X-Request-ID` header to all requests
- Pass trace ID through Pub/Sub messages
- Log trace ID in worker processes

---

## Security Considerations

### Gateway Layer

- ✅ JWT validation at gateway (current)
- ✅ Rate limiting per user/IP
- ➕ Add request size limits
- ➕ Add API key support (for future integrations)
- ➕ Add CSRF protection for state-changing operations

### Service-to-Service

- ✅ ID token auth (GCP metadata)
- ✅ Private Cloud Run services (invoker role)
- ➕ Add mTLS for non-GCP deployments
- ➕ Add request signing for Pub/Sub messages

### Data Security

- ✅ HttpOnly refresh tokens
- ✅ Encrypted database (PG_ENCRYPTION_KEY)
- ➕ Add field-level encryption for PII
- ➕ Add audit logging for sensitive operations

---

## Cost Implications

### Current Monthly Cost (estimated)

- Cloud Run (server): ~$20-50 (depending on traffic)
- Cloud Run (clean-recipe-service): ~$10-20
- Cloud SQL (PostgreSQL): ~$50-100
- **Total: ~$80-170/month**

### With Proposed Changes

- API Gateway (if separate service): +$10-20
- Pub/Sub: +$5-15 (first 10GB free)
- Background workers: +$10-30 (depends on job volume)
- **New Total: ~$105-235/month**

**Cost optimization tips:**

- Use Cloud Run min instances = 0 (scale to zero when idle)
- Set Pub/Sub message retention to 1-2 days
- Use Cloud Tasks instead of Pub/Sub for low-volume jobs (cheaper)

---

## Testing Strategy

### Gateway Tests

- Unit tests for middleware (auth, rate limit, CORS)
- Integration tests for routing logic
- Load tests (use `k6` or `artillery`)

### Pub/Sub Tests

- Use Pub/Sub emulator for local dev
- Test message serialization/deserialization
- Test worker error handling and retry logic

### End-to-End Tests

- Client → Gateway → Server → Pub/Sub → Worker → Microservice
- Test timeout scenarios
- Test partial failures (microservice down)

---

## Future Enhancements (Post-Gateway)

### 1. GraphQL Gateway

Replace REST with GraphQL for more flexible client queries:

- Single endpoint for all data fetching
- Client-driven data requirements
- Batch queries, subscriptions

### 2. Event Sourcing

Store all state changes as events:

- Audit trail for compliance
- Replay events for debugging
- Time-travel queries

### 3. Service Mesh (Istio/Linkerd)

For advanced traffic management:

- Automatic retries, timeouts
- A/B testing, canary deployments
- Distributed tracing

### 4. CQRS (Command Query Responsibility Segregation)

Separate read and write models:

- Optimize read replicas for queries
- Scale writes independently
- Use materialized views for complex queries

---

## Rollback Plan

### If Gateway Causes Issues

1. Revert to direct client → server communication
2. Keep gateway middleware but disable circuit breaker
3. Monitor error rates and latency

### If Pub/Sub Causes Issues

1. Temporarily disable async processing
2. Fall back to synchronous OCR flow
3. Drain pending messages before disabling

### If Worker Fails

1. Jobs accumulate in Pub/Sub (retention period)
2. Fix worker, redeploy, messages auto-process
3. Manual intervention: use gcloud to ack/nack stuck messages

---

## Success Criteria

### Phase 1 (Gateway)

- ✅ All client requests pass through gateway layer
- ✅ Rate limiting prevents abuse (max 100 req/min per user)
- ✅ Circuit breaker prevents cascade failures
- ✅ Latency increases by <50ms (p95)

### Phase 2 (Async)

- ✅ OCR jobs complete within 60 seconds (p95)
- ✅ Zero client-facing timeouts for OCR uploads
- ✅ Worker processes 95% of messages on first attempt
- ✅ Dead-letter queue contains <5% of total messages

### Phase 3 (gRPC)

- ✅ Service-to-service latency reduced by 30%+
- ✅ Payload size reduced by 50%+ (protobuf vs JSON)
- ✅ No increase in error rates

---

## References & Resources

### Google Cloud Docs

- [Cloud Pub/Sub quickstart](https://cloud.google.com/pubsub/docs/quickstart-console)
- [Cloud Run authentication](https://cloud.google.com/run/docs/authenticating/service-to-service)
- [API Gateway with Cloud Endpoints](https://cloud.google.com/endpoints/docs/openapi)

### Libraries

- Circuit breaker: `opossum` (https://github.com/nodeshift/opossum)
- Pub/Sub client: `@google-cloud/pubsub`
- gRPC: `@grpc/grpc-js`, `@grpc/proto-loader`
- Logging: `winston`, `pino`

### Architecture Patterns

- [Martin Fowler: API Gateway](https://martinfowler.com/articles/gateway-pattern.html)
- [Google Cloud Architecture Center](https://cloud.google.com/architecture)
- [CQRS](https://martinfowler.com/bliki/CQRS.html)

---

## Appendix: Example Code Snippets

### Gateway Middleware (Phase 1A)

```typescript
// server/src/05_frameworks/myexpress/gateway/index.ts
import express from "express";
import { corsMiddleware } from "./cors";
import { rateLimitMiddleware } from "./rateLimit";
import { jwtAuthMiddleware } from "./auth.middleware";
import { loggingMiddleware } from "./logging";
import { circuitBreakerMiddleware } from "./circuitBreaker";

export function createGatewayRouter() {
  const router = express.Router();

  // Apply cross-cutting concerns in order
  router.use(loggingMiddleware); // Log all requests
  router.use(corsMiddleware); // CORS headers
  router.use(rateLimitMiddleware); // Rate limiting
  router.use(jwtAuthMiddleware); // JWT validation (except public routes)
  router.use(circuitBreakerMiddleware); // Circuit breaker for external services

  return router;
}
```

### Pub/Sub Publisher (Phase 2)

```typescript
// server/src/05_frameworks/pubsub/client.ts
import { PubSub, Topic } from "@google-cloud/pubsub";

const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });
let ocrTopic: Topic | null = null;

async function getOcrTopic(): Promise<Topic> {
  if (!ocrTopic) {
    ocrTopic = pubsub.topic("ocr-jobs");
    const [exists] = await ocrTopic.exists();
    if (!exists) {
      throw new Error('Pub/Sub topic "ocr-jobs" does not exist');
    }
  }
  return ocrTopic;
}

export async function publishOcrJob(jobData: {
  jobId: string;
  userId: number;
  files: Array<{ path: string; originalname: string }>;
}) {
  const topic = await getOcrTopic();
  const messageId = await topic.publishMessage({
    json: {
      ...jobData,
      timestamp: Date.now(),
    },
  });
  console.log(
    `Published OCR job ${jobData.jobId} with message ID ${messageId}`
  );
  return messageId;
}
```

### Background Worker (Phase 2)

```typescript
// server/src/workers/ocr-worker.ts
import { PubSub, Message } from "@google-cloud/pubsub";
import { runTesseract } from "../routes/ocr";
import { cleanRecipe } from "../05_frameworks/cleanRecipe/client";
import { ocrJobRepository } from "../03_adapters/repositories";

const pubsub = new PubSub();
const subscription = pubsub.subscription("ocr-worker-sub");

// Set subscription options
subscription.setOptions({
  flowControl: {
    maxMessages: 10, // Process up to 10 messages concurrently
  },
  ackDeadline: 60, // 60 seconds to process before Pub/Sub re-delivers
});

subscription.on("message", async (message: Message) => {
  const startTime = Date.now();
  const data = message.json as {
    jobId: string;
    userId: number;
    files: Array<{ path: string; originalname: string }>;
  };

  try {
    console.log(`Processing OCR job ${data.jobId}`);

    // Update status to processing
    await ocrJobRepository.update(data.jobId, { status: "processing" });

    // Run OCR on uploaded files
    const ocrTexts: string[] = [];
    for (const file of data.files) {
      const text = await runTesseract(file.path);
      ocrTexts.push(text);
    }

    // Combine OCR results
    const combinedText = ocrTexts.join("\n\n");

    // Call clean-recipe-service
    const cleaned = await cleanRecipe({ text: combinedText });

    // Update job with result
    await ocrJobRepository.update(data.jobId, {
      status: "completed",
      result: cleaned,
      processingTime: Date.now() - startTime,
    });

    console.log(
      `OCR job ${data.jobId} completed in ${Date.now() - startTime}ms`
    );
    message.ack();
  } catch (error) {
    console.error(`OCR job ${data.jobId} failed:`, error);

    await ocrJobRepository.update(data.jobId, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });

    // Nack with delay to allow retry
    message.nack();
  }
});

subscription.on("error", (error) => {
  console.error("Subscription error:", error);
});

console.log("OCR worker started, listening for messages...");
```

---

## Questions for Discussion

1. **Gateway deployment:** Prefer enhanced middleware (Phase 1A) or separate service (Phase 1B)?
2. **Pub/Sub priority:** Should we implement async OCR first, or focus on other high-value features?
3. **Client UX:** Polling vs WebSocket for job status updates?
4. **Error handling:** How should we surface failed jobs to users? Email notification? In-app alerts?
5. **Scaling:** What's the expected OCR job volume? (to size Pub/Sub and worker instances)

---

**Next Steps:**

1. Review this plan with the team
2. Choose Phase 1 implementation (A or B)
3. Create tickets for Week 1 tasks
4. Set up local Pub/Sub emulator for development
5. Update `server/docs/DEVELOPMENT.md` with new dev setup instructions
