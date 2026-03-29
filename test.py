import asyncio
from collections import defaultdict

from fastapi import APIRouter, HTTPException

from models.schemas import (
    TestSubmission, 
    TestResult, 
    PerformanceAnalysis,
    ExplanationRequest,
    ExplanationResponse,
    ReportRequest,
    FinalReportItem
)
from routes.questions import load_questions
from services.ai_mentor import generate_ai_explanation, generate_final_report

router = APIRouter()


# ── Analysis helper ──────────────────────────────────────────────────────────

def analyze_performance(
    responses: list,
    question_map: dict,
) -> PerformanceAnalysis:
    """
    Compute per-topic accuracy, average time, and classify
    weak / strong / time-waste topics.
    """
    topic_correct: dict[str, int] = defaultdict(int)
    topic_total: dict[str, int] = defaultdict(int)
    topic_time_sum: dict[str, float] = defaultdict(float)

    for resp in responses:
        question = question_map.get(resp.question_id)
        if question is None:
            continue  # skip unknown ids (already validated upstream)

        topic = question.get("topic", "Unknown")
        topic_total[topic] += 1
        topic_time_sum[topic] += resp.time_spent

        if resp.selected == question["correct_answer"]:
            topic_correct[topic] += 1

    # ── Per-topic stats ──────────────────────────────────────────────────
    topic_accuracy: dict[str, float] = {}
    topic_time: dict[str, float] = {}
    weak_topics: list[str] = []
    strong_topics: list[str] = []
    time_waste_topics: list[str] = []

    for topic, total in topic_total.items():
        accuracy = (topic_correct[topic] / total) * 100 if total else 0.0
        avg_time = topic_time_sum[topic] / total if total else 0.0

        topic_accuracy[topic] = round(accuracy, 2)
        topic_time[topic] = round(avg_time, 2)

        if accuracy < 50:
            weak_topics.append(topic)
        if accuracy > 80:
            strong_topics.append(topic)
        if avg_time > 60:
            time_waste_topics.append(topic)

    return PerformanceAnalysis(
        topic_accuracy=topic_accuracy,
        topic_time=topic_time,
        weak_topics=weak_topics,
        strong_topics=strong_topics,
        time_waste_topics=time_waste_topics,
    )


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/submit-test", response_model=TestResult)
async def submit_test(submission: TestSubmission):
    """
    Evaluate a test submission and return score breakdown + performance analysis.

    Scoring rules (per question):
      +marks           for a correct answer
      -negative_marks  for a wrong answer
    """
    if not submission.responses:
        raise HTTPException(status_code=400, detail="No responses provided.")

    questions = load_questions()
    question_map = {q["id"]: q for q in questions}

    correct = 0
    wrong = 0
    skipped = 0
    score = 0
    wrong_questions: list[dict] = []
    skipped_questions: list[dict] = []

    for resp in submission.responses:
        question = question_map.get(resp.question_id)
        if question is None:
            raise HTTPException(
                status_code=400,
                detail=f"Question ID '{resp.question_id}' not found.",
            )

        if not resp.selected:
            skipped += 1
            skipped_questions.append({
                "id": question["id"],
                "question": question["question"],
                "options": question["options"],
                "correct_answer": question["correct_answer"],
                "user_answer": "",
                "topic": question.get("topic", "Unknown"),
                "base_explanation": question.get("explanation", ""),
                "subject": question.get("subject", "Unknown"),
                "difficulty": question.get("difficulty", "medium")
            })
            continue

        if resp.selected == question["correct_answer"]:
            correct += 1
            score += question["marks"]
        else:
            wrong += 1
            score -= question["negative_marks"]
            wrong_questions.append({
                "id": question["id"],
                "question": question["question"],
                "options": question["options"],
                "correct_answer": question["correct_answer"],
                "user_answer": resp.selected,
                "topic": question.get("topic", "Unknown"),
                "base_explanation": question.get("explanation", ""),
                "subject": question.get("subject", "Unknown"),
                "difficulty": question.get("difficulty", "medium")
            })

    # ── Performance analysis ─────────────────────────────────────────────
    # Only analyze answered questions (selected is not empty)
    answered_responses = [r for r in submission.responses if r.selected]
    analysis = analyze_performance(answered_responses, question_map)

    # Calculate max possible score from submitted question map
    max_score = sum(question_map[resp.question_id]["marks"] for resp in submission.responses if resp.question_id in question_map)

    return TestResult(
        score=score,
        max_score=max_score,
        correct=correct,
        wrong=wrong,
        skipped=skipped,
        total=len(submission.responses),
        wrong_questions=wrong_questions,
        skipped_questions=skipped_questions,
        analysis=analysis,
        final_report=None,
    )


@router.post("/generate-explanation", response_model=ExplanationResponse)
async def get_explanation(req: ExplanationRequest):
    """
    Generate an on-demand detailed conceptual explanation and tip for a wrong answer.
    """
    question_data = {
        "question": req.question,
        "options": req.options,
        "correct_answer": req.correct_answer,
        "user_answer": req.user_answer,
        "topic": req.topic,
        "base_explanation": req.base_explanation,
    }

    result = await generate_ai_explanation(
        question_data,
        language_mode=req.language_mode
    )

    return ExplanationResponse(
        detailed_explanation=result.get("detailed_explanation", ""),
        quick_tip=result.get("quick_tip", "")
    )


@router.post("/generate-report", response_model=FinalReportItem)
async def get_report(req: ReportRequest):
    """
    Dynamically regenerate the AI Final Report for a new language.
    """
    result = await generate_final_report(
        req.analysis_data.dict(),
        language_mode=req.language_mode
    )
    
    return FinalReportItem(**result)
