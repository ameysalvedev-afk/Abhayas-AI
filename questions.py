import json
from pathlib import Path
from fastapi import APIRouter, HTTPException

from models.schemas import Question, QuestionsResponse

router = APIRouter()

QUESTIONS_FILE = Path(__file__).resolve().parent.parent / "data" / "questions.json"


def load_questions() -> list[dict]:
    """Load questions from the JSON file."""
    try:
        with open(QUESTIONS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("questions", [])
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Questions file not found.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid JSON in questions file.")


@router.get("/questions", response_model=QuestionsResponse)
async def get_questions():
    """Return all questions."""
    questions = load_questions()
    return {"questions": questions}
