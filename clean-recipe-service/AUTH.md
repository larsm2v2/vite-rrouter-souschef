# clean-recipe-service authentication / invocation guide

This document explains how to run the `clean-recipe-service` as a _private_ Cloud Run service and how to allow the server (or another trusted service account) to invoke it.

Why make the service private?

- Keeping the microservice private limits who can call the cleaner and reduces surface area for abuse.
- The server already runs trusted business logic and is the natural caller; allowing only the server's Cloud Run identity to invoke the cleaner is simple and secure.

Recommended deployment notes

- When deploying with `gcloud run deploy` or Cloud Build, do NOT use `--allow-unauthenticated` if you want the service to require IAM authentication.
- If you previously used `--allow-unauthenticated` in cloudbuild.yaml, remove that flag.

Grant the server permission to invoke the clean service

Replace the placeholders below with your project, region, and service account values.

1. Identify the server service account

- If you deployed the server to Cloud Run and used the default service account, its email will look like:
  `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
- If you supplied a custom service account when deploying the server, use that email instead.

2. Grant the `roles/run.invoker` role on the clean-recipe-service to the server service account

Using `gcloud`:

```powershell
# Variables to replace
$PROJECT_ID = "your-project-id"
$CLEAN_SERVICE_NAME = "clean-recipe-service"
$CLEAN_SERVICE_REGION = "us-central1"
$SERVER_SA_EMAIL = "server-service-account@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant invoker role
gcloud run services add-iam-policy-binding $CLEAN_SERVICE_NAME `
  --region $CLEAN_SERVICE_REGION `
  --platform managed `
  --member="serviceAccount:$SERVER_SA_EMAIL" `
  --role="roles/run.invoker" `
  --project $PROJECT_ID
```

After this runs, only the principal you added (and existing principals) will be able to invoke the service. You can verify with:

```powershell
# Check policy
gcloud run services get-iam-policy $CLEAN_SERVICE_NAME --region $CLEAN_SERVICE_REGION --project $PROJECT_ID
```

Notes for the server-side caller

- The server running in Cloud Run can obtain an ID token for the target service by calling the metadata server:
  `http://metadata/computeMetadata/v1/instance/service-accounts/default/identity?audience=<CLEAN_SERVICE_URL>`
- The server should send this ID token as an `Authorization: Bearer <ID_TOKEN>` header when POSTing to `/clean-recipe`.
- The repository includes a server-side wrapper that will automatically request an ID token from metadata and send it. It also falls back to a local cleaning implementation if the microservice is unreachable.

Local testing

- When testing from your workstation you can obtain an ID token with `gcloud auth print-identity-token` and include it in the `Authorization` header to test a private Clean Run service.

```powershell
$TOKEN = gcloud auth print-identity-token
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"test","ingredients":{},"instructions":[{"number":1,"text":"hello"}]}' https://clean-recipe-service-XXXXX.run.app/clean-recipe
```

Rollout consideration

- If you want to make the service public temporarily for smoke tests, use `--allow-unauthenticated` during deploy, then remove the binding later. Prefer granting the service account `roles/run.invoker` for production.

Security note

- Do not embed long-lived service account keys in your application. Use the metadata server in Cloud Run and IAM bindings for least-privilege access.
