# Abhyas AI Platform

A high-performance mock test examination platform built with **FastAPI** (Python backend) and **React + Vite** (JavaScript frontend). The platform features an intelligent multi-lingual AI Mentor (powered by Sarvam-105b) that dynamically scores tests, isolates weaknesses, and dynamically derives mathematically complex problem explanations in real-time.

## Features
- **Dynamic Exam Framework:** Full-screen standardized testing environment supporting multiple subjects (JEE, NEET, etc.) with responsive timers.
- **Fail-Safe AI Mentor:** Aggregates exam metrics and pipes them into `sarvam-105b`. It features a highly resilient context-window trap that gracefully intercepts infinite derivation loops and mathematical calculation limits.
- **Progressive UI Rendering:** The backend API (`/submit-test`) serves test results in under 100ms. The UI then lazily fetches 4000+ words of heavy mathematical AI reports via background thread, wrapping them in an elegant `@keyframes` CSS presentation.
- **Multi-Lingual Caching:** Generates AI feedback in localized dialects (English/Hinglish). Reports are seamlessly hydrated into persistent `localStorage` and never re-fetched twice.

## Local Setup

### 1. Prerequisites
- Python 3.10+
- Node.js (v16+)
- npm or yarn

### 2. Backend Setup (FastAPI)
1. Open up a terminal in the root directory.
2. Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   - Copy `.env.example` to `.env`.
   - Add your `SARVAM_API_KEY`.
5. Run the FastAPI development server:
   ```powershell
   uvicorn main:app --reload
   ```
   > The backend will map to `http://127.0.0.1:8000`.

### 3. Frontend Setup (React/Vite)
1. Open a *second* terminal and navigate to the frontend folder:
   ```powershell
   cd frontend
   ```
2. Install Node dependencies:
   ```powershell
   npm install
   ```
3. Start the Vite React development server:
   ```powershell
   npm run dev
   ```
   > The frontend will map to `http://localhost:5173`. Any explicit backend fetch calls (`/submit-test`, etc.) will automatically proxy to the FastAPI port 8000 backend natively.

