export default function HomePage({ onSelectExam, testHistory = [], onViewTest }) {
  // Helper to format date
  const formatDate = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    })
  }

  return (
    <div className="home-page">
      <div className="hero">
        <h1 className="hero-title">Abhyas AI</h1>
        <p className="hero-subtitle">AI-Powered Mock Test Platform</p>
        <p className="hero-desc">
          Practice with smart question selection and get instant AI feedback on your performance.
        </p>
      </div>

      <div className="exam-grid">
        <button className="exam-card jee" onClick={() => onSelectExam('JEE')}>
          <div className="exam-icon">🚀</div>
          <h2>Take JEE Test</h2>
          <p>Physics · Chemistry · Mathematics</p>
        </button>

        <button className="exam-card neet" onClick={() => onSelectExam('NEET')}>
          <div className="exam-icon">🧬</div>
          <h2>Take NEET Test</h2>
          <p>Physics · Chemistry · Biology</p>
        </button>
      </div>

      {testHistory.length > 0 && (
        <div className="history-section">
          <h3 className="history-title">🕒 Previous Tests</h3>
          <div className="history-grid">
            {testHistory.map(test => (
              <div key={test.id} className="history-card">
                <div className="history-card-header">
                  <div className="history-exam">{test.exam || 'JEE'} Mock</div>
                  <div className="history-date">{formatDate(test.date)}</div>
                </div>
                
                <div className="history-stats">
                  <div className="h-stat main">
                    <span className="h-val">{test.result.score}</span>
                    <span className="h-lbl">Score</span>
                  </div>
                  <div className="h-stat">
                    <span className="h-val positive">{test.result.correct}</span>
                    <span className="h-lbl">Correct</span>
                  </div>
                  <div className="h-stat">
                    <span className="h-val negative">{test.result.wrong}</span>
                    <span className="h-lbl">Wrong</span>
                  </div>
                  <div className="h-stat">
                    <span className="h-val muted">{test.result.skipped}</span>
                    <span className="h-lbl">Skipped</span>
                  </div>
                </div>

                <button 
                  className="btn btn-primary history-btn" 
                  onClick={() => onViewTest(test)}
                >
                  View Details & AI Explanations →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
