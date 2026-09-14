# Enterprise Intelligent Knowledge Engine (EIKE)

EIKE is a two-service backend for ingesting documents and answering questions from them. A NestJS **gateway** handles authentication, users, teams, uploads, sharing, job status, and SSE search. A Python FastAPI **AI worker** parses PDFs, chunks text, embeds it, stores vectors in PostgreSQL (pgvector), caches repeated queries in Redis, and generates grounded answers. Redis also backs BullMQ so upload HTTP stays off the heavy AI work.

Ingestion, team-scoped retrieval (RAG + streaming), sharing, and account deletion are implemented.

## Architecture

```
Client (JWT)
        |
        | only public port :3000
        v
+---------------------------+     public_network
| Gateway (NestJS)          |
| Auth, users, teams,       |
| documents, SSE query      |
+---------------------------+
        |
        | eike_network (no host ports)
        +-- Redis
        |     BullMQ (gateway)
        |     query cache (AI worker)
        +-- Postgres + pgvector
        |     users, teams, documents (TypeORM)
        |     document_chunks (SQLAlchemy)
        +-- AI worker (FastAPI)
              LlamaParse, Gemini embed + generate
              outbound HTTPS to LlamaCloud / Google
```

The host talks only to the gateway. Postgres, Redis, and the worker have no published ports in the intended Compose layout. They reach each other by service name (`postgres_db`, `redis_cache`, `ai-worker:8000`). The private network is a normal bridge (not `internal: true`) so the worker can still call Gemini and LlamaParse.

Both app containers mount the same folder:

```text
./uploads  (on the host)  <->  /shared/uploads  (in gateway and worker)
```

`SHARED_UPLOAD=/shared/uploads`. The gateway writes the file there and passes that path to the worker. The file is not copied over HTTP.

## What is implemented

**Gateway**

- Register / login with JWT (`passport-jwt`, bcrypt, 24h expiry)
- Global `JwtAuthGuard` with `@Public()` on register and login only
- Helmet, CORS, 10MB payload limits, `ValidationPipe` (whitelist + forbid unknown fields)
- Inactive users cannot log in
- Profile: `GET /user/me`, `PUT /user/` (first name, last name, email)
- Account deletion: `DELETE /user/` — cancels queued jobs, deletes worker chunks, unlinks files, then deletes the user (documents and team memberships cascade)
- Private team named `"Private"` created on register (owner + membership). `"Private"` cannot be created again, renamed, or deleted
- Teams: list memberships, create, rename (owner), delete (owner), add/remove members by email (owner; owner cannot remove themselves)
- Team delete: documents that would become unlinked are moved to the document owner's Private team
- Document upload (PDF or plain text, ≤10MB) onto a team the caller belongs to
- Document status: `pending` → `processing` → `completed` / `failed`
- List documents across all of the caller's teams, or for one team
- Share / unshare with other teams the caller belongs to (file owner only). Unshare from the last team moves the file to the owner's Private team
- Retry failed ingest (`POST /document/retry/:id`)
- Delete a document: drop queue job, worker chunks, disk file, and DB row
- BullMQ queue `document-processing-queue` (ioredis). Job `jobId` = document id, 3 attempts, exponential backoff 5s, concurrency 5
- Processor `POST`s to the worker `/process` with `X-Internal-Api-Key`
- `POST /document/query` streams SSE. Body `{ "query", "team_id" }`. Gateway checks membership, collects **completed** document IDs for that team, and proxies the worker stream
- Swagger at `/api/v1/docs`

**AI worker**

- Prefix `/api/v1/ai` via `APIRouter`. All routes require `X-Internal-Api-Key`
- `GET /health`, `POST /process`, `POST /query`, `DELETE /chunks/document/{document_id}`
- LlamaParse → markdown → LangChain split (`chunk_size=1000`, `overlap=150`)
- Gemini embeddings (`output_dimensionality=768`): ingest `RETRIEVAL_DOCUMENT`, query `RETRIEVAL_QUERY`; ingest batches of 50 chunks
- Chunks stored with `document_id` (no `user_id` on the vector row). Search is scoped by the document IDs the gateway sends
- Cosine nearest-neighbor search (top 5) over pgvector + HNSW
- Gemini generate, streamed as SSE frames (`sources`, `token`, `end`)
- Redis query cache on the same `redis_cache` instance: repeated questions (normalized, scoped to the document set) return a stored answer and sources without calling Gemini again. Query embeddings can be cached as well so the embed step is skipped on a hit. This cuts token use and latency on cache hits
- Rate limit 60 requests/minute on process, query, and chunk delete
- `python -m core.init_vector_db` on container start (vector extension, table, HNSW)

