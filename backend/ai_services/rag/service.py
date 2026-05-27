# RAG Service
from dataclasses import dataclass

@dataclass
class QAResult:
    question: str
    answer: str
    sources: list

class RAGService:
    def __init__(self, llm=None, embedding=None):
        self.llm = llm
        self.embedding = embedding

    async def query(self, question: str) -> QAResult:
        return QAResult(
            question=question,
            answer="[请配置 RAG 服务]",
            sources=[]
        )
