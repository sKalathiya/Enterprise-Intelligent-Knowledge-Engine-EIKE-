from sqlalchemy import Column, Integer, ForeignKey, Text, DateTime, String  
from datetime import datetime
from .database import Base
import uuid
from pgvector.sqlalchemy import Vector

class DocumentChunk(Base):
    __tablename__ = "document_chunks"   
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))        # UUID for the chunk
    document_id = Column(String(36), nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536), nullable=True) # 1536 dimensions for text-embedding-ada-002
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now)
