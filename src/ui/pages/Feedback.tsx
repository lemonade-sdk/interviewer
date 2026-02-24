import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, XCircle, ArrowLeft, Trophy, Zap,
} from 'lucide-react';
import { InterviewFeedback } from '../../types';

type FeedbackPhase = 'loading' | 'reviewing';

const Feedback: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<FeedbackPhase>('loading');
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [progressInfo, setProgressInfo] = useState({ questionIndex: 0, totalQuestions: 0, status: 'Starting analysis...' });
  const [error, setError] = useState<string | null>(null);
  const [animatingIn, setAnimatingIn] = useState(false);

  useEffect(() => {
    if (!id) return;
    generateFeedback();
    return () => {
      if (window.electronAPI) {
        window.electronAPI.offFeedbackProgress();
      }
    };
  }, [id]);

  const generateFeedback = useCallback(async () => {
    if (!id || !window.electronAPI) return;
    try {
      window.electronAPI.onFeedbackProgress((data) => {
        setProgressInfo(data);
      });
      const result = await window.electronAPI.generateFeedback(id);
      setFeedback(result);
      setPhase('reviewing');
      setAnimatingIn(true);
      setTimeout(() => setAnimatingIn(false), 600);
    } catch (err: any) {
      setError(err.message || 'Failed to generate feedback');
    } finally {
      if (window.electronAPI) {
        window.electronAPI.offFeedbackProgress();
      }
    }
  }, [id]);

  const goToQuestion = (index: number) => {
    if (!feedback || index < 0 || index >= feedback.questionFeedbacks.length) return;
    setAnimatingIn(true);
    setCurrentQuestionIndex(index);
    setTimeout(() => setAnimatingIn(false), 400);
  };

  const currentQF = feedback?.questionFeedbacks[currentQuestionIndex];
  const totalQuestions = feedback?.questionFeedbacks.length ?? 0;
  const progressPercent = progressInfo.totalQuestions > 0
    ? Math.round((progressInfo.questionIndex / progressInfo.totalQuestions) * 100)
    : 0;

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-lemonade-accent-hover';
      case 'needs-improvement': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-500 dark:text-white/40';
    }
  };

  const getRatingBg = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'bg-green-50 dark:bg-green-500/10 border-green-200/60 dark:border-green-500/15';
      case 'good': return 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/15';
      case 'needs-improvement': return 'bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-500/15';
      default: return 'bg-gray-50 dark:bg-white/[0.04] border-gray-200/50 dark:border-white/[0.08]';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent': return <CheckCircle2 className="w-4 h-4 text-green-500 dark:text-green-400" />;
      case 'good': return <AlertTriangle className="w-4 h-4 text-yellow-500 dark:text-yellow-400" />;
      case 'needs-improvement': return <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-lemonade-accent-hover';
    return 'text-red-600 dark:text-red-400';
  };

  // ─── LOADING PHASE ───
  if (phase === 'loading') {
    return (
      <div className="h-screen w-full bg-lemonade-bg dark:bg-lemonade-dark-bg text-black dark:text-white flex flex-col items-center justify-center transition-colors duration-300">
        <div className="w-full max-w-md px-6 flex flex-col items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-lemonade-accent-hover animate-spin" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">Analyzing Your Interview</h2>
            <p className="text-sm text-gray-500 dark:text-white/40">{progressInfo.status}</p>
          </div>

          <div className="w-full space-y-2">
            <div className="w-full h-2 bg-gray-200/60 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lemonade-accent to-lemonade-accent-hover rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-white/30 text-center">
              {progressInfo.questionIndex} of {progressInfo.totalQuestions} questions graded
            </p>
          </div>

          {error && (
            <div className="w-full border border-red-200/60 dark:border-red-500/15 bg-red-50 dark:bg-red-500/10 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── REVIEWING PHASE ───
  if (!feedback || !currentQF) {
    return (
      <div className="h-screen w-full bg-lemonade-bg dark:bg-lemonade-dark-bg flex items-center justify-center transition-colors duration-300">
        <p className="text-gray-500 dark:text-white/40">No feedback data available.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-lemonade-bg dark:bg-lemonade-dark-bg text-black dark:text-white flex flex-col overflow-hidden transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-lemonade-dark-surface transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors text-gray-400 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="w-[18px] h-[18px]" />
          </button>
          <div>
            <h1 className="text-sm font-semibold">Interview Feedback</h1>
            <p className="text-[11px] text-gray-500 dark:text-white/40">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-gray-400 dark:text-white/30 uppercase tracking-wider font-medium">Overall</p>
            <p className={`text-xl font-bold ${getScoreColor(feedback.overallScore)}`}>
              {feedback.overallScore}%
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-lemonade-accent/10 flex items-center justify-center">
            <Trophy className={`w-4 h-4 ${getScoreColor(feedback.overallScore)}`} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Q/A */}
        <div className="flex-1 border-r border-gray-200/50 dark:border-white/[0.08] flex flex-col">
          <div className="px-6 py-2.5 bg-lemonade-bg dark:bg-white/[0.02] border-b border-gray-100/60 dark:border-white/[0.04]">
            <div className="flex items-center gap-2">
              {getRatingIcon(currentQF.rating)}
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getRatingBg(currentQF.rating)} ${getRatingColor(currentQF.rating)}`}>
                {currentQF.rating.replace('-', ' ')}
              </span>
              <span className={`text-base font-bold ml-auto ${getScoreColor(currentQF.score)}`}>
                {currentQF.score}/100
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className={`p-6 space-y-5 transition-all duration-300 ${
              animatingIn ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
            }`}>
              {/* Question */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">
                  Question {currentQuestionIndex + 1}
                </p>
                <div className="p-4 rounded-2xl bg-lemonade-bg dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/[0.08]">
                  <p className="text-sm leading-relaxed">{currentQF.question}</p>
                </div>
              </div>

              {/* Answer */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">
                  Your Answer
                </p>
                <div className="p-4 rounded-2xl bg-lemonade-bg dark:bg-white/[0.03] border border-gray-200/50 dark:border-white/[0.08]">
                  <p className="text-sm leading-relaxed">{currentQF.answer}</p>
                </div>
              </div>

              {/* Suggested Answer */}
              {currentQF.suggestedAnswer && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-lemonade-accent-hover" />
                    Suggested Response
                  </p>
                  <div className="p-4 rounded-2xl bg-lemonade-accent/[0.04] border border-lemonade-accent/15">
                    <p className="text-sm leading-relaxed">{currentQF.suggestedAnswer}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Feedback & Suggestions */}
        <div className="w-[360px] flex flex-col">
          <div className="px-6 py-2.5 bg-lemonade-bg dark:bg-white/[0.02] border-b border-gray-100/60 dark:border-white/[0.04]">
            <p className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">
              Feedback & Suggestions
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className={`p-6 space-y-5 transition-all duration-300 delay-100 ${
              animatingIn ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
            }`}>
              {/* Strengths */}
              {currentQF.strengths.length > 0 && (
                <div className="bg-green-50 dark:bg-green-500/10 border border-green-200/60 dark:border-green-500/15 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      Strengths
                    </h3>
                  </div>
                  <div className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {currentQF.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
                          <span className="text-green-500 dark:text-green-400 mt-0.5">+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Improvements */}
              {currentQF.improvements.length > 0 && (
                <div className={`border rounded-2xl overflow-hidden ${
                  currentQF.rating === 'needs-improvement'
                    ? 'bg-red-50 dark:bg-red-500/10 border-red-200/60 dark:border-red-500/15'
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/15'
                }`}>
                  <div className="px-4 pt-4 pb-2">
                    <h3 className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                      currentQF.rating === 'needs-improvement' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      <AlertTriangle className="w-3 h-3" />
                      Areas to Improve
                    </h3>
                  </div>
                  <div className="px-4 pb-4">
                    <ul className="space-y-1.5">
                      {currentQF.improvements.map((imp, i) => (
                        <li key={i} className={`text-sm flex items-start gap-2 ${
                          currentQF.rating === 'needs-improvement' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                        }`}>
                          <span className={currentQF.rating === 'needs-improvement' ? 'text-red-500 mt-0.5' : 'text-amber-500 mt-0.5'}>!</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100/60 dark:border-white/[0.04]" />

              {/* Question Navigator */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">
                  All Questions
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {feedback.questionFeedbacks.map((qf, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      className={`w-full aspect-square rounded-xl text-xs font-semibold transition-all flex items-center justify-center border ${
                        idx === currentQuestionIndex
                          ? 'bg-lemonade-accent text-black border-lemonade-accent scale-105'
                          : getRatingBg(qf.rating) + ' hover:scale-105'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between px-6 py-3 border-t border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-lemonade-dark-surface transition-colors duration-300">
        <button
          onClick={() => goToQuestion(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-gray-200/50 dark:border-white/[0.08] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-1.5">
          {feedback.questionFeedbacks.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToQuestion(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentQuestionIndex
                  ? 'bg-lemonade-accent w-6'
                  : 'bg-gray-300 dark:bg-white/15 w-2 hover:bg-gray-400 dark:hover:bg-white/30'
              }`}
            />
          ))}
        </div>

        {currentQuestionIndex < totalQuestions - 1 ? (
          <button
            onClick={() => goToQuestion(currentQuestionIndex + 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-gray-200/50 dark:border-white/[0.08] rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-lemonade-accent text-black rounded-xl hover:bg-lemonade-accent-hover transition-colors"
          >
            Done
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </footer>
    </div>
  );
};

export default Feedback;
