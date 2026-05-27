# Review Planner Service
from dataclasses import dataclass

@dataclass
class KnowledgePoint:
    content: str
    source: str

@dataclass
class ReviewTask:
    title: str
    scheduled_time: str
    interval_label: str

class ReviewPlanner:
    def plan(self, content: str) -> list:
        return []
