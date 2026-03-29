"""
AI Mentor service — calls Sarvam API to generate personalised
feedback for each wrong answer.
"""

import json
import os
import re
import httpx
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_MODEL = os.getenv("SARVAM_MODEL", "sarvam-105b")
SARVAM_API_URL = "https://api.sarvam.ai/v1/chat/completions"

MENTOR_SYSTEM_PROMPT = """You are an expert JEE/NEET tutor.

Your student just answered a question incorrectly.

Your task:
1. Explain the concept to them in a clear and detailed way using the base explanation. Address them directly using 'you' or 'your'.
2. Expand the explanation with reasoning and intuition.
3. Provide a helpful, encouraging tip to avoid similar mistakes.

Do NOT mention what option they selected.
Do NOT get stuck in long continuous reasoning loops. Keep your internal derivations extremely concise.

Keep your tone:
- friendly and encouraging
- slightly informal
- conceptual and student-friendly
"""

REPORT_SYSTEM_PROMPT = """You are an expert academic performance analyst mentoring a student.

Analyze your student's test performance. Address them directly using 'you' and 'your'.

Data:
- Topic Accuracy: {topic_accuracy}
- Topic Time (in seconds): {topic_time}
- Weak Topics: {weak_topics}
- Strong Topics: {strong_topics}
- Time Waste Topics (topics where the student spent too many seconds): {time_waste_topics}

Your task:
1. Summarize their overall performance encouragingly.
2. Identify strengths. Always highlight at least one strength, even if performance is weak.
3. Identify weaknesses. Always mention at least one area to improve, even if performance is strong.
4. Analyze their time management behavior.
5. Give specific improvement recommendations. Always include at least one action item.

Keep your tone:
- friendly and motivating
- slightly informal
- clear and structured
- highly practical
"""

TIMEOUT_SECONDS = 120


async def generate_ai_explanation(question_data: dict, language_mode: str = "english") -> dict:
    """
    Call Sarvam API to get detailed conceptual explanation and tip.
    """
    fallback = _build_explanation_fallback(question_data)

    if not SARVAM_API_KEY or SARVAM_API_KEY == "your_api_key_here":
        return fallback

    user_prompt = (
        f"Question:\n{question_data['question']}\n\n"
        f"Options:\n{json.dumps(question_data['options'], indent=2)}\n\n"
        f"Correct Answer:\n{question_data['correct_answer']}\n\n"
        f"Base Explanation:\n{question_data.get('base_explanation', '')}\n\n"
        "Respond ONLY with a strictly valid JSON object. Do not include markdown formatting.\n"
        "CRITICAL: The values must be single continuous strings. Use \\n\\n for paragraphs. NEVER break a string with unkeyed quotes.\n"
        "{\n"
        '  "detailed_explanation": "<Write the entire detailed explanation here as a single string>",\n'
        '  "quick_tip": "<Write the quick tip here>"\n'
        "}"
    )

    messages = []
    
    system_prompt = MENTOR_SYSTEM_PROMPT
    if language_mode.lower() == "hinglish":
        system_prompt += "\n\nCRITICAL LANGUAGE INSTRUCTION:\nRespond entirely in Hinglish (a vibrant mix of Hindi written in English script and English words). Use a casual, warm, student-friendly tone. Example: 'Bhai tumne yaha galti ki...' or 'Dekho dost, concept simple hai...'"
        
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_prompt})

    headers = {
        "Authorization": f"Bearer {SARVAM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": SARVAM_MODEL,
        "messages": messages,
        "max_tokens": 15000,
        "temperature": 0.4,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(SARVAM_API_URL, headers=headers, json=payload)
            resp.raise_for_status()

            data = resp.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            content = content or ""

            # Strip markdown and thinking tags
            content = content.replace("```json", "").replace("```", "").strip()
            content = re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL)

            # Use regex to find the first JSON object in case there's conversational text
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            
            # Helper to harvest raw string on failure
            def _harvest_raw():
                raw_text = content or data.get("choices", [{}])[0].get("message", {}).get("reasoning_content", "")
                if "<think>" in raw_text:
                    raw_text = raw_text.replace("<think>", "").replace("</think>", "").strip()
                # Clean up partially formulated json schema brackets/quotes
                raw_text = re.sub(r'["{}\[\]\\]', '', raw_text).replace('detailed_explanation:', '').strip()
                return {
                    "detailed_explanation": raw_text[:3000] + "...\n\n[Explanation truncated due to AI generation limits]" if raw_text else fallback["detailed_explanation"],
                    "quick_tip": "Review the partial derivation above." 
                }

            if not json_match:
                print(f"AI Mentor Error: No JSON object found. Harvesting raw derivation.\nRAW CONTENT: {repr(content)}")
                return _harvest_raw()
                
            json_str = json_match.group(0)
            
            try:
                parsed = json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"AI Mentor Error: Corrupted JSON formatting. Harvesting raw derivation. Exception: {e}")
                return _harvest_raw()

            return {
                "detailed_explanation": parsed.get("detailed_explanation", fallback["detailed_explanation"]),
                "quick_tip": parsed.get("quick_tip", fallback["quick_tip"])
            }

    except httpx.HTTPStatusError as e:
        print(f"AI Mentor HTTP Error (explanation) {e.response.status_code}: {e.response.text}")
        return fallback
    except Exception as e:
        print(f"AI Mentor Error (explanation): {repr(e)}\nRaw Content: {content if 'content' in locals() else 'None'}")
        return fallback


