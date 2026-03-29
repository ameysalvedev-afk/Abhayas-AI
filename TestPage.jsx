import { useState, useEffect, useRef, useMemo } from 'react'

const STATUS = {
  NOT_VISITED:  'not_visited',
  ANSWERED:     'answered',
  NOT_ANSWERED: 'not_answered',
  REVIEW:       'review',
}

const STATUS_COLORS = {
  [STATUS.NOT_VISITED]:  '#d1d5db',
  [STATUS.ANSWERED]:     '#00b894',
  [STATUS.NOT_ANSWERED]: '#e74c3c',
  [STATUS.REVIEW]:       '#6c5ce7',
}

const STATUS_LABELS = {
  [STATUS.NOT_VISITED]:  'Not Visited',
  [STATUS.ANSWERED]:     'Answered',
  [STATUS.NOT_ANSWERED]: 'Not Answered',
  [STATUS.REVIEW]:       'Marked for Review',
}

// total exam time in seconds (3 hours)
const TOTAL_TIME = 3 * 60 * 60

export default function TestPage({ questions: initialQuestions, exam = 'JEE', onComplete, languageMode = 'English' }) {
  // ── State ──────────────────────────────────────────────────────
  const [questions] = useState(initialQuestions || [])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [qStates, setQStates] = useState(() =>
    (initialQuestions || []).map(() => ({
      selected: null,
      status: STATUS.NOT_VISITED,
      timeSpent: 0,
    }))
  )
  const [activeTab, setActiveTab] = useState('All')
  const [totalTime, setTotalTime] = useState(TOTAL_TIME)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const totalTimerRef = useRef(null)
  const qTimerRef = useRef(null)

  // ── Subjects from questions ────────────────────────────────────
  const subjects = useMemo(() => {
    const s = [...new Set(questions.map(q => q.subject))]
    return ['All', ...s]
  }, [questions])

  // ── Filtered question indices by subject ───────────────────────
  const filteredIndices = useMemo(() => {
    if (activeTab === 'All') return questions.map((_, i) => i)
    return questions.reduce((acc, q, i) => {
      if (q.subject === activeTab) acc.push(i)
      return acc
    }, [])
  }, [questions, activeTab])

  // ── Mark current question as visited ───────────────────────────
  useEffect(() => {
    setQStates(prev => {
      const next = [...prev]
      if (next[currentIdx]?.status === STATUS.NOT_VISITED) {
        next[currentIdx] = { ...next[currentIdx], status: STATUS.NOT_ANSWERED }
      }
      return next
    })
  }, [currentIdx])

  // ── Total countdown timer ──────────────────────────────────────
  useEffect(() => {
    totalTimerRef.current = setInterval(() => {
      setTotalTime(t => {
        if (t <= 1) {
          clearInterval(totalTimerRef.current)
          handleSubmit()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(totalTimerRef.current)
  }, [])

  // ── Per-question timer ─────────────────────────────────────────
  useEffect(() => {
    qTimerRef.current = setInterval(() => {
      setQStates(prev => {
        const next = [...prev]
        next[currentIdx] = {
          ...next[currentIdx],
          timeSpent: next[currentIdx].timeSpent + 1,
        }
        return next
      })
    }, 1000)
    return () => clearInterval(qTimerRef.current)
  }, [currentIdx])

  // ── Helpers ────────────────────────────────────────────────────
  const formatTime = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const handleSelect = (key) => {
    setQStates(prev => {
      const next = [...prev]
      next[currentIdx] = { ...next[currentIdx], selected: key }
      return next
    })
  }

  const saveAndNext = () => {
    setQStates(prev => {
      const next = [...prev]
      if (next[currentIdx].selected) {
        next[currentIdx] = { ...next[currentIdx], status: STATUS.ANSWERED }
      }
      return next
    })
    goNext()
  }

  const markForReview = () => {
    setQStates(prev => {
      const next = [...prev]
      next[currentIdx] = { ...next[currentIdx], status: STATUS.REVIEW }
      return next
    })
    goNext()
  }

  const clearResponse = () => {
    setQStates(prev => {
      const next = [...prev]
      next[currentIdx] = { ...next[currentIdx], selected: null, status: STATUS.NOT_ANSWERED }
      return next
    })
  }

  const goNext = () => {
    if (currentIdx < questions.length - 1) setCurrentIdx(i => i + 1)
  }

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(i => i - 1)
  }

  const jumpTo = (idx) => {
    setCurrentIdx(idx)
  }

  const handleSubmit = async () => {
    clearInterval(totalTimerRef.current)
    clearInterval(qTimerRef.current)
    setSubmitting(true)

    const responses = questions.map((q, i) => ({
      question_id: q.id,
      selected: qStates[i].selected || '',
      time_spent: qStates[i].timeSpent,
    }))

    try {
      const res = await fetch('/submit-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          responses,
          language_mode: languageMode.toLowerCase()
        }),
      })
      const data = await res.json()
      onComplete(data)
    } catch {
      setError('Failed to submit test. Please try again.')
      setSubmitting(false)
    }
  }

  // ── Status counts ──────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = { [STATUS.ANSWERED]: 0, [STATUS.NOT_ANSWERED]: 0, [STATUS.NOT_VISITED]: 0, [STATUS.REVIEW]: 0 }
    qStates.forEach(s => { c[s.status] = (c[s.status] || 0) + 1 })
    return c
  }, [qStates])

  // ── Render states ──────────────────────────────────────────────
  if (submitting) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p className="loading-text">Analyzing your performance with AI...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', marginBottom: '1rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>No questions available for this configuration.</p>
      </div>
    )
  }

  const q = questions[currentIdx]
  const qs = qStates[currentIdx]

  return (
    <div className="exam-wrapper">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="exam-header">
        <div className="exam-header-left">
          <h2 className="exam-title">{exam} Mock Test</h2>
          <span className="exam-subtitle">Abhyas AI</span>
        </div>
        <div className="exam-header-right">
          <div className={`exam-total-timer ${totalTime < 300 ? 'danger' : totalTime < 900 ? 'warning' : ''}`}>
            ⏱ {formatTime(totalTime)}
          </div>
        </div>
      </div>

      {/* ── Subject Tabs ───────────────────────────────── */}
      <div className="exam-tabs">
        {subjects.map(sub => (
          <button
            key={sub}
            className={`exam-tab ${activeTab === sub ? 'active' : ''}`}
            onClick={() => setActiveTab(sub)}
          >
            {sub}
          </button>
        ))}
      </div>

      {/* ── Main Layout ────────────────────────────────── */}
      <div className="exam-body">
        {/* LEFT — Question Area */}
        <div className="exam-question-area">
          <div className="exam-question-header">
            <span className="exam-q-number">Question {currentIdx + 1} of {questions.length}</span>
            <span className="exam-q-timer">⏱ {formatTime(qs.timeSpent)}</span>
          </div>

          <div className="exam-question-meta">
            <span className="tag tag-subject">{q.subject}</span>
            <span className="tag tag-topic">{q.topic}</span>
            <span className={`tag tag-${q.difficulty}`}>{q.difficulty}</span>
          </div>

          <p className="exam-question-text">{q.question}</p>

          <div className="exam-options">
            {Object.entries(q.options).map(([key, value]) => (
              <button
                key={key}
                className={`exam-option ${qs.selected === key ? 'selected' : ''}`}
                onClick={() => handleSelect(key)}
              >
                <span className="exam-option-key">{key}</span>
                <span>{value}</span>
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="exam-actions">
            <div className="exam-actions-left">
              <button className="btn btn-outline" onClick={clearResponse}>Clear Response</button>
              <button className="btn btn-review" onClick={markForReview}>Mark for Review & Next</button>
            </div>
            <div className="exam-actions-right">
              <button className="btn btn-secondary" onClick={goPrev} disabled={currentIdx === 0}>
                ← Previous
              </button>
              <button className="btn btn-primary" onClick={saveAndNext}>
                Save & Next →
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Navigation Panel */}
        <div className="exam-nav-panel">
          <div className="exam-nav-title">Question Palette</div>

          {/* Legend */}
          <div className="exam-legend">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div className="exam-legend-item" key={key}>
                <span className="exam-legend-dot" style={{ background: STATUS_COLORS[key] }} />
                <span>{label}</span>
                <span className="exam-legend-count">{counts[key]}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="exam-nav-grid">
            {filteredIndices.map(idx => (
              <button
                key={idx}
                className={`exam-nav-btn ${idx === currentIdx ? 'current' : ''}`}
                style={{
                  background: STATUS_COLORS[qStates[idx].status],
                  color: qStates[idx].status === STATUS.NOT_VISITED ? '#555' : '#fff',
                }}
                onClick={() => jumpTo(idx)}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {/* Submit */}
          <button className="btn btn-submit" onClick={handleSubmit}>
            Submit Test
          </button>
        </div>
      </div>
    </div>
  )
}
