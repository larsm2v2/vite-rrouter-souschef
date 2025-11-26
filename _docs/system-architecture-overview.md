# System Architecture Overview

## Overview

The system is composed of three main components: **Clean Recipe Service**, **Client**, and **Server**. Each component plays a distinct role in the overall architecture, ensuring modularity, scalability, and maintainability.

---

## 1. Clean Recipe Service

### Purpose

The Clean Recipe Service is responsible for processing and cleaning recipe data. It ensures that recipes are standardized and ready for use by the client and server components.

### Key Features

- **Data Cleaning**: Processes raw recipe data to remove inconsistencies.
- **Microservice Architecture**: Designed as a standalone service for modularity.
- **Dockerized Deployment**: Packaged with a `Dockerfile` for containerized deployment.

### Technologies

- **Node.js**: Backend runtime.
- **TypeScript**: Strongly typed JavaScript.
- **Docker**: Containerization for deployment.

### File Structure

- `src/`
  - `cleanRecipe.ts`: Core logic for cleaning recipes.
  - `routes.ts`: API routes for the service.
- `Dockerfile`: Configuration for building the service container.
- `package.json`: Dependency management.

---

## 2. Client

### Purpose

The Client is the user-facing application, providing an interface for users to interact with the system. It handles user authentication, recipe display, and other frontend functionalities.

### Key Features

- **React-based SPA**: Built as a Single Page Application (SPA) using React.
- **OAuth Authentication**: Implements PKCE OAuth flow for secure user authentication.
- **Firebase Hosting**: Deployed on Firebase for scalability and ease of use.

### Technologies

- **React**: Frontend framework.
- **Vite**: Build tool for fast development.
- **TypeScript**: Strongly typed JavaScript.
- **Firebase Hosting**: Deployment platform.

### File Structure

- `src/`
  - `App.tsx`: Main application component.
  - `utils/`: Utility functions, including PKCE logic.
  - `components/`: Reusable UI components.
- `public/`: Static assets.
- `vite.config.ts`: Vite configuration.
- `package.json`: Dependency management.

---

## 3. Server

### Purpose

The Server acts as the backend for the system, handling API requests, business logic, and database interactions. It also facilitates the OAuth token exchange process.

### Key Features

- **API Gateway**: Centralized API for client-server communication.
- **OAuth Integration**: Handles token exchange and user authentication.
- **Data Storage**: Manages recipe and user data.
- **Service-to-Service Authentication**: Uses Google Cloud IAM ID tokens for secure internal service calls.
- **Circuit Breaker Pattern**: Prevents cascade failures with configurable timeouts and failure thresholds.

### Server Technologies

- **Node.js**: Backend runtime.
- **Express.js**: Web framework for building APIs.
- **PostgreSQL**: Relational database for persistent storage.
- **Docker**: Containerization for deployment.
- **Google Cloud IAM**: Service account authentication for Cloud Run services.

### Server File Structure

- `src/`
  - `routes/`: API route definitions.
  - `data/`: Recipe and temporary data storage.
  - `05_frameworks/cleanRecipe/client.ts`: Client wrapper for Clean Recipe Service with IAM authentication.
  - `05_frameworks/myexpress/gateway/circuitBreaker.ts`: Circuit breaker implementation.
- `env/`: Environment variables for configuration.
- `Dockerfile`: Configuration for building the service container.
- `package.json`: Dependency management.

---

## Deployment

### Clean Recipe Service

- **Containerized Deployment**: Deployed as a Docker container.
- **Cloud Run**: Hosted on Google Cloud Run for scalability.

### Client

- **Firebase Hosting**: Deployed as a static site.
- **CI/CD**: Automated deployment pipeline using Firebase CLI.

### Server

- **Containerized Deployment**: Deployed as a Docker container.
- **Cloud Run**: Hosted on Google Cloud Run for scalability.

---

## Communication Flow

1. **User Interaction**: The user interacts with the Client application.
2. **Authentication**: The Client uses the PKCE OAuth flow to authenticate the user via the Server.
3. **Data Requests**: The Client sends API requests to the Server.
4. **Data Processing**: The Server processes the requests, interacts with the Clean Recipe Service if needed, and retrieves data from the database.
5. **Response**: The Server sends the processed data back to the Client.

### Server-to-Service Communication

When the Server calls the Clean Recipe Service:

1. **Service Discovery**: The Server checks the `CLEAN_RECIPE_SERVICE_URL` environment variable.

   - If not set: Falls back to local recipe cleaning implementation.
   - If set: Proceeds with remote service call.

2. **Authentication** (Cloud Run to Cloud Run):

   - Server fetches an ID token from the Google Cloud metadata server using its service account.
   - The audience for the token is the Clean Recipe Service URL (configurable via `CLEAN_RECIPE_SERVICE_AUDIENCE`).
   - ID token is cached with expiry tracking for performance.
   - If ID token cannot be fetched, the request **fails loudly** to enforce internal-only security.

3. **Request Execution**:

   - POST request to `/clean-recipe` endpoint with recipe data.
   - Authorization header: `Bearer <ID_TOKEN>`.
   - Circuit breaker wraps the call (15s timeout for cold start tolerance).

4. **Error Handling**:
   - Status codes logged for debugging:
     - 401: Authentication failure
     - 403: Authorization forbidden
     - 404: Endpoint not found
   - Circuit breaker opens after 5 consecutive failures.
   - Fallback to local implementation only if circuit is open.

---

## Future Enhancements

- **Scalability**: Implement Kubernetes for container orchestration.
- **Monitoring**: Add centralized logging and monitoring tools (e.g., Cloud Logging, Cloud Trace).
- **Demo Mode**: Introduce a demo mode for the Client application.
- **Advanced Circuit Breaker**: Consider replacing custom implementation with Opossum or similar library.

---

## Architecture Diagram

```plaintext
┌──────────┐        HTTPS + ID Token         ┌──────────────────────┐
│  Server  │────────────────────────────────>│ Clean Recipe Service │
│  (Run)   │  audience = service URL         │       (Run)          │
└──────────┘        service account          └──────────────────────┘
      ▲
      │
      │ Client SPA requests (HTTPS + OAuth)
      │
┌──────────┐
│  Client  │
│ Firebase │
│ Hosting  │
└──────────┘
```

### Key Security Points

- **No VPC Required**: Same-project Cloud Run services use built-in service-to-service authentication via ID tokens.
- **Internal-Only Enforcement**: ID token authentication is mandatory when `CLEAN_RECIPE_SERVICE_URL` is set; failures are not silently ignored.
- **Client Authentication**: PKCE OAuth flow ensures secure user authentication between Client and Server.
- **Service Account Permissions**: Server service account must have Cloud Run Invoker role for Clean Recipe Service.

---

This document provides a high-level overview of the system architecture, detailing the roles and responsibilities of each component. For more detailed implementation guides, refer to the respective documentation in the `_docs/` folder.
