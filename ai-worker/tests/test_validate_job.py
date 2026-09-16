from pathlib import Path
from uuid import uuid4

import pytest

from ingest_Document_Queue_Worker import validate_job


class FakeJob:
    def __init__(self, job_id, data):
        self.id = job_id
        self.data = data


class FakeS3:
    def download_file(self, bucket, key, tmp_path):
        Path(tmp_path).write_bytes(b"ok")


@pytest.fixture
def s3(monkeypatch):
    monkeypatch.setattr("ingest_Document_Queue_Worker.s3_client", lambda: FakeS3())


def test_rejects_non_uuid_job_id(s3):
    job = FakeJob("not-a-uuid", {"documentId": "not-a-uuid", "key": "users/a/file.pdf", "bucket": "b"})
    with pytest.raises(ValueError, match="job.id is not a UUID"):
        validate_job(job)


def test_rejects_document_id_mismatch(s3):
    job_id = str(uuid4())
    job = FakeJob(job_id, {"documentId": str(uuid4()), "key": "users/a/file.pdf", "bucket": "b"})
    with pytest.raises(ValueError, match="documentId must match job.id"):
        validate_job(job)


def test_rejects_path_traversal_key(s3):
    job_id = str(uuid4())
    job = FakeJob(job_id, {"documentId": job_id, "key": "users/../etc/passwd", "bucket": "b"})
    with pytest.raises(ValueError, match="Invalid key"):
        validate_job(job)


def test_rejects_key_outside_users_prefix(s3):
    job_id = str(uuid4())
    job = FakeJob(job_id, {"documentId": job_id, "key": "other/file.pdf", "bucket": "b"})
    with pytest.raises(ValueError, match="Invalid key"):
        validate_job(job)


def test_rejects_missing_bucket(s3):
    job_id = str(uuid4())
    job = FakeJob(job_id, {"documentId": job_id, "key": "users/a/file.pdf", "bucket": ""})
    with pytest.raises(ValueError, match="Invalid bucket"):
        validate_job(job)


def test_accepts_matching_uuid_and_users_key(s3):
    job_id = str(uuid4())
    job = FakeJob(
        job_id,
        {"documentId": job_id, "key": f"users/{job_id}/documents/{job_id}/file.pdf", "bucket": "eike"},
    )
    document_id, tmp_path, cleanup_path = validate_job(job)
    try:
        assert document_id == job_id
        assert Path(tmp_path).read_bytes() == b"ok"
        assert cleanup_path == tmp_path
    finally:
        Path(cleanup_path).unlink(missing_ok=True)
