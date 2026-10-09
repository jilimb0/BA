# Level 06 — Deployment

## Containerization
- **Runtime:** Node.js 26 on Alpine Linux / slim image.
- **Service Orchestration:** `docker-compose.yml`.

## Healthcheck
- Endpoint: `GET /health`
- Response:
  ```json
  {
    "status": "ok",
    "project": "business-analyzer",
    "timestamp": "ISO-8601"
  }
  ```
