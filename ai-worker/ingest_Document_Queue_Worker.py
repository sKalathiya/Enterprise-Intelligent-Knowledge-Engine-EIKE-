import asyncio
import os
import signal
import uuid
import tempfile
from pathlib import Path

from bullmq import Worker
from dotenv import load_dotenv
from core.pdf_Parser_Service import PdfParserService
from core.text_Spilliter_Service import TextSplitterService
from core.embedding_Service import EmbeddingService
from core.document_Chunk_Model import DocumentChunk
from core.database import SessionLocal
import boto3

load_dotenv("../.env")
load_dotenv()

QUEUE_NAME = "document-processing-queue"

redis_host = os.getenv("REDIS_HOST") or "localhost"
redis_port = os.getenv("REDIS_PORT") or "6379"
REDIS_URL = os.getenv("REDIS_URL") or f"redis://{redis_host}:{redis_port}"

SHARED_UPLOAD = os.getenv("SHARED_UPLOAD")
pdf_parser = PdfParserService()
text_splitter = TextSplitterService()
embedding_service = EmbeddingService()


def s3_client():
    kwargs = {
        "region_name": os.getenv("S3_REGION"),
        "aws_access_key_id": os.getenv("S3_ACCESS_KEY_ID"),
        "aws_secret_access_key": os.getenv("S3_SECRET_ACCESS_KEY"),
    }
    endpoint = os.getenv("S3_ENDPOINT")
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.client("s3", **kwargs)

def validate_job(job) -> tuple[str, str, str]:
    document_id = job.data.get("documentId") if isinstance(job.data, dict) else None
    data  = job.data if isinstance(job.data, dict) else None
    key = data.get("key")
    bucket = data.get("bucket")
    

    try:
        uuid.UUID(str(job.id))
    except ValueError as exc:
        raise ValueError("job.id is not a UUID") from exc

    if not document_id or document_id != job.id:
        raise ValueError("documentId must match job.id")

    if not isinstance(key, str) or '..' in key or not key.startswith("users/"):
        raise ValueError("Invalid key")
    if not bucket or not isinstance(bucket, str):
        raise ValueError("Invalid bucket")
    suffix = Path(key).suffix or '.bin'
    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        client = s3_client()
        client.download_file(bucket, key, tmp_path)
    except Exception as exc:
        Path(tmp_path).unlink(missing_ok=True)
        raise ValueError("Failed to download file from S3") from exc
    return document_id, tmp_path, tmp_path


async def process(job, job_token):
    document_id, tmp_path, cleanup_path = await asyncio.to_thread(validate_job, job)

    db = SessionLocal()

    try:
        print(f"Processing document {document_id} with path {tmp_path}")
        content = await pdf_parser.parse_pdf(tmp_path)
        chunks = text_splitter.split_text(content)
        if len(chunks) == 0:
            raise ValueError("No chunks found")
        
        chunk_batches = [chunks[i:i+50] for i in range(0, len(chunks), 50)]

        api_tasks = [embedding_service.embed_content(batch) for batch in chunk_batches]

        vector_matrices = await asyncio.gather(*api_tasks)

        db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete(synchronize_session=False)
        
        for i, vector_matrix in enumerate(vector_matrices):
            for j, chunk in enumerate(chunk_batches[i]):
                db.add(DocumentChunk(document_id=document_id, content=chunk, embedding=vector_matrix[j]))
        db.commit()
        return {"status": "ok", "message": "Document ingested successfully", "chunks": len(chunks), "chunk_sample": chunks[0] if chunks else None, "batch_size": len(chunk_batches)}    
    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()
        if cleanup_path:
            Path(cleanup_path).unlink(missing_ok=True)


async def main():
    shutdown_event = asyncio.Event()

    def on_shutdown(*_args):
        shutdown_event.set()

    signal.signal(signal.SIGINT, on_shutdown)
    signal.signal(signal.SIGTERM, on_shutdown)

    worker = Worker(
        QUEUE_NAME,
        process,
        {
            "connection": REDIS_URL,
            "concurrency": 1,
            'lockDuration': 300000,
        },
    )

    print(f"Ingest worker listening on {QUEUE_NAME}")
    await shutdown_event.wait()
    await worker.close()


if __name__ == "__main__":
    asyncio.run(main())
