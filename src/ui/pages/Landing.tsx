import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Loader2, Terminal, ExternalLink,
  ChevronLeft, FileText, Briefcase, Check, Zap,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewType, UploadedDocument } from '../../types';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

type Step = 'initial' | 'setup' | 'selection';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { loadSettings } = useStore();
  const [step, setStep] = useState<Step>('initial');
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobPostInputRef = useRef<HTMLInputElement>(null);

  // ── System Check State ──
  const [isChecking, setIsChecking] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [lemonadeInstalled, setLemonadeInstalled] = useState<boolean | null>(null);
  const [serverRunning, setServerRunning] = useState(false);

  // ── Document Upload State ──
  const [resumeDoc, setResumeDoc] = useState<UploadedDocument | null>(null);
  const [jobPostDoc, setJobPostDoc] = useState<UploadedDocument | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJobPost, setIsUploadingJobPost] = useState(false);
  const resumeBase64Ref = useRef<string | null>(null);

  // ── Interview Setup Form ──
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    position: '',
    interviewType: 'general' as InterviewType,
  });

  const bothDocsUploaded = resumeDoc !== null && jobPostDoc !== null;
  const canBegin = bothDocsUploaded && !isChecking && lemonadeInstalled && serverRunning;
  const isFormValid = formData.title.trim() && formData.company.trim() && formData.position.trim();

  // ── Background checks ──
  useEffect(() => {
    performBackgroundChecks();
  }, []);

  const performBackgroundChecks = async () => {
    if (!window.electronAPI) {
      console.info('Running in browser mode — Electron API not available');
      setLemonadeInstalled(true);
      setServerRunning(true);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setStartError(null);
    try {
      const installation = await window.electronAPI.checkLemonadeInstallation();
      setLemonadeInstalled(installation.installed);

      if (!installation.installed) {
        setStartError(
          'Lemonade Server is not installed on this system. Download it from lemonade-server.ai to get started.'
        );
        setIsChecking(false);
        return;
      }

      const serverStatus = await window.electronAPI.getServerStatus();
      setServerRunning(serverStatus.isRunning);

      if (!serverStatus.isRunning) {
        setStartError(
          'Lemonade Server is installed but not running. Start it with: lemonade-server serve'
        );
        setIsChecking(false);
        return;
      }

      await loadSettings();
    } catch (error: any) {
      console.error('Background check failed:', error);
      setStartError(`Connection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  // ── File helpers ──
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.electronAPI) {
      setIsUploadingResume(true);
      try {
        const fileData = await fileToBase64(file);
        resumeBase64Ref.current = fileData;
        const doc = await window.electronAPI.uploadDocument({
          type: 'resume',
          fileName: file.name,
          fileData,
        });
        setResumeDoc(doc);
      } catch (error) {
        console.error('Failed to upload resume:', error);
        setStartError('Failed to upload resume. Please try again.');
      } finally {
        setIsUploadingResume(false);
      }
    } else {
      const fileData = await fileToBase64(file);
      resumeBase64Ref.current = fileData;
      setResumeDoc({
        id: 'browser-resume',
        type: 'resume',
        fileName: file.name,
        filePath: '',
        mimeType: file.type,
        fileSize: file.size,
        extractedText: '',
        uploadedAt: new Date().toISOString(),
      });
    }
    e.target.value = '';
  };

  const handleJobPostUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.electronAPI) {
      setIsUploadingJobPost(true);
      try {
        const fileData = await fileToBase64(file);
        const doc = await window.electronAPI.uploadDocument({
          type: 'job_post',
          fileName: file.name,
          fileData,
        });
        setJobPostDoc(doc);
      } catch (error) {
        console.error('Failed to upload job post:', error);
        setStartError('Failed to upload job post. Please try again.');
      } finally {
        setIsUploadingJobPost(false);
      }
    } else {
      setJobPostDoc({
        id: 'browser-jobpost',
        type: 'job_post',
        fileName: file.name,
        filePath: '',
        mimeType: file.type,
        fileSize: file.size,
        extractedText: '',
        uploadedAt: new Date().toISOString(),
      });
    }
    e.target.value = '';
  };

  // ── Step navigation ──
  const handleBeginClick = () => {
    if (!canBegin) return;
    setStartError(null);
    setStep('setup');
  };

  const handleSetupNext = () => {
    if (!isFormValid) return;
    setStep('selection');
  };

  const handleSelectionClick = (type: 'single' | 'multi') => {
    navigate('/preparing', {
      state: {
        formData,
        interviewMode: type,
        resumeDocId: resumeDoc?.id || null,
        resumeFileName: resumeDoc?.fileName || null,
        resumeBase64: resumeBase64Ref.current,
        jobPostDocId: jobPostDoc?.id || null,
        jobPostFileName: jobPostDoc?.fileName || null,
      },
    });
  };

  return (
    <div className="h-screen w-full bg-background text-foreground overflow-hidden flex flex-col items-center justify-center relative">
      {/* Hidden file inputs */}
      <input
        ref={resumeInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleResumeUpload}
      />
      <input
        ref={jobPostInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleJobPostUpload}
      />

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
          <Zap className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-widest uppercase">interviewer</h1>
        <p
          className={cn(
            'mt-3 text-sm tracking-wide text-muted-foreground transition-all duration-700',
            step !== 'initial'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          )}
        >
          {step === 'setup'
            ? 'set up your interview'
            : step === 'selection'
              ? 'choose your interview format'
              : ''}
        </p>
      </div>

      {/* ===== STEP: INITIAL ===== */}
      {step === 'initial' && (
        <div className="flex flex-col items-center">
          {/* Upload Areas */}
          <div className="flex items-center gap-5 mb-8">
            <button
              onClick={() => resumeInputRef.current?.click()}
              disabled={isUploadingResume}
              className={cn(
                'w-52 h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-1.5',
                resumeDoc
                  ? 'border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 dark:border-green-500/30'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground hover:bg-accent/30'
              )}
            >
              {isUploadingResume ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : resumeDoc ? (
                <>
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-medium truncate max-w-[180px] px-2">{resumeDoc.fileName}</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span className="text-xs font-semibold">upload resume</span>
                </>
              )}
            </button>

            <button
              onClick={() => jobPostInputRef.current?.click()}
              disabled={isUploadingJobPost}
              className={cn(
                'w-52 h-20 rounded-xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-1.5',
                jobPostDoc
                  ? 'border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 dark:border-green-500/30'
                  : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground hover:bg-accent/30'
              )}
            >
              {isUploadingJobPost ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : jobPostDoc ? (
                <>
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-medium truncate max-w-[180px] px-2">{jobPostDoc.fileName}</span>
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  <span className="text-xs font-semibold">upload job post</span>
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleBeginClick}
              disabled={!canBegin}
              size="lg"
              className="w-44 h-12 rounded-full font-semibold text-sm tracking-wide"
            >
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'begin'}
            </Button>

            <Button
              onClick={() => navigate('/dashboard')}
              variant="outline"
              size="lg"
              className="w-44 h-12 rounded-full font-semibold text-sm tracking-wide"
            >
              dashboard
            </Button>
          </div>

          {/* Upload hint */}
          {!bothDocsUploaded && !startError && !isChecking && (
            <p className="mt-5 text-xs text-muted-foreground tracking-wide">
              upload both your resume and the job post to begin
            </p>
          )}

          {/* Error */}
          {startError && (
            <Card className="mt-6 max-w-lg border-destructive/50 bg-destructive/5">
              <CardContent className="p-4 flex flex-col gap-3 text-sm">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle size={18} className="flex-shrink-0" />
                  <p>{startError}</p>
                </div>

                {lemonadeInstalled === false && (
                  <div className="ml-7 mt-1 flex flex-col gap-2">
                    <a
                      href="https://lemonade-server.ai/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors text-sm w-fit"
                    >
                      <ExternalLink size={14} />
                      Download Lemonade Server
                    </a>
                    <p className="text-xs text-muted-foreground">After installing, restart this application.</p>
                  </div>
                )}

                {lemonadeInstalled === true && !serverRunning && (
                  <div className="ml-7 mt-1 p-3 bg-card border border-border rounded-lg font-mono text-xs flex items-center gap-2">
                    <Terminal size={14} className="flex-shrink-0 text-muted-foreground" />
                    <code className="text-foreground">lemonade-server serve</code>
                  </div>
                )}

                <button
                  onClick={performBackgroundChecks}
                  className="text-xs font-bold uppercase tracking-wider hover:underline text-left ml-7 text-destructive"
                >
                  Retry Connection
                </button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ===== STEP: SETUP ===== */}
      {step === 'setup' && (
        <div className="w-full max-w-lg px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-border/50 shadow-xl">
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Senior Software Engineer Interview"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g., Tech Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="e.g., Senior Engineer"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interview Type</Label>
                <Select
                  value={formData.interviewType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, interviewType: value as InterviewType })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Interview</SelectItem>
                    <SelectItem value="technical">Technical Assessment</SelectItem>
                    <SelectItem value="behavioral">Behavioral Fit</SelectItem>
                    <SelectItem value="system-design">System Design</SelectItem>
                    <SelectItem value="coding">Live Coding</SelectItem>
                    <SelectItem value="mixed">Mixed Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Document badges */}
              <div className="pt-4 border-t border-border flex gap-2 flex-wrap">
                {resumeDoc && (
                  <Badge variant="secondary" className="gap-1.5">
                    <FileText size={12} />
                    <span className="truncate max-w-[120px]">{resumeDoc.fileName}</span>
                  </Badge>
                )}
                {jobPostDoc && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Briefcase size={12} />
                    <span className="truncate max-w-[120px]">{jobPostDoc.fileName}</span>
                  </Badge>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('initial')}
                  className="gap-2"
                >
                  <ChevronLeft size={16} />
                  Back
                </Button>
                <Button
                  onClick={handleSetupNext}
                  disabled={!isFormValid}
                  className="flex-1"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP: SELECTION ===== */}
      {step === 'selection' && (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-8 text-center">
            <p className="text-lg font-semibold">{formData.title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {formData.company} &middot; {formData.position} &middot; {formData.interviewType}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={() => handleSelectionClick('single')}
              variant="outline"
              size="lg"
              className="w-48 h-12 rounded-xl font-semibold"
            >
              one stage interview
            </Button>
            <Button
              onClick={() => handleSelectionClick('multi')}
              variant="outline"
              size="lg"
              className="w-48 h-12 rounded-xl font-semibold"
            >
              multi stage interview
            </Button>
          </div>

          <button
            onClick={() => setStep('setup')}
            className="mt-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft size={14} />
            back to details
          </button>
        </div>
      )}
    </div>
  );
};

export default Landing;
