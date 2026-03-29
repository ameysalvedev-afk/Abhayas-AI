from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.questions import router as questions_router
from routes.test import router as test_router

app = FastAPI(
    title="Abhyas AI API",
    description="Backend API for Abhyas AI — practice tests & question bank",
    version="0.1.0",
)

# ── CORS (allow all origins during development) ─────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ────────────────────────────────────────────────────────
app.include_router(questions_router)
app.include_router(test_router)


@app.get("/")
async def root():
    return {"message": "Abhyas AI API is running 🚀"}
