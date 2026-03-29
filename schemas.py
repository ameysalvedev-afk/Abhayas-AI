from pydantic import BaseModel, Field
from typing import Dict, List, Optional


# ── Question Models ──────────────────────────────────────────────────────────

class Question(BaseModel):
    id: str
    subject: str
    chapter: str
    topic: str
    difficulty: str
    question: str
    options: Dict[str, str]
    correct_answer: str
    explanation: str
    marks: int
    negative_marks: int


class QuestionsResponse(BaseModel):
    questions: List[Question]


# ── Test Submission Models ───────────────────────────────────────────────────

class ResponseItem(BaseModel):
    question_id: str
    selected: str
    time_spent: int = Field(..., ge=0, description="Time spent in seconds")


class TestSubmission(BaseModel):
    responses: List[ResponseItem]
    language_mode: str = "english"


class ExplanationRequest(BaseModel):
    question: str
    options: Dict[str, str]
    correct_answer: str
    user_answer: str
    topic: str
    base_explanation: str
    language_mode: str = "english"


class ExplanationResponse(BaseModel):
    detailed_explanation: str
    quick_tip: str


class FinalReportItem(BaseModel):
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    time_analysis: str
    recommendations: List[str]


class PerformanceAnalysis(BaseModel):
    topic_accuracy: Dict[str, float]
    topic_time: Dict[str, float]
    weak_topics: List[str]
    strong_topics: List[str]
    time_waste_topics: List[str]


class ReportRequest(BaseModel):
    analysis_data: PerformanceAnalysis
    language_mode: str = "english"


class TestResult(BaseModel):
    score: int
    max_score: int
    correct: int
    wrong: int
    skipped: int
    total: int
    wrong_questions: List[dict] = []
    skipped_questions: List[dict] = []
    analysis: PerformanceAnalysis
    final_report: Optional[FinalReportItem] = None
