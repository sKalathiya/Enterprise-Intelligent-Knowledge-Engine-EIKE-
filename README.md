# Enterprise Intelligent Knowledge Engine (EIKE)

EIKE is a two-service backend (plus an ingest process) for storing documents and answering questions from them. A NestJS **gateway** handles authentication, users, teams, S3 uploads, sharing, job status, and SSE search. A Python **query worker** (FastAPI) embeds questions, searches pgvector, and streams grounded answers. A second Python **ingest worker** pulls BullMQ jobs, downloads the file from S3, parses, chunks, and embeds. Redis backs the queue. PostgreSQL (pgvector) stores both gateway rows and vector chunks.

There is no client in this repository.

## Architecture

```
Browser (JWT)
        |
        | POST /document/presign  →  Nest returns S3 PUT URL
        | PUT object bytes        →  S3 (direct)
        | POST /document/complete →  Nest HeadObject + enqueue
        |
        | only public port :3000
        v
+---------------------------+     public_network
| Gateway (NestJS)          |
| Auth, users, teams,       |
| presign/complete, SSE     |
| BullMQ producer + observer|
+---------------------------+
        |
        | eike_network (worker/DB not published)
        +-- Redis
        |     BullMQ (gateway + ingest worker)
        +-- Postgres + pgvector
        |     users, teams, documents (TypeORM)
        |     document_chunks (SQLAlchemy)
        +-- AI query worker (FastAPI :8000)
        |     Gemini embed query + generate SSE
        +-- AI ingest worker (BullMQ consumer)
              S3 GetObject, LlamaParse, Gemini embed
              outbound HTTPS to S3 / LlamaCloud / Google
```

The host talks only to the gateway. The query worker, ingest worker, Postgres, and Redis are on `eike_network`. They reach each other by service name (`postgres_db`, `redis_cache`, `ai-worker:8000`). The private network is a normal bridge (not `internal: true`) so Python can still call Gemini, LlamaParse, and S3.

Files are **not** stored on a shared disk. Nest issues a short-lived S3 PUT URL. The browser uploads to S3. Nest confirms with `HeadObject`, then enqueues `{ documentId, bucket, key }`. The ingest worker downloads with IAM/keys and parses a temp file.

## What is implemented

**Gateway**

- Register / login with JWT (`passport-jwt`, bcrypt, 24h expiry)
- Global `JwtAuthGuard` with `@Public()` on register and login only
- Helmet, CORS (`GATEWAY_SERVICE_CORS_ORIGIN`), 10MB JSON limits, `ValidationPipe` (whitelist + forbid unknown fields)
- Inactive users cannot log in
- Profile: `GET /user/me`, `PUT /user/` (first name, last name, email)
- Account deletion: `DELETE /user/` — owner must only have Private (or no extra owned teams). Deletes Private, document rows, user; then queue jobs, S3 objects, and worker chunks
- Private team named `"Private"` created on register (owner + membership). `"Private"` cannot be created again, renamed, deleted, reowned, or have members added/removed
- Teams: list memberships, create, rename (owner), delete (owner), add/remove members by email (owner cannot remove themselves), change owner (active member only)
- Team delete / remove member / change owner: last remaining share of a file is moved to that file owner's Private team
- Document upload is S3-only (PDF or plain text, ≤10MB):
  1. `POST /document/presign` — member check, row `uploading`, returns `uploadUrl`
  2. Client `PUT`s the file to S3 (same `Content-Type` and byte length)
  3. `POST /document/complete/:id` — `HeadObject`, set `pending`, enqueue ingest
