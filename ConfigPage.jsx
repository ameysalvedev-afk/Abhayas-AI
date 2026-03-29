import { useState } from 'react'

const EXAM_SUBJECTS = {
  JEE:  ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
}

export default function ConfigPage({ exam, onStart, onBack }) {
  const subjects = EXAM_SUBJECTS[exam] || []
  const [counts, setCounts] = useState(
    Object.fromEntries(subjects.map(s => [s, 3]))
  )

  const totalQuestions = Object.values(counts).reduce((a, b) => a + b, 0)

  const handleChange = (subject, value) => {
    setCounts(prev => ({ ...prev, [subject]: Number(value) }))
  }

  const handleStart = () => {
    onStart(counts)
  }

  return (
    <div>
      <button className="back-btn" onClick={onBack}>← Back to Home</button>

      <div className="card">
        <div className="card-title">
          {exam === 'JEE' ? '🚀' : '🧬'} {exam} Test Configuration
        </div>

        <p className="config-desc">
          Choose how many questions you want from each subject.
        </p>

        <div className="slider-list">
          {subjects.map(subject => (
            <div className="slider-row" key={subject}>
              <div className="slider-label">
                <span className="slider-subject">{subject}</span>
                <span className="slider-value">{counts[subject]}</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={counts[subject]}
                onChange={(e) => handleChange(subject, e.target.value)}
                className="slider"
              />
              <div className="slider-range">
                <span>0</span>
                <span>10</span>
              </div>
            </div>
          ))}
        </div>

        <div className="config-summary">
          Total questions: <strong>{totalQuestions}</strong>
        </div>

        <div className="config-actions">
          <button
            className="btn btn-primary"
            disabled={totalQuestions === 0}
            onClick={handleStart}
          >
            Start Test →
          </button>
        </div>
      </div>
    </div>
  )
}
