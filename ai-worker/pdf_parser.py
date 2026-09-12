import os
from llama_parse import LlamaParse

class PdfParserService:
    def __init__(self):
        api_key = os.getenv("LLAMA_PARSE_API_KEY")
        self.parser = LlamaParse(
            api_key=api_key,
            result_type="markdown",
            verbose=True,
            num_workers=4,
            language="en",
        )

    async def parse_pdf(self, pdf_path: str) -> str:
        print(f"Parsing PDF from {pdf_path}")
        if not pdf_path or not os.path.exists(pdf_path):
            raise ValueError("PDF path is required")
        extractions =  await self.parser.aload_data(pdf_path)

        if not extractions:
            raise ValueError("Failed to parse PDF")

        markdown = "\n\n".join([page.text for page in extractions])
        print(markdown)
        return markdown