- Status: `uploading` → `pending` → `processing` → `completed` / `failed`
- List documents across all of the caller's teams, or for one team (membership required)
- Share / unshare with other teams the caller belongs to (file owner only). Cannot share/unshare Private. Unshare from the last team moves the file to the owner's Private team
- Retry failed ingest (`POST /document/retry/:id`)
- Delete a document (owner; `completed` or `failed`): DB row, queue job, worker chunks, S3 object
- BullMQ queue `document-processing-queue`. Job `jobId` = document id, 3 attempts, exponential backoff 5s
- Nest does **not** parse files. A queue event listener sets `processing` / `completed` / `failed` from BullMQ events
- `POST /document/query` streams SSE. Body `{ "query", "team_id" }`. Gateway checks membership, collects **completed** document IDs for that team, and proxies the worker stream
- Swagger at `/api/v1/docs`

**AI query worker (FastAPI)**

- Prefix `/api/v1/ai`. All routes require `X-Internal-Api-Key`
- `GET /health`, `POST /query`, `DELETE /chunks/document/{document_id}`
- There is **no** HTTP `/process`. Ingest is the BullMQ consumer
- Query: Gemini query embedding → cosine top 5 over pgvector (HNSW) filtered by `document_ids` → Gemini generate, streamed as SSE (`sources`, `token`, `end`)
- Rate limit 60 requests/minute on query and chunk delete
- `python -m core.init_vector_db` on container start (vector extension, `document_chunks`, HNSW)

**AI ingest worker (BullMQ)**

- Same image as the query worker; different command
- Pulls `document-processing-queue`
- Job payload `{ documentId, bucket, key }` with `job.id === documentId`
- `GetObject` to a temp file, LlamaParse → markdown → LangChain split (`chunk_size=1000`, `overlap=150`)
- Gemini embeddings (`output_dimensionality=768`, `RETRIEVAL_DOCUMENT`), batches of 50
- Replaces existing chunks for that `document_id`, then commits
- Lock duration 300s, concurrency 1

**Infrastructure**

- Docker Compose: Postgres (`pgvector/pgvector:pg16`), Redis 7, gateway, query worker, ingest worker
- Python deps resolved with **uv** (`pyproject.toml` + `uv.lock`)
- Gateway on `public_network` + `eike_network`; everything else on `eike_network` only
- S3 bucket must be private with CORS for the browser origin (`PUT`, `HEAD`, `Content-Type`)

## Tech stack

| Layer | Choices |
| --- | --- |
| Gateway | NestJS 12 (ESM), TypeScript, TypeORM, Passport JWT, bcrypt, AWS SDK v3 |
| Query / ingest | FastAPI, Pydantic, SQLAlchemy 2, slowapi, boto3, BullMQ Python |
| Python deps | uv (`uv.lock`) |
| Queue | Redis 7 + BullMQ |
| Database | PostgreSQL 16 + pgvector |
| Object storage | Amazon S3 (presigned PUT) |
| Parsing / chunking | LlamaParse, langchain-text-splitters |
| Embed / generate | Google Gemini (`google-genai`) |
| Docs | Swagger on the gateway only |

## Repository layout

```
Enterprise-Intelligent-Knowledge-Engine-EIKE-/
├── .env.example
├── .env                          # secrets (gitignored)
├── docker-compose.yaml
├── gateway-service/
│   ├── Dockerfile
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/env.config.ts
│       └── modules/
│           ├── auth/
│           ├── user/
│           ├── team/
│           └── document/         # presign, complete, share, queue listener, SSE
└── ai-worker/
    ├── Dockerfile
    ├── pyproject.toml
    ├── uv.lock
    ├── main.py                   # query HTTP
    ├── ingest_Document_Queue_Worker.py
    └── core/
        ├── database.py
        ├── document_Chunk_Model.py
        ├── embedding_Service.py
        ├── generative_Service.py
        ├── pdf_Parser_Service.py
        ├── text_Spilliter_Service.py
        └── init_vector_db.py
```

## Prerequisites

