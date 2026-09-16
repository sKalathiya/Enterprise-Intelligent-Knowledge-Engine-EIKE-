# Enterprise Intelligent Knowledge Engine (EIKE)

Backend for team-scoped document Q&A. Caddy is the public HTTP edge. NestJS handles auth, teams, S3 presign, and SSE search. A FastAPI worker embeds questions and streams answers. A BullMQ ingest worker parses and embeds files. Redis is the queue. PostgreSQL + pgvector stores rows and chunks.

Clients talk only to Caddy. File bytes go to S3, not through Nest. FastAPI is internal (`X-Internal-Api-Key`).

## Architecture

Caddy is the only process on the host network (ports 80/443). Nest sits on `public_network` and `eike_network` but has no published port. Redis, Postgres, FastAPI, and ingest stay on `eike_network`.

```
Browser / Next.js
    │  JWT, JSON
    ▼
Caddy :80/:443          public_network
    │  reverse_proxy (SSE unbuffered)
    ▼
NestJS gateway :3000    public_network + eike_network
    │
    ├── Redis           BullMQ document-processing-queue
    ├── Postgres        users, teams, documents (TypeORM)
    │                   document_chunks (SQLAlchemy + pgvector)
    ├── FastAPI :8000   query + SSE
    └── ingest worker   S3 GetObject → LlamaParse → Gemini embed
```

- **Caddy** terminates HTTP (and TLS in production) and must not buffer `/api/v1/document/query`.
- **Nest** is the application gateway: JWT, teams, S3 presign/complete, and which `document_ids` a team may search. It does not parse files.
- **Ingest** is async (BullMQ). Search uses only `completed` documents on that team.
- **Query worker** never sees a user JWT; Nest calls it with `X-Internal-Api-Key`.
- **S3** holds objects. Nest issues a short-lived PUT URL; the browser uploads; Nest `HeadObject`s, then enqueues `{ documentId, bucket, key }`.

Upload: `presign` → browser PUT to S3 → `complete`. Each user gets a reserved **Private** team; a file always stays on at least one team.

Swagger: [http://localhost/api/v1/docs](http://localhost/api/v1/docs)

## Stack

NestJS 12, FastAPI, BullMQ, Redis 7, PostgreSQL 16 + pgvector, S3, LlamaParse, Gemini, Caddy, uv.

## Setup

Docker Desktop, a **private** S3 bucket (CORS for the browser origin: `PUT`, `HEAD`, `Content-Type`), [LlamaCloud](https://cloud.llamaindex.ai/) and [Gemini](https://aistudio.google.com/) keys.

```bash
cp .env.example .env
```

Set `POSTGRES_PASSWORD`, `JWT_SECRET` (≥ 32 chars), `API_KEY`, LlamaParse, Gemini, and S3. Compose overrides hosts to `postgres_db`, `redis_cache`, and `http://ai-worker:8000/api/v1/ai`. Do not commit `.env`.

```bash
docker compose up --build
docker compose exec gateway-service npm run migration:run:dist
```

Gateway tables come from TypeORM migrations (`synchronize: false`). The query container runs `init_vector_db` (pgvector + HNSW). Embedding size must stay **768**.

On Windows, port 80 must be free (Caddy). Nest, FastAPI, Postgres, and Redis are not published to the host.

## Tests

```bash
cd gateway-service && npm test && npm run test:e2e
cd ai-worker && uv sync --frozen --group dev && uv run pytest
```

## Layout

```
caddy/Caddyfile          local reverse proxy (HTTP, SSE flush)
docker-compose.yaml
gateway-service/         NestJS API
ai-worker/               FastAPI query + ingest worker
```

## Notes

- Do not set `internal: true` on `eike_network` (workers need outbound HTTPS).
- Rate limits belong on Caddy in production, not Nest. Keep `flush_interval -1` on `/api/v1/document/query`.
- This Compose stack needs several GB of RAM. A 1 GB VM will OOM.
