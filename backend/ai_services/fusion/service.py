# Fusion Service
from dataclasses import dataclass

@dataclass
class KnowledgeUnit:
    content: str
    source: str

class FusionService:
    def fuse(self, asr_text: str, ocr_text: str) -> str:
        return f"{asr_text}\n\n{ocr_text}"
