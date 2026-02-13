import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  AlertTriangle, XCircle, ArrowLeft, Trophy, Zap,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { ScrollArea } from '../components/ui/scroll-area';
import { cn } from '../lib/utils';
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

  // Generate feedback on mount
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
      // Listen for progress events
      window.electronAPI.onFeedbackProgress((data) => {
        setProgressInfo(data);
      });

      const result = await window.electronAPI.generateFeedback(id);
      setFeedback(result);
      setPhase('reviewing');
      setAnimatingIn(true);
      setTimeout(() => setAnimatingIn(false), 600);
    } catch (err: any) {
      console.error('Failed to generate feedback:', err);
      setError(err.message || 'Failed to generate feedback');
    } finally {
      if (window.electronAPI) {
        window.electronAPI.offFeedbackProgress();
      }
    }
  }, [id]);

  // Navigate through questions
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

  // Rating color utilities
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'text-green-600 dark:text-green-400';
      case 'good': return 'text-yellow-600 dark:text-yellow-400';
      case 'needs-improvement': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getRatingBg = (rating: string) => {
    switch (rating) {
      case 'excellent': return 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800';
      case 'good': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800';
      case 'needs-improvement': return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800';
      default: return 'bg-muted border-border';
    }
  };

  const getRatingIcon = (rating: string) => {
    switch (rating) {
      case 'excellent': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'good': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'needs-improvement': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  // ─── LOADING PHASE ───
  if (phase === 'loading') {
    return (
      <div className="h-screen w-full bg-background text-foreground flex flex-col items-center justify-center">
        <div className="w-full max-w-md px-6 flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold">Analyzing Your Interview</h2>
            <p className="text-sm text-muted-foreground">{progressInfo.status}</p>
          </div>

          <div className="w-full space-y-2">
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {progressInfo.questionIndex} of {progressInfo.totalQuestions} questions graded
            </p>
          </div>

          {error && (
            <Card className="w-full border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ─── REVIEWING PHASE ───
  if (!feedback || !currentQF) {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">No feedback data available.</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Interview Feedback</h1>
            <p className="text-xs text-muted-foreground">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
          </div>
        </div>

        {/* Overall Score */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Overall Score</p>
            <p className={cn('text-2xl font-bold', getScoreColor(feedback.overallScore))}>
              {feedback.overallScore}%
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className={cn('w-5 h-5', getScoreColor(feedback.overallScore))} />
          </div>
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Q/A */}
        <div className="flex-1 border-r border-border flex flex-col">
          <div className="px-6 py-3 bg-muted/30 border-b border-border">
            <div className="flex items-center gap-2">
              {getRatingIcon(currentQF.rating)}
              <Badge variant="secondary" className={cn('text-xs', getRatingColor(currentQF.rating))}>
                {currentQF.rating.replace('-', ' ')}
              </Badge>
              <span className={cn('text-lg font-bold ml-auto', getScoreColor(currentQF.score))}>
                {currentQF.score}/100
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className={cn(
              'p-6 space-y-6 transition-all duration-400',
              animatingIn ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
            )}>
              {/* Question */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Question {currentQuestionIndex + 1}
                </p>
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm leading-relaxed">{currentQF.question}</p>
                </div>
              </div>

              {/* Answer */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Answer
                </p>
                <div className="p-4 rounded-lg bg-card border border-border">
                  <p className="text-sm leading-relaxed">{currentQF.answer}</p>
                </div>
              </div>

              {/* Suggested Answer */}
              {currentQF.suggestedAnswer && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-primary" />
                    Suggested Response
                  </p>
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm leading-relaxed">{currentQF.suggestedAnswer}</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Feedback & Suggestions */}
        <div className="w-[380px] flex flex-col">
          <div className="px-6 py-3 bg-muted/30 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Feedback & Suggestions
            </p>
          </div>

          <ScrollArea className="flex-1">
            <div className={cn(
              'p-6 space-y-5 transition-all duration-400 delay-100',
              animatingIn ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
            )}>
              {/* Strengths */}
              {currentQF.strengths.length > 0 && (
                <Card className={cn('border', getRatingBg('excellent'))}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <ul className="space-y-1.5">
                      {currentQF.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-green-800 dark:text-green-300 flex items-start gap-2">
                          <span className="text-green-500 mt-0.5">+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Improvements */}
              {currentQF.improvements.length > 0 && (
                <Card className={cn('border', getRatingBg(
                  currentQF.rating === 'needs-improvement' ? 'needs-improvement' : 'good'
                ))}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Areas to Improve
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <ul className="space-y-1.5">
                      {currentQF.improvements.map((imp, i) => (
                        <li key={i} className="text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                          <span className="text-yellow-500 mt-0.5">!</span>
                          <span>{imp}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Question Navigator */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  All Questions
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {feedback.questionFeedbacks.map((qf, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToQuestion(idx)}
                      className={cn(
                        'w-full aspect-square rounded-md text-xs font-bold transition-all flex items-center justify-center border',
                        idx === currentQuestionIndex
                          ? 'bg-primary text-primary-foreground border-primary scale-110'
                          : getRatingBg(qf.rating) + ' hover:scale-105'
                      )}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between px-6 py-3 border-t border-border bg-card">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToQuestion(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0}
          className="gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </Button>

        <div className="flex items-center gap-1.5">
          {feedback.questionFeedbacks.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToQuestion(idx)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                idx === currentQuestionIndex
                  ? 'bg-primary w-6'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>

        {currentQuestionIndex < totalQuestions - 1 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToQuestion(currentQuestionIndex + 1)}
            className="gap-1.5"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="gap-1.5"
          >
            Done
            <CheckCircle2 className="w-4 h-4" />
          </Button>
        )}
      </footer>
    </div>
  );
};

export default Feedback;