**Infrastructure**

- Docker Compose: Postgres (`pgvector/pgvector:pg16`), Redis 7 (`redis_cache`), gateway, worker
- Gateway on `public_network` + `eike_network`; everything else on `eike_network` only

## Tech stack

| Layer | Choices |
| --- | --- |
| Gateway | NestJS 12 (ESM), TypeScript, TypeORM, Passport JWT, bcrypt |
| AI worker | FastAPI, Pydantic, SQLAlchemy 2, slowapi |
| Queue / cache | Redis 7 — BullMQ on the gateway, query cache on the worker |
| Database | PostgreSQL 16 + pgvector |
| Parsing / chunking | LlamaParse, langchain-text-splitters |
| Embed / generate | Google Gemini (`google-genai`) |
| Docs | Swagger (Nest). Worker OpenAPI is not published to the host |

## Repository layout

```
Enterprise-Intelligent-Knowledge-Engine-EIKE-/
├── .env.example
├── .env                          # secrets (gitignored)
├── docker-compose.yaml
├── uploads/                      # bind-mounted into both app containers
├── gateway-service/
│   ├── Dockerfile
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/env.config.ts
│       └── modules/
│           ├── auth/
│           ├── user/             # profile, account deletion
│           ├── team/             # Private team, members, orphan handling
│           └── document/         # upload, share, queue, SSE query
└── ai-worker/
    ├── Dockerfile
    ├── main.py
    ├── pdf_parser.py
    ├── text_processor.py
    └── core/
        ├── database.py
        ├── document_chunk.py
        ├── embeddings.py
        ├── generativeService.py
        └── init_vector_db.py
```

## Prerequisites

