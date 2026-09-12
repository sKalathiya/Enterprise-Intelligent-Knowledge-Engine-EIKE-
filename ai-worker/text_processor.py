from langchain_text_splitters import RecursiveCharacterTextSplitter

class TextProcessorService:
    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap,length_function=len,is_separator_regex=False)

    def split_text(self, text: str) -> list[str]:
        if not text or text.strip() == "":
            return []
        return self.splitter.split_text(text)