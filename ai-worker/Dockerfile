FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "python -m core.init_vector_db && uvicorn main:app --host ${AI_WORKER_HOST:-0.0.0.0} --port ${AI_WORKER_PORT:-8000}"]
