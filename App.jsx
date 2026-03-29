import { useState } from 'react'
import HomePage from './pages/HomePage'
import ConfigPage from './pages/ConfigPage'
import TestPage from './pages/TestPage'
import ResultDashboard from './pages/ResultDashboard'

function App() {
  const [page, setPage] = useState('home')  // 'home' | 'config' | 'test' | 'result'
  const [exam, setExam] = useState(null)     // 'JEE' | 'NEET'
  const [testQuestions, setTestQuestions] = useState([])
  const [result, setResult] = useState(null)
  const [activeTestId, setActiveTestId] = useState(null) // ID of current or viewed test
  
  // Load initial test history from localStorage
  const [testHistory, setTestHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('test_history')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Load language preference from localStorage
  const [languageMode, setLanguageMode] = useState(() => {
    return localStorage.getItem('language_mode') || 'English'
  })

  const handleLanguageToggle = () => {
    const newLang = languageMode === 'English' ? 'Hinglish' : 'English'
    setLanguageMode(newLang)
    localStorage.setItem('language_mode', newLang)
  }

  const handleSelectExam = (selectedExam) => {
    setExam(selectedExam)
    setPage('config')
  }

  const handleStartTest = async (subjectCounts) => {
    // Fetch all questions, filter & sample by subject counts
    try {
      const res = await fetch('/questions')
      const data = await res.json()
      const allQuestions = data.questions || []

      let selected = []
      for (const [subject, count] of Object.entries(subjectCounts)) {
        if (count === 0) continue
        const subjectQs = allQuestions.filter(
          q => q.subject.toLowerCase() === subject.toLowerCase()
        )
        // Shuffle and pick 'count' questions
        const shuffled = [...subjectQs].sort(() => Math.random() - 0.5)
        selected = selected.concat(shuffled.slice(0, count))
      }

      // We no longer do a final shuffle, so the subject order is preserved:
      // typically Physics -> Chemistry -> Math/Biology.
      // (The questions are already shuffled within each subject)

      setTestQuestions(selected)
      setPage('test')
    } catch {
      alert('Failed to load questions. Is the backend running?')
    }
  }

  const handleTestComplete = (data) => {
    const newTest = {
      id: Date.now(),
      date: new Date().toISOString(),
      exam,
      result: data,
      ai_explanations: {}
    }

    setTestHistory(prev => {
      const updated = [newTest, ...prev].slice(0, 2)
      localStorage.setItem('test_history', JSON.stringify(updated))
      return updated
    })

    setResult(data)
    setActiveTestId(newTest.id)
    setPage('result')
  }

  const handleViewTest = (historyItem) => {
    setExam(historyItem.exam)
    setResult(historyItem.result)
    setActiveTestId(historyItem.id)
    setPage('result')
  }

  const handleSaveExplanation = (testId, qId, data) => {
    setTestHistory(prev => {
      const updated = prev.map(test => {
        if (test.id === testId) {
          return {
            ...test,
            ai_explanations: {
              ...test.ai_explanations,
              [qId]: data
            }
          }
        }
        return test
      })
      localStorage.setItem('test_history', JSON.stringify(updated))
      return updated
    })
  }

  const handleSaveReport = (testId, language, reportData) => {
    setTestHistory(prev => {
      const updated = prev.map(test => {
        if (test.id === testId) {
          return {
            ...test,
            final_reports: {
              ...(test.final_reports || {}),
              [language.toLowerCase()]: reportData
            }
          }
        }
        return test
      })
      localStorage.setItem('test_history', JSON.stringify(updated))
      return updated
    })
  }

  const handleGoHome = () => {
    setExam(null)
    setTestQuestions([])
    setResult(null)
    setActiveTestId(null)
    setPage('home')
  }

  return (
    <div className={page === 'test' ? '' : 'app-container'}>
      {page !== 'home' && page !== 'test' && (
        <header className="app-header">
          <div>
            <h1>Abhyas AI</h1>
            <p>AI-Powered Mock Test Platform</p>
          </div>
        </header>
      )}

      {page === 'home' && (
        <HomePage 
          onSelectExam={handleSelectExam} 
          testHistory={testHistory}
          onViewTest={handleViewTest}
        />
      )}

      {page === 'config' && (
        <ConfigPage exam={exam} onStart={handleStartTest} onBack={handleGoHome} />
      )}

      {page === 'test' && (
        <TestPage 
          questions={testQuestions} 
          exam={exam} 
          onComplete={handleTestComplete} 
          languageMode={languageMode}
        />
      )}

      {page === 'result' && result && (
        <ResultDashboard 
          result={result} 
          onRetake={handleGoHome}
          aiExplanations={testHistory.find(t => t.id === activeTestId)?.ai_explanations || {}}
          onSaveExplanation={(qId, data) => handleSaveExplanation(activeTestId, qId, data)}
          localReports={testHistory.find(t => t.id === activeTestId)?.final_reports || {}}
          onSaveReport={(lang, data) => handleSaveReport(activeTestId, lang, data)}
          languageMode={languageMode}
          onLanguageToggle={handleLanguageToggle}
        />
      )}
    </div>
  )
}

export default App
