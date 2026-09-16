import logging
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from .database import engine
from .database import Base
from .document_Chunk_Model import DocumentChunk  # noqa: F401 — registers table on Base.metadata

logger = logging.getLogger(__name__)


def init_vector_db() -> None:
    # Run once at container start. Nest synchronize does not create document_chunks or pgvector.
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            conn.commit()
        logger.info("pgvector extension is ready")
    except OperationalError as exc:
        raise RuntimeError(
            "Could not connect to Postgres. Check DATABASE_URL and that the database is running."
        ) from exc
    except ProgrammingError as exc:
        raise RuntimeError(
            "Could not create the vector extension. Install pgvector on this Postgres instance "
            "(e.g. image pgvector/pgvector) and grant CREATE on the database."
        ) from exc

    try:
        Base.metadata.create_all(bind=engine)
        logger.info("ORM tables created or already exist")
    except SQLAlchemyError as exc:
        raise RuntimeError(
            "Could not create tables. DocumentChunk references documents.id — "
            "the documents table must exist first, and the vector extension must already be enabled."
        ) from exc

    try:
        with engine.connect() as conn:
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding "
                    "ON document_chunks USING hnsw (embedding vector_cosine_ops)"
                )
            )
            # cosine ops must match DocumentChunk.embedding.cosine_distance in /query
            conn.commit()
        logger.info("HNSW embedding index is ready")
    except ProgrammingError as exc:
        raise RuntimeError(
            "Could not create the HNSW index. Confirm document_chunks.embedding is a vector column "
            "and that you search with the same metric (cosine <=>)."
        ) from exc


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_vector_db()
