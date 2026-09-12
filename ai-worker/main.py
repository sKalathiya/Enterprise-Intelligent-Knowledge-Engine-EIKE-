import os
import time
import asyncio
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import uvicorn
from text_processor import TextProcessorService
from pdf_parser import PdfParserService
from core.database import get_db
from sqlalchemy.orm import Session
from core.embeddings import EmbeddingService
from core.document_chunk import DocumentChunk

limiter = Limiter(key_func=get_remote_address)

load_dotenv("../.env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield



API_KEY_HEADER = "X-Internal-Api-Key"
api_key_header = APIKeyHeader(name=API_KEY_HEADER, auto_error=False)

async def get_api_key(api_key_header: str = Depends(api_key_header)):
    if api_key_header != os.getenv("API_KEY"):
        raise HTTPException(status_code=401, detail="Invalid API key")
    return api_key_header


app = FastAPI(
    lifespan=lifespan,
    title="AI Worker", 
    description="AI Worker is a service that processes AI requests.", 
    version="1.0.0",
    prefix="/api/v1/ai",
    dependencies=[Depends(get_api_key)]
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



class Document(BaseModel):
   # document_id: uuid.UUID = Field(..., description="The ID of the document to process")
    path: str = Field(..., description="The path of the document to process")



 
text_processor = TextProcessorService()
pdf_parser = PdfParserService()
embedding_service = EmbeddingService()

@app.get("/health",status_code=status.HTTP_200_OK)
async def health():
    return {"status": "ok"}


@app.post("/process", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def ingest_document_payload(request: Request, job: Document, db: Session = Depends(get_db)):
    """Parse a PDF already on disk, then chunk the extracted markdown."""
    try:
        content = await pdf_parser.parse_pdf(job.path)
        chunks = text_processor.split_text(content)
        if len(chunks) == 0:
            return {"status": "skipped", "message": "No chunks found"}
        
        chunk_batches = [chunks[i:i+50] for i in range(0, len(chunks), 50)]

        api_tasks = [embedding_service.embed_text(batch) for batch in chunk_batches]

        vector_matrices = await asyncio.gather(*api_tasks)

        for i, vector_matrix in enumerate(vector_matrices):
            for j, chunk in enumerate(chunk_batches[i]):
                db.add(DocumentChunk(document_id=job.document_id, content=chunk, embedding=vector_matrix[j]))
        db.commit()
        
        return {"status": "ok", "message": "Document ingested successfully", "chunks": len(chunks), "chunk_sample": chunks[0] if chunks else None, "batch_size": len(chunk_batches)}    
    except ValueError as exc:
        db.rollback()
        print(f"Error parsing PDF: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
   

if __name__ == "__main__":
    uvicorn.run("main:app", host=os.getenv("AI_WORKER_HOST") or "0.0.0.0", port=int(os.getenv("AI_WORKER_PORT")) or 8000, reload=True)