- Docker Desktop
- [LlamaCloud](https://cloud.llamaindex.ai/) API key
- [Google AI Studio](https://aistudio.google.com/) Gemini API keys
- Node.js 20+ and Python 3.10+ only if you run the apps on the host

## Environment

```bash
cp .env.example .env
```

Fill in `POSTGRES_PASSWORD`, `JWT_SECRET` (≥ 32 characters), `API_KEY`, `LLAMA_PARSE_API_KEY`, and the Gemini keys the worker reads:

| Variable | Used by |
| --- | --- |
| `GEMINI_CONTENT_EMBEDDING_API_KEY` | Ingest embeddings |
| `GEMINI_QUERY_EMBEDDING_API_KEY` | Query embeddings (falls back to the ingest key) |
| `GEMINI_EMBEDDING_MODEL` | Embedding model (for example `gemini-embedding-001`) |
| `GEMINI_CONTENT_GENERATE_API_KEY` | Answer generation |
| `GEMINI_GENERATIVE_MODEL` | Generative model |

Do not commit `.env`.

`.env` holds secrets and published ports. Hostnames in `.env` may be `localhost` for host-side tools. Compose **overrides** in-network values:

| Variable | In `.env` (host tools) | Inside Compose |
| --- | --- | --- |
| `POSTGRES_HOST` | `localhost` | `postgres_db` |
| `REDIS_HOST` | `localhost` | `redis_cache` |
| `DATABASE_URL` | `...@localhost:5432/...` | `...@postgres_db:5432/...` |
| `DOCUMENT_SERVICE_URL` | `http://localhost:8000/api/v1/ai` | `http://ai-worker:8000/api/v1/ai` |
| `SHARED_UPLOAD` | absolute path if apps run on the host | `/shared/uploads` |

`DOCUMENT_SERVICE_URL` is the worker **prefix**. The gateway appends `/process`, `/query`, and `/chunks/document/:id` (and `/chunks/user/:id` on account deletion).

Joi requires `SHARED_UPLOAD`, `DOCUMENT_SERVICE_URL`, `API_KEY`, Postgres/Redis fields, and `JWT_SECRET`.

## Run

```bash
mkdir uploads
docker compose up --build
```

Gateway (only public URL): [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)

`localhost:8000`, `5432`, and `6379` are not published in the intended Compose layout. That is intentional.

**Smoke checks**

```powershell
curl http://localhost:3000/api/v1

# worker is not on the host
curl http://localhost:8000/docs

# private hop from inside the gateway
docker compose exec gateway-service wget -qO- http://ai-worker:8000/api/v1/ai/health
```

The health call needs header `X-Internal-Api-Key` matching `API_KEY`.

**Host apps + Compose data plane only**

To run Nest/Python on the laptop, publish temporary `ports` on Postgres and Redis, set `.env` hosts to `localhost`, and set `SHARED_UPLOAD` to one absolute folder both processes can read.

## Typical flow

1. `POST /api/v1/auth/register` then `POST /api/v1/auth/login` — register also creates the user's Private team
2. Authorize in Swagger (JWT, no `Bearer ` prefix)
3. `POST /api/v1/team` to create a shared team; `POST /api/v1/team/:id/add-member` with `{ "email" }`
4. `POST /api/v1/document/upload` (multipart `file` + `team_id`)
5. Gateway writes under `/shared/uploads`, saves `documents` (`pending`) and a `team_documents` link, enqueues the job
6. Processor sets `processing` and `POST`s `{ document_id, path }` to `/process`
7. Worker parses, chunks, embeds, inserts `document_chunks`
8. Processor sets `completed` or `failed` (failed after the last retry)
9. `GET /api/v1/document/list/team/:team_id` or `GET /api/v1/document/list/me`
10. `POST /api/v1/document/share/:id` / `POST /api/v1/document/unshare/:id` with `{ "team_ids": [...] }`
11. `POST /api/v1/document/query` with `{ "query": "...", "team_id": "..." }` — use `fetch`, not `EventSource` (POST + JWT + body). SSE events: `sources`, `token`, `end`. Repeat questions may be served from the worker Redis cache
12. `DELETE /api/v1/user/` to delete the account, files, documents, memberships, and vector chunks

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
| Gateway | DELETE | `/api/v1/user/` | JWT | Account deletion (jobs, files, chunks, user) |
| Gateway | GET | `/api/v1/team/user` | JWT | Teams the user belongs to, with members |
| Gateway | POST | `/api/v1/team` | JWT | Create team; caller is owner |
| Gateway | PATCH | `/api/v1/team/:id` | JWT | Rename (owner; not Private) |
| Gateway | DELETE | `/api/v1/team/:id` | JWT | Delete (owner; not Private); orphans → Private |
| Gateway | POST | `/api/v1/team/:id/add-member` | JWT | Owner; body `{ email }` |
| Gateway | POST | `/api/v1/team/:id/remove-member` | JWT | Owner; cannot remove self |
| Gateway | POST | `/api/v1/document/upload` | JWT | Multipart `file` + `team_id` |
| Gateway | GET | `/api/v1/document/list/me` | JWT | Deduped docs across the user's teams |
| Gateway | GET | `/api/v1/document/list/team/:team_id` | JWT | Member of that team |
| Gateway | POST | `/api/v1/document/share/:id` | JWT | Owner; body `{ team_ids }` |
| Gateway | POST | `/api/v1/document/unshare/:id` | JWT | Owner; last share → Private |
| Gateway | POST | `/api/v1/document/query` | JWT | SSE; body `{ query, team_id }` |
| Gateway | POST | `/api/v1/document/retry/:id` | JWT | Failed documents only |
| Gateway | DELETE | `/api/v1/document/delete/:id` | JWT | Owner; chunks + file + row |
| Worker | GET | `/api/v1/ai/health` | API key | Internal only |
| Worker | POST | `/api/v1/ai/process` | API key | Parse, chunk, embed, store |
| Worker | POST | `/api/v1/ai/query` | API key | Vector search + SSE generate (Redis cache) |
| Worker | DELETE | `/api/v1/ai/chunks/document/:id` | API key | Drop vectors for one document |
| Worker | DELETE | `/api/v1/ai/chunks/user/:id` | API key | Drop vectors for one account |

The client never sends `X-Internal-Api-Key` or talks to the worker.

## Tests

```bash
cd gateway-service && npm test
```

The worker does not have a pytest suite yet.

## Notes

- Nest `synchronize: true` creates `users`, `teams`, `team_members`, `team_documents`, and `documents`. The worker owns `document_chunks`.
- Embedding size must stay **768**.
- Search is scoped by **team**: the gateway sends completed `document_ids` for that team. Do not trust a client-supplied user id.
- Redis is shared: BullMQ jobs on the gateway, query/embedding cache on the worker. Cache keys must include the document set (and not only the question text) so two teams never share an answer.
- `uploads/` is gitignored.
- Do not set `internal: true` on `eike_network` or the worker cannot reach Gemini / LlamaParse.