- Docker Desktop
- An S3 bucket (private, Block Public Access, CORS for your app origin)
- [LlamaCloud](https://cloud.llamaindex.ai/) API key
- [Google AI Studio](https://aistudio.google.com/) Gemini API keys
- Node.js 20+ and Python 3.10+ (with [uv](https://docs.astral.sh/uv/)) only if you run the apps on the host

## Environment

```bash
cp .env.example .env
```

Fill in `POSTGRES_PASSWORD`, `JWT_SECRET` (≥ 32 characters), `API_KEY`, `LLAMA_PARSE_API_KEY`, Gemini keys, and S3:

| Variable | Used by |
| --- | --- |
| `GEMINI_CONTENT_EMBEDDING_API_KEY` | Ingest embeddings |
| `GEMINI_QUERY_EMBEDDING_API_KEY` | Query embeddings (falls back to the ingest key) |
| `GEMINI_EMBEDDING_MODEL` | Embedding model (for example `gemini-embedding-001`) |
| `GEMINI_CONTENT_GENERATE_API_KEY` | Answer generation |
| `GEMINI_GENERATIVE_MODEL` | Generative model |
| `S3_BUCKET` / `S3_REGION` | Nest + ingest worker |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Nest (Put/Head/Delete) and ingest (Get) |
| `S3_ENDPOINT` | Empty for AWS; MinIO URL only if you use MinIO |

Do not commit `.env`. Do not put S3 keys in a browser app. Nest issues the PUT URL.

`.env` holds secrets and published ports. Hostnames in `.env` may be `localhost` for host-side tools. Compose **overrides** in-network values:

| Variable | In `.env` (host tools) | Inside Compose |
| --- | --- | --- |
| `POSTGRES_HOST` | `localhost` | `postgres_db` |
| `REDIS_HOST` | `localhost` | `redis_cache` |
| `DATABASE_URL` | `...@localhost:5432/...` | `...@postgres_db:5432/...` |
| `DOCUMENT_SERVICE_URL` | `http://localhost:8000/api/v1/ai` | `http://ai-worker:8000/api/v1/ai` |

`DOCUMENT_SERVICE_URL` is the query-worker **prefix**. The gateway appends `/query` and `/chunks/document/:id`.

Joi requires Postgres/Redis fields, `DOCUMENT_SERVICE_URL`, `API_KEY`, and `JWT_SECRET`. S3 fields are optional at boot (presign fails if they are empty).

## Run

```bash
docker compose up --build
```

Gateway (only public URL): [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)

The query worker is not published to the host. That is intentional.

**Smoke checks**

```powershell
# private hop from inside the gateway
docker compose exec gateway-service node -e "fetch('http://ai-worker:8000/api/v1/ai/health',{headers:{'X-Internal-Api-Key':process.env.API_KEY}}).then(r=>r.text()).then(console.log)"
```

**Host apps + Compose data plane only**

Publish Postgres and Redis (already mapped in Compose), set `.env` hosts to `localhost`, run Nest and both Python processes on the laptop. Python deps:

```bash
cd ai-worker
uv sync --frozen
uv run python -m core.init_vector_db
uv run uvicorn main:app --reload
uv run python ingest_Document_Queue_Worker.py
```

## Typical flow

1. `POST /api/v1/auth/register` then `POST /api/v1/auth/login` — register also creates the user's Private team
2. Authorize in Swagger (JWT, no `Bearer ` prefix)
3. `POST /api/v1/team` to create a shared team; `POST /api/v1/team/:id/add-member` with `{ "email" }`
4. `POST /api/v1/document/presign` with `{ "team_id", "fileName", "contentType", "contentLength" }`
5. `PUT` the file to `uploadUrl` with header `Content-Type` exactly as returned (body size must match `contentLength`)
6. `POST /api/v1/document/complete/:id` — Nest `HeadObject`s S3, sets `pending`, enqueues the job
7. Ingest worker downloads from S3, parses, chunks, embeds, writes `document_chunks`
8. Queue listener sets `processing` then `completed` or `failed`
9. `GET /api/v1/document/list/team/:team_id` or `GET /api/v1/document/list/me`
10. `POST /api/v1/document/share/:id` / `POST /api/v1/document/unshare/:id` with `{ "team_ids": [...] }`
11. `POST /api/v1/document/query` with `{ "query": "...", "team_id": "..." }` — use `fetch`, not `EventSource` (POST + JWT + body). SSE events: `sources`, `token`, `end`
12. `DELETE /api/v1/user/` to delete the account (no extra owned teams besides Private)

Job options: `jobId` = document id, 3 attempts, exponential backoff.

Query example:

```ts
const res = await fetch('http://localhost:3000/api/v1/document/query', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  },
  body: JSON.stringify({ query: 'What is the work experience?', team_id }),
});
```

## API summary

All gateway routes except register and login require JWT. Worker routes are internal (`X-Internal-Api-Key` only).

| Service | Method | Path | Auth | Notes |
| --- | --- | --- | --- | --- |
| Gateway | POST | `/api/v1/auth/register` | Public | Creates user + Private team |
| Gateway | POST | `/api/v1/auth/login` | Public | `{ accessToken }` |
| Gateway | GET | `/api/v1/user/me` | JWT | Current profile (`passwordHash` excluded) |
| Gateway | PUT | `/api/v1/user/` | JWT | Update name / email |
| Gateway | DELETE | `/api/v1/user/` | JWT | Account deletion |
| Gateway | GET | `/api/v1/team/user` | JWT | Teams the user belongs to, with members |
| Gateway | POST | `/api/v1/team` | JWT | Create team; caller is owner |
| Gateway | PATCH | `/api/v1/team/:id` | JWT | Rename (owner; not Private) |
| Gateway | DELETE | `/api/v1/team/:id` | JWT | Delete (owner; not Private); orphans → Private |
| Gateway | POST | `/api/v1/team/:id/add-member` | JWT | Owner; body `{ email }` |
| Gateway | POST | `/api/v1/team/:id/remove-member` | JWT | Owner; cannot remove self |
| Gateway | POST | `/api/v1/team/:id/change-owner` | JWT | Owner; body `{ email }`; must already be a member |
| Gateway | POST | `/api/v1/document/presign` | JWT | JSON; returns S3 PUT URL; status `uploading` |
| Gateway | POST | `/api/v1/document/complete/:id` | JWT | HeadObject + enqueue |
| Gateway | GET | `/api/v1/document/list/me` | JWT | Deduped docs across the user's teams |
| Gateway | GET | `/api/v1/document/list/team/:team_id` | JWT | Member of that team |
| Gateway | POST | `/api/v1/document/share/:id` | JWT | Owner; body `{ team_ids }` |
| Gateway | POST | `/api/v1/document/unshare/:id` | JWT | Owner; last share → Private |
| Gateway | POST | `/api/v1/document/query` | JWT | SSE; body `{ query, team_id }` |
| Gateway | POST | `/api/v1/document/retry/:id` | JWT | Failed documents only |
| Gateway | DELETE | `/api/v1/document/delete/:id` | JWT | Owner; chunks + S3 object + row |
| Query worker | GET | `/api/v1/ai/health` | API key | Internal only |
| Query worker | POST | `/api/v1/ai/query` | API key | Vector search + SSE generate |
| Query worker | DELETE | `/api/v1/ai/chunks/document/:id` | API key | Drop vectors for one document |

The client never sends `X-Internal-Api-Key` or talks to the Python processes.

## Tests

```bash
cd gateway-service && npm test
```

The worker does not have a pytest suite yet.

## Notes

- Nest `synchronize: true` creates `users`, `teams`, `team_members`, `team_documents`, and `documents`. The worker owns `document_chunks`.
- Embedding size must stay **768**.
- Search is scoped by **team**: the gateway sends completed `document_ids` for that team.
- Redis is the BullMQ broker (gateway producer, ingest consumer). Query cache is not implemented.
- Do not set `internal: true` on `eike_network` or Python cannot reach Gemini, LlamaParse, or S3.
- S3 CORS is on the **bucket**, not Nest `enableCors`.
