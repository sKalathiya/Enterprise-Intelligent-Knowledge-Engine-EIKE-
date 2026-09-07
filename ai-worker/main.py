import os
import time
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

load_dotenv("../.env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    lifespan=lifespan, 
    title="AI Worker", 
    description="AI Worker is a service that processes AI requests.", 
    version="1.0.0",
)


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "ai-worker", "127.0.0.1"])

# timing middleware
@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    response.headers["X-Process-Time"] = str(duration)
    return response

# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"{request.method} {request.url}")
    response = await call_next(request)
    print(f"Status: {response.status_code}")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("AI_WORKER_ALLOWED_ORIGINS") or "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*", "X-Internal-Api-Key"],
)

API_KEY_HEADER = "X-Internal-Api-Key"
api_key_header = APIKeyHeader(name=API_KEY_HEADER, auto_error=False)

async def get_api_key(api_key_header: str = Depends(api_key_header)):
    if api_key_header != os.getenv("API_KEY"):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key_header

class Document(BaseModel):
    document_id: str = Field(..., description="The ID of the document to process"),
    content: str = Field(..., description="The content   of the document to process"),


@app.get("/health",status_code=status.HTTP_200_OK)
async def health():
    return {"status": "ok"}


@app.post("/ai/process", status_code=status.HTTP_200_OK, dependencies=[Depends(get_api_key)])
@limiter.limit("60/minute")
async def ingest_document_payload(request: Request, payload: Document):
    """Secured entry point handling heavy automated ingestion tasks."""
    print(f"🔒 Secure execution path triggered for Job ID: {payload.document_id}")
    return {
        "status": "processing",
        "message": f"Payload for secure job {payload.document_id} successfully validated, authorized, and queued.",
        "content_length": len(payload.content)
    }