import { NextRequest, NextResponse } from "next/server";
import {
  UploadError,
  assertUploadFile,
  persistDocument,
} from "@/app/api/v1/document/upload/document-storage";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth_token")?.value;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized session" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = assertUploadFile(formData.get("file"));
    const nestResponse = await persistDocument(file, token);
    const data = await nestResponse.json().catch(() => null);

    if (!nestResponse.ok) {
      return NextResponse.json(data ?? { message: "Upload failed." }, { status: nestResponse.status });
    }
    return NextResponse.json(data, { status: nestResponse.status });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Failed to upload document." }, { status: 500 });
  }
}
