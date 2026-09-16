from langchain_text_splitters import RecursiveCharacterTextSplitter

class TextSplitterService:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 150):
        # Overlap keeps sentences that sit on a chunk boundary from being lost at query time.
        self.splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap,length_function=len,is_separator_regex=False)

    def split_text(self, text: str) -> list[str]:
        if not text or text.strip() == "":
            return []
        return self.splitter.split_text(text)