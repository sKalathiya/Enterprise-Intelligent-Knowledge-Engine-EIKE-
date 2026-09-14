const GATEWAY_URL = process.env.GATEWAY_SERVICE_URL;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain"]);

export function assertUploadFile(file: FormDataEntryValue | null): File {
  if (!(file instanceof File) || file.size === 0) {
    throw new UploadError("A non-empty file is required.", 400);
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("File exceeds the 10MB limit.", 400);
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError("Only PDF and plain text files are accepted.", 400);
  }
  return file;
}

export class UploadError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Persist an uploaded file. Today this posts multipart to Nest (disk).
 * Swap the body of this function for S3: PUT the object, then POST
 * { fileName, storageKey } to Nest. The Next route and browser FormData
 * contract stay the same.
 */
export async function persistDocument(file: File, accessToken: string) {
  const body = new FormData();
  body.append("file", file, file.name);

  return fetch(`${GATEWAY_URL}/api/v1/document/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
}
