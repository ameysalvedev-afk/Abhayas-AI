import { useState, useEffect, useRef } from 'react'

export default function ResultDashboard({ result, onRetake, aiExplanations = {}, onSaveExplanation, localReports: initialReports = {}, onSaveReport, languageMode = 'English', onLanguageToggle }) {
  const { 
    score, max_score, correct, wrong, skipped, total, analysis,
    wrong_questions = [], skipped_questions = []
  } = result
  
  // States for AI Feedback section
  const [explanations, setExplanations] = useState(aiExplanations)
  const [loadingIds, setLoadingIds] = useState({})
  
  // Multi-Language Report Caching
  const [localReports, setLocalReports] = useState(initialReports)
  const [reportLoading, setReportLoading] = useState(false)
  const fetchingRef = useRef({})

  // Fetch report on language change if not cached
  useEffect(() => {
    const fetchReport = async () => {
      const mode = languageMode.toLowerCase()
      if (localReports[mode] || fetchingRef.current[mode]) return // Already cached or currently fetching

      fetchingRef.current[mode] = true
      setReportLoading(true)
      try {
        const res = await fetch('/generate-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis_data: analysis,
            language_mode: mode
          })
        })
        const data = await res.json()
        setLocalReports(prev => ({ ...prev, [mode]: data }))
        if (onSaveReport) onSaveReport(mode, data)
      } catch (err) {
        console.error('Failed to translate report', err)
      } finally {
        fetchingRef.current[mode] = false
        setReportLoading(false)
      }
    }
    fetchReport()
  }, [languageMode, analysis, localReports, onSaveReport])

  // Extract available subjects from wrong/skipped questions
  const availableSubjects = [...new Set([
    ...wrong_questions, ...skipped_questions
  ].map(q => q.subject))].filter(Boolean)

  const [activeSubject, setActiveSubject] = useState(availableSubjects[0] || 'Physics')
  const [selectedQuestion, setSelectedQuestion] = useState(null)

  const handleGenerateExplanation = async (q) => {
    const cacheKey = `${q.id}_${languageMode.toLowerCase()}`
    if (explanations[cacheKey]) return // Already cached

    setLoadingIds(prev => ({ ...prev, [q.id]: true }))
    try {
      const res = await fetch('/generate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          user_answer: q.user_answer,
          topic: q.topic,
          base_explanation: q.base_explanation,
          language_mode: languageMode.toLowerCase()
        })
      })
      const data = await res.json()
      setExplanations(prev => ({
        ...prev,
        [cacheKey]: data
      }))
      if (onSaveExplanation) {
        onSaveExplanation(cacheKey, data)
      }
    } catch (err) {
      console.error('Failed to generate explanation', err)
    } finally {
      setLoadingIds(prev => ({ ...prev, [q.id]: false }))
    }
  }

  return (
    <div>
      <button className="back-btn" onClick={onRetake}>
        ← Take Another Test
      </button>

      {/* ── Score Summary ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-title">📊 Score Summary</div>
        <div className="score-grid">
          <div className="score-item">
            <div className={`score-value ${score >= 0 ? 'positive' : 'negative'}`}>
              <span>{score}</span>
              <span style={{ fontSize: '0.6em', color: 'var(--text-muted)' }}>
                /{max_score || (total * 4)}
              </span>
            </div>
            <div className="score-label">Score</div>
          </div>
          <div className="score-item">
            <div className="score-value positive">{correct}</div>
            <div className="score-label">Correct</div>
          </div>
          <div className="score-item">
            <div className="score-value negative">{wrong}</div>
            <div className="score-label">Wrong</div>
          </div>
          <div className="score-item">
            <div className="score-value" style={{ color: 'var(--text-muted)' }}>{skipped}</div>
            <div className="score-label">Skipped</div>
          </div>
          <div className="score-item">
            <div className="score-value">{total}</div>
            <div className="score-label">Total</div>
          </div>
        </div>
      </div>

      {/* ── Topic Accuracy ──────────────────────────────────────── */}
      {analysis?.topic_accuracy && Object.keys(analysis.topic_accuracy).length > 0 && (
        <div className="card">
          <div className="card-title">🎯 Topic Accuracy</div>
          {Object.entries(analysis.topic_accuracy).map(([topic, acc]) => (
            <div className="topic-row" key={topic}>
              <div className="topic-name" title={topic}>{topic}</div>
              <div className="topic-bar-bg">
                <div
                  className={`topic-bar-fill ${acc > 80 ? 'high' : acc >= 50 ? 'medium' : 'low'}`}
                  style={{ width: `${acc}%` }}
                />
              </div>
              <div className="topic-value">{acc}%</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Time Analysis ───────────────────────────────────────── */}
      {analysis?.topic_time && Object.keys(analysis.topic_time).length > 0 && (
        <div className="card">
          <div className="card-title">⏱ Time per Topic</div>
          {Object.entries(analysis.topic_time).map(([topic, time]) => (
            <div className="topic-row" key={topic}>
              <div className="topic-name" title={topic}>{topic}</div>
              <div className="topic-bar-bg">
                <div
                  className={`topic-bar-fill ${time > 60 ? 'low' : time > 30 ? 'medium' : 'high'}`}
                  style={{ width: `${Math.min(time, 120) / 120 * 100}%` }}
                />
              </div>
              <div className="topic-value">{time}s</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Weak & Strong Topics ────────────────────────────────── */}
      {(analysis?.weak_topics?.length > 0 || analysis?.strong_topics?.length > 0 || analysis?.time_waste_topics?.length > 0) && (
        <div className="card">
          <div className="card-title">📈 Topic Classification</div>

          {analysis.strong_topics?.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div className="feedback-label">Strong Topics</div>
              <div className="tag-list">
                {analysis.strong_topics.map(t => (
                  <span className="tag strong" key={t}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {analysis.weak_topics?.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div className="feedback-label">Weak Topics</div>
              <div className="tag-list">
                {analysis.weak_topics.map(t => (
                  <span className="tag weak" key={t}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {analysis.time_waste_topics?.length > 0 && (
            <div>
              <div className="feedback-label">Time-Heavy Topics</div>
              <div className="tag-list">
                {analysis.time_waste_topics.map(t => (
                  <span className="tag time" key={t}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Final AI Report ──────────────────────────────────────── */}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          📋 AI Performance Report
          {onLanguageToggle && (
            <button 
              className={`lang-toggle ${languageMode.toLowerCase()}`} 
              onClick={onLanguageToggle}
              title="Toggle AI Language"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', marginTop: '-0.2rem' }}
            >
              {languageMode === 'English' ? '🇺🇸 English' : '🇮🇳 Hinglish'}
            </button>
          )}
        </div>

        {reportLoading ? (
          <div className="ai-loader-container">
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p className="ai-loader-text">Analyzing your performance...<br/>Generating personalized AI insights.</p>
          </div>
        ) : localReports[languageMode.toLowerCase()] ? (
          <div className="report-content">
            <p className="report-summary">{localReports[languageMode.toLowerCase()].summary}</p>

            {localReports[languageMode.toLowerCase()].strengths?.length > 0 && (
              <div className="report-section">
                <div className="report-section-title">Strengths</div>
                <ul className="report-list">
                  {localReports[languageMode.toLowerCase()].strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}

            {localReports[languageMode.toLowerCase()].weaknesses?.length > 0 && (
              <div className="report-section">
                <div className="report-section-title">Weaknesses</div>
                <ul className="report-list">
                  {localReports[languageMode.toLowerCase()].weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {localReports[languageMode.toLowerCase()].time_analysis && (
              <div className="report-section">
                <div className="report-section-title">Time Analysis</div>
                <p className="feedback-text">{localReports[languageMode.toLowerCase()].time_analysis}</p>
              </div>
            )}

            {localReports[languageMode.toLowerCase()].recommendations?.length > 0 && (
              <div className="report-section">
                <div className="report-section-title">Recommendations</div>
                <ul className="report-list">
                  {localReports[languageMode.toLowerCase()].recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="ai-loader-container">
            <p className="ai-loader-text" style={{ color: '#ff6b6b' }}>
              Basic analysis available. AI insights currently unavailable.
            </p>
          </div>
        )}
      </div>

      {/* ── AI Feedback Section ──────────────────────────────────── */}
      {availableSubjects.length > 0 && (
        <div className="card ai-feedback-container">
          <div className="card-title">🤖 AI Concept Explanations</div>
          <p className="feedback-desc">Review your mistakes and skipped questions deeply.</p>

          <div className="feedback-tabs">
            {availableSubjects.map(sub => (
              <button
                key={sub}
                className={`feedback-tab ${activeSubject === sub ? 'active' : ''}`}
                onClick={() => {
                  setActiveSubject(sub)
                  setSelectedQuestion(null)
                }}
              >
                {sub}
              </button>
            ))}
          </div>

          <div className="feedback-content">
            {/* Left: Question List */}
            <div className="feedback-sidebar">
              {['wrong', 'skipped'].map(type => {
                const list = type === 'wrong' ? wrong_questions : skipped_questions
                const subList = list.filter(q => q.subject === activeSubject)
                
                if (subList.length === 0) return null

                return (
                  <div key={type} className="feedback-list-group">
                    <div className="feedback-list-title">
                      {type === 'wrong' ? '❌ Wrong Answers' : '⚪ Skipped Questions'}
                    </div>
                    {subList.map((q, idx) => (
                      <button
                        key={q.id}
                        className={`feedback-list-item ${selectedQuestion?.id === q.id ? 'active' : ''}`}
                        onClick={() => setSelectedQuestion(q)}
                      >
                        <span className="q-truncate">{idx + 1}. {q.question.slice(0, 30)}...</span>
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>

            {/* Right: Detail View */}
            <div className="feedback-detail">
              {!selectedQuestion ? (
                <div className="feedback-empty">Select a question to view details.</div>
              ) : (
                <div className="feedback-detail-inner">
                  <div className="feedback-meta">
                    <span className="tag tag-topic">{selectedQuestion.topic}</span>
                  </div>
                  <p className="feedback-qtext">{selectedQuestion.question}</p>
                  
                  <div className="feedback-answers-grid">
                    <div className="ans-box correct">
                      <div className="ans-label">Correct Answer</div>
                      <div className="ans-val">
                        <strong>{selectedQuestion.correct_answer}</strong>:{' '}
                        {selectedQuestion.options[selectedQuestion.correct_answer]}
                      </div>
                    </div>
                    {selectedQuestion.user_answer && (
                      <div className="ans-box wrong">
                        <div className="ans-label">Your Answer</div>
                        <div className="ans-val">
                          <strong>{selectedQuestion.user_answer}</strong>:{' '}
                          {selectedQuestion.options[selectedQuestion.user_answer]}
                        </div>
                      </div>
                    )}
                  </div>

                  {!explanations[selectedQuestion.id + '_' + languageMode.toLowerCase()] ? (
                    <div className="feedback-action-area">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleGenerateExplanation(selectedQuestion)}
                        disabled={loadingIds[selectedQuestion.id]}
                      >
                        {loadingIds[selectedQuestion.id] ? 'Generating...' : '💡 Show Detailed Explanation'}
                      </button>
                      <p className="feedback-hint">This will ask the AI to explain the concept based on the correct answer.</p>
                    </div>
                  ) : (
                    <div className="ai-response-box">
                      <div className="ai-section">
                        <div className="ai-label">Explaining the Concept</div>
                        <div className="ai-text">{explanations[selectedQuestion.id + '_' + languageMode.toLowerCase()].detailed_explanation}</div>
                      </div>
                      <div className="ai-section tip">
                        <div className="ai-label">💡 Quick Tip</div>
                        <div className="ai-text">{explanations[selectedQuestion.id + '_' + languageMode.toLowerCase()].quick_tip}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Retake Button ────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button className="btn btn-primary" onClick={onRetake}>
          Take Another Test
        </button>
      </div>
    </div>
  )
}
