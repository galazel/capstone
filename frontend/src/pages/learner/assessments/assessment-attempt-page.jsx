import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAssessment } from '@/hooks/useAssessment'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle, AlertCircle } from 'lucide-react'

export default function AssessmentAttemptPage() {
  const [searchParams] = useSearchParams()
  const assessmentId = searchParams.get('id')
  const { attempt, startAttempt, submitAnswer, submitAttempt, loading } = useAssessment()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(3600) // 1 hour

  useEffect(() => {
    if (assessmentId && !attempt) {
      startAttempt(assessmentId)
    }
  }, [assessmentId, attempt, startAttempt])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleAnswerChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSubmit = async () => {
    if (attempt) {
      await submitAttempt(attempt.attemptId)
      // Redirect to results
      window.location.href = `/assessment/${attempt.attemptId}/results`
    }
  }

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  if (!attempt) return <div className="p-8 text-center">Loading assessment...</div>

  // Mock questions (replace with actual questions from backend)
  const mockQuestions = [
    {
      id: 1,
      type: 'multiple-choice',
      text: 'What does React stand for?',
      options: [
        'Real Action Timeline',
        'Reactive Components',
        'Response Activity',
        'Resource Allocation',
      ],
    },
    {
      id: 2,
      type: 'true-false',
      text: 'Hooks can only be called inside function components.',
      options: ['True', 'False'],
    },
    {
      id: 3,
      type: 'short-answer',
      text: 'Explain what the useEffect hook does.',
      options: [],
    },
  ]

  const question = mockQuestions[currentQuestion]
  const progress = ((currentQuestion + 1) / mockQuestions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Assessment: React Fundamentals</h1>
            <p className="text-slate-600">
              Question {currentQuestion + 1} of {mockQuestions.length}
            </p>
          </div>
          <div className="flex items-center gap-2 text-lg font-semibold px-4 py-2 bg-white rounded-lg border">
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-slate-600">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className="h-3 bg-blue-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">{question.text}</CardTitle>
          </CardHeader>
          <CardContent>
            {question.type === 'multiple-choice' && (
              <div className="space-y-3">
                {question.options.map((option, idx) => (
                  <label key={idx} className="flex items-center p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="ml-3">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'true-false' && (
              <div className="space-y-3">
                {question.options.map((option) => (
                  <label
                    key={option}
                    className="flex items-center p-4 border rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="ml-3">{option}</span>
                  </label>
                ))}
              </div>
            )}

            {question.type === 'short-answer' && (
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={6}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
            disabled={currentQuestion === 0}
            className="px-6 py-2 border rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex gap-2">
            {mockQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(idx)}
                className={`w-10 h-10 rounded-lg font-semibold transition ${
                  currentQuestion === idx
                    ? 'bg-blue-600 text-white'
                    : answers[q.id]
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-200 text-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {currentQuestion === mockQuestions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Submit Assessment
            </button>
          ) : (
            <button
              onClick={() => setCurrentQuestion(currentQuestion + 1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          )}
        </div>

        {/* Warning */}
        {timeLeft < 300 && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">
              <strong>Time warning:</strong> You have less than 5 minutes remaining to complete this assessment.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
