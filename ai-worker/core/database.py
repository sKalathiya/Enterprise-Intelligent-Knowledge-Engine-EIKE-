

from dotenv import load_dotenv
import os
from sqlalchemy import create_engine, URL
from sqlalchemy.orm import sessionmaker, declarative_base


load_dotenv("../.env")
load_dotenv()


def _database_url() -> str:
    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    host = os.getenv("POSTGRES_HOST")
    port = os.getenv("POSTGRES_PORT") or "5432"
    database = os.getenv("POSTGRES_DB")
    if user and password is not None and host and database:
        return URL.create(
            drivername="postgresql+psycopg2",
            username=user,
            password=password,
            host=host,
            port=int(port),
            database=database,
        ).render_as_string(hide_password=False)
    explicit = os.getenv("DATABASE_URL")
    if not explicit:
        raise ValueError("DATABASE_URL is not set")
    return explicit


DATABASE_URL = _database_url()

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")

engine = create_engine(DATABASE_URL, 
echo=True, 
pool_size=20,       
max_overflow=50,    
pool_timeout=30     
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()