async def generate_final_report(analysis_data: dict, language_mode: str = "english") -> dict:
    """
    Call Sarvam API to generate a final summary report based on the performance analysis.
    """
    fallback = _build_report_fallback(analysis_data)

    if not SARVAM_API_KEY or SARVAM_API_KEY == "your_api_key_here":
        return fallback

    system_prompt = REPORT_SYSTEM_PROMPT.format(
        topic_accuracy=json.dumps(analysis_data.get("topic_accuracy", {})),
        topic_time=json.dumps(analysis_data.get("topic_time", {})),
        weak_topics=json.dumps(analysis_data.get("weak_topics", [])),
        strong_topics=json.dumps(analysis_data.get("strong_topics", [])),
        time_waste_topics=json.dumps(analysis_data.get("time_waste_topics", [])),
    )
    
    if language_mode.lower() == "hinglish":
        system_prompt += "\n\nCRITICAL LANGUAGE INSTRUCTION:\nRespond entirely in Hinglish (a vibrant mix of Hindi written in English script and English words). Use a casual, warm, student-friendly tone. Example: 'Bhai tumne yaha galti ki...' or 'Dekho dost, concept simple hai...'"

    user_prompt = (
        "Generate a strictly valid JSON report reflecting on this performance data.\n"
        "CRITICAL: The JSON values must be single continuous strings. Use \\n\\n for paragraphs if needed.\n"
        "Respond ONLY with the JSON, no extra formatting:\n"
        "{\n"
        '  "summary": "<Overall 2-sentence summary of performance>",\n'
        '  "strengths": ["<strength 1>", "<strength 2>"],\n'
        '  "weaknesses": ["<weakness 1>", "<weakness 2>"],\n'
        '  "time_analysis": "<1-sentence analysis of time spent, mentioning seconds>",\n'
        '  "recommendations": ["<actionable advice 1>", "<actionable advice 2>"]\n'
        "}"
    )

    if language_mode.lower() == "hinglish":
        user_prompt += "\n\nCRITICAL INSTRUCTION: You MUST translate ALL JSON output text natively into conversational Hinglish (Hindi + English). Do not write English-only sentences."

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    headers = {
        "Authorization": f"Bearer {SARVAM_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": SARVAM_MODEL,
        "messages": messages,
        "max_tokens": 15000,
        "temperature": 0.4,
    }

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            resp = await client.post(SARVAM_API_URL, headers=headers, json=payload)
            resp.raise_for_status()

            data = resp.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            content = content or ""

            # Strip markdown and thinking tags
            content = content.replace("```json", "").replace("```", "").strip()
            content = re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL)

            # Use regex to find the first JSON object in case there's conversational text
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            
            def _harvest_report_raw():
                raw_text = content or data.get("choices", [{}])[0].get("message", {}).get("reasoning_content", "")
                if "<think>" in raw_text:
                    raw_text = raw_text.replace("<think>", "").replace("</think>", "").strip()
                # Clean up partially formulated json strings
                raw_text = re.sub(r'["{}\[\]\\]', '', raw_text)
                raw_text = re.sub(r'(summary|strengths|weaknesses|time_analysis|recommendations)\s*:', '\n', raw_text).strip()
                return {
                    "summary": raw_text[:2000] + "...\n\n[Report truncated by AI]" if raw_text else fallback["summary"],
                    "strengths": fallback["strengths"],
                    "weaknesses": fallback["weaknesses"],
                    "time_analysis": fallback["time_analysis"],
                    "recommendations": fallback["recommendations"],
                }

            if not json_match:
                print(f"AI Mentor Error (report): No JSON object found. Harvesting raw text.\nRAW CONTENT: {repr(content)}")
                return _harvest_report_raw()
                
            json_str = json_match.group(0)
            try:
                parsed = json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"AI Mentor Error (report): Corrupted JSON formatting. Harvesting raw text. Exception: {e}")
                return _harvest_report_raw()
            
            # Ensure proper types
            return {
                "summary": parsed.get("summary", fallback["summary"]),
                "strengths": parsed.get("strengths") or fallback["strengths"],
                "weaknesses": parsed.get("weaknesses") or fallback["weaknesses"],
                "time_analysis": parsed.get("time_analysis", fallback["time_analysis"]),
                "recommendations": parsed.get("recommendations") or fallback["recommendations"],
            }

    except httpx.HTTPStatusError as e:
        print(f"AI Mentor HTTP Error (report) {e.response.status_code}: {e.response.text}")
        return fallback
    except Exception as e:
        print(f"AI Mentor Error (report): {repr(e)}")
        return fallback


def _build_explanation_fallback(question_data: dict) -> dict:
    """Return fallback feedback using the dataset's base explanation."""
    return {
        "detailed_explanation": question_data.get("base_explanation", "No detailed explanation available."),
        "quick_tip": "Review the core concepts carefully and try again.",
    }


def _build_report_fallback(analysis_data: dict) -> dict:
    """Return a generic rule-based final report fallback."""
    return {
        "summary": "This is a basic rule-based summary since the AI is unavailable.",
        "strengths": analysis_data.get("strong_topics", []),
        "weaknesses": analysis_data.get("weak_topics", []),
        "time_analysis": "Review the average time spent on your weak topics.",
        "recommendations": ["Practice more questions on your weak topics."],
    }
