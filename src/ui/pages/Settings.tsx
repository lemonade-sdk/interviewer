import React, { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, Sparkles, Moon, Sun, Monitor, Clock, Bell, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewerSettings, UserSettings } from '../../types';
import { SystemInfoPanel } from '../components/SystemInfoPanel';
import { MultiModelStatus } from '../components/MultiModelStatus';
import { LemonTabs, LemonSwitch, LemonSelect, LemonSlider, LemonCard, LemonBadge } from '../components/lemon';
import { cn } from '@ui/lib';

const Settings: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto transition-colors duration-300">
      <div className="p-12 max-w-4xl mx-auto space-y-10 pb-20">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-[#cfcfcf]">Settings</h1>
          <p className="text-base text-gray-500 dark:text-white/40 mt-3">
            Configure your interview experience.
          </p>
        </div>

        <LemonTabs
          defaultValue="general"
          contentClassName="mt-8"
          tabs={[
            {
              value: 'general',
              label: <div className="flex items-center gap-2"><SettingsIcon size={20} /> General</div>,
              content: <GeneralSettings />,
            },
            {
              value: 'interviewer',
              label: <div className="flex items-center gap-2"><Sparkles size={20} /> Interviewer AI</div>,
              content: <InterviewerSettingsPanel />,
            },
          ]}
        />
      </div>
    </div>
  );
};

const GeneralSettings: React.FC = () => {
  const { settings, loadSettings, setTheme } = useStore();
  const [formData, setFormData] = useState<Partial<UserSettings>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await window.electronAPI.updateSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setFormData({ ...formData, theme });
    setTheme(theme);
  };

  return (
    <div className="space-y-8">
      {/* Theme */}
      <LemonCard title="Appearance" subtitle="Choose how the app looks and feels.">
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Theme</label>
            <div className="grid grid-cols-3 gap-4">
              {([
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    "flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all duration-200",
                    formData.theme === value
                      ? "border-lemonade-accent bg-lemonade-accent/5"
                      : "border-gray-200/60 dark:border-white/[0.08] hover:border-lemonade-accent/40"
                  )}
                >
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
                    formData.theme === value ? "bg-lemonade-accent text-black" : "bg-gray-100 dark:bg-white/[0.06] text-gray-400"
                  )}>
                    <Icon size={22} />
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    formData.theme === value ? "text-black dark:text-white" : "text-gray-500 dark:text-white/40"
                  )}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Language</label>
            <LemonSelect
              value={formData.language || 'en'}
              onChange={(v) => setFormData({ ...formData, language: v })}
              className="w-full max-w-xs"
              options={[
                { value: 'en', label: 'English (US)' },
                { value: 'es', label: 'Español' },
                { value: 'fr', label: 'Français' },
                { value: 'de', label: 'Deutsch' },
              ]}
            />
          </div>
        </div>
      </LemonCard>

      {/* Interview Timer */}
      <LemonCard title="Interview Timer" subtitle="Set default session duration.">
        <div className="space-y-4">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-lemonade-accent/10 flex items-center justify-center text-lemonade-accent-hover">
              <Clock size={24} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Default Duration</label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="number"
                  value={formData.defaultInterviewDuration || 30}
                  onChange={(e) =>
                    setFormData({ ...formData, defaultInterviewDuration: parseInt(e.target.value) })
                  }
                  min={5}
                  max={120}
                  className="w-24 px-4 py-2.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/10 rounded-xl text-base font-semibold focus:border-lemonade-accent outline-none transition-all"
                />
                <span className="text-base text-gray-500 dark:text-white/40">minutes</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-white/40 leading-relaxed">
            The AI adjusts its pacing as time runs low for a natural close.
          </p>
        </div>
      </LemonCard>

      {/* Preferences */}
      <LemonCard title="Preferences" subtitle="Notifications and data options." noPadding>
        <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Bell size={22} />
              </div>
              <div>
                <p className="text-base font-medium text-gray-900 dark:text-white/90">Notifications</p>
                <p className="text-sm text-gray-500 dark:text-white/40">Receive interview reminders</p>
              </div>
            </div>
            <LemonSwitch
              checked={formData.notifications ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, notifications: checked })}
            />
          </div>
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                <ShieldCheck size={22} />
              </div>
              <div>
                <p className="text-base font-medium text-gray-900 dark:text-white/90">Auto-save</p>
                <p className="text-sm text-gray-500 dark:text-white/40">Save transcripts automatically</p>
              </div>
            </div>
            <LemonSwitch
              checked={formData.autoSave ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, autoSave: checked })}
            />
          </div>
        </div>
      </LemonCard>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-3 px-6 py-3.5 bg-lemonade-accent text-black font-semibold text-base rounded-xl hover:bg-lemonade-accent-hover transition-colors duration-200 active:scale-[0.98]"
        >
          <Save size={20} />
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
};

const InterviewerSettingsPanel: React.FC = () => {
  const { interviewerSettings, loadInterviewerSettings } = useStore();
  const [formData, setFormData] = useState<Partial<InterviewerSettings>>({});
  const [saved, setSaved] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ isRunning: boolean; url: string }>({
    isRunning: false,
    url: 'http://localhost:8000',
  });
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    loadInterviewerSettings();
    checkServerStatus();
    loadModels();
  }, []);

  useEffect(() => {
    if (interviewerSettings) {
      setFormData(interviewerSettings);
    }
  }, [interviewerSettings]);

  const checkServerStatus = async () => {
    try {
      const status = await window.electronAPI.getServerStatus();
      setServerStatus(status);
    } catch (error) {
      console.error('Failed to check server status:', error);
    }
  };

  const loadModels = async () => {
    try {
      setLoadingModels(true);
      const models = await window.electronAPI.getAvailableModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const refreshModels = async () => {
    try {
      setLoadingModels(true);
      const models = await window.electronAPI.refreshModels();
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to refresh models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = async () => {
    try {
      await window.electronAPI.updateInterviewerSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      loadInterviewerSettings();
    } catch (error) {
      console.error('Failed to save interviewer settings:', error);
    }
  };

  return (
    <div className="space-y-8">
      <MultiModelStatus />
      <SystemInfoPanel />

      {/* Server Status */}
      <LemonCard
        className={cn(
          serverStatus.isRunning ? 'border-green-200 dark:border-green-500/15' : 'border-yellow-200 dark:border-yellow-500/15'
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              serverStatus.isRunning ? "bg-green-500/10 text-green-600" : "bg-yellow-500/10 text-yellow-600"
            )}>
              <Activity size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-gray-900 dark:text-white/90">Lemonade Server</span>
                <LemonBadge variant={serverStatus.isRunning ? 'success' : 'warning'} className="shrink-0">
                  {serverStatus.isRunning ? 'Online' : 'Offline'}
                </LemonBadge>
              </div>
              <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
                {serverStatus.isRunning ? `Connected at ${serverStatus.url}` : 'Not running — start with: lemonade-server serve'}
              </p>
            </div>
          </div>
          <button
            onClick={checkServerStatus}
            className="p-3 rounded-xl border border-gray-200/60 dark:border-white/10 hover:bg-lemonade-bg dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={20} className="text-gray-400" />
          </button>
        </div>
      </LemonCard>

      {/* Info card */}
      <div className="border border-lemonade-accent/20 bg-lemonade-accent/5 rounded-2xl p-6">
        <p className="text-sm text-gray-600 dark:text-white/50 leading-relaxed">
          <strong>Note:</strong> This application uses <strong>Lemonade Server</strong> for local LLM inference.
          All AI processing stays on your device — no API costs or data sent externally.
        </p>
      </div>

      {/* Model Selection */}
      <LemonCard
        title="Models"
        subtitle="Select the LLMs that power your interviewer and extraction processes."
        headerAction={
          <button
            onClick={refreshModels}
            disabled={loadingModels || !serverStatus.isRunning}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200/60 dark:border-white/[0.08] rounded-xl hover:bg-lemonade-bg dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={18} className={cn(loadingModels && "animate-spin")} />
            Refresh
          </button>
        }
      >
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Interview Model</label>
            <LemonSelect
              value={formData.modelName || ''}
              onChange={(v) => setFormData({ ...formData, modelName: v })}
              disabled={!serverStatus.isRunning}
              placeholder="Select a model..."
              options={
                availableModels.length > 0
                  ? availableModels.map((model) => ({ value: model.id, label: model.name }))
                  : [
                      { value: 'gpt-oss-mxp4', label: 'GPT-OSS MXP4' },
                      { value: 'Llama-3.2-1B-Instruct-Hybrid', label: 'Llama 3.2 1B Instruct (Hybrid)' },
                      { value: 'Llama-3.2-3B-Instruct-Hybrid', label: 'Llama 3.2 3B Instruct (Hybrid)' },
                      { value: 'Phi-3.5-mini-instruct-Hybrid', label: 'Phi 3.5 Mini Instruct (Hybrid)' },
                    ]
              }
            />
            <p className="text-sm text-gray-500 dark:text-white/40">
              Used for generating the interviewer's responses.
            </p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Extraction Model</label>
            <LemonSelect
              value={formData.extractionModelName || formData.modelName || ''}
              onChange={(v) => setFormData({ ...formData, extractionModelName: v })}
              disabled={!serverStatus.isRunning}
              placeholder="Select a model..."
              options={
                availableModels.length > 0
                  ? availableModels.map((model) => ({ value: model.id, label: model.name }))
                  : [
                      { value: 'gpt-oss-mxp4', label: 'GPT-OSS MXP4' },
                      { value: 'Llama-3.2-1B-Instruct-Hybrid', label: 'Llama 3.2 1B Instruct (Hybrid)' },
                      { value: 'Llama-3.2-3B-Instruct-Hybrid', label: 'Llama 3.2 3B Instruct (Hybrid)' },
                      { value: 'Phi-3.5-mini-instruct-Hybrid', label: 'Phi 3.5 Mini Instruct (Hybrid)' },
                    ]
              }
            />
            <p className="text-sm text-gray-500 dark:text-white/40">
              Used for structured data extraction (e.g., feedback, persona generation).
            </p>
          </div>

          {!serverStatus.isRunning && (
            <p className="text-sm text-gray-500 dark:text-white/40">
              Start Lemonade Server to see available models.
            </p>
          )}
        </div>
      </LemonCard>

      {/* AI Parameters */}
      <LemonCard title="AI Parameters" subtitle="Fine-tune behavior and creativity.">
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Number of Questions</label>
            <input
              type="number"
              value={formData.numberOfQuestions || 10}
              onChange={(e) =>
                setFormData({ ...formData, numberOfQuestions: parseInt(e.target.value) })
              }
              min={1}
              max={50}
              className="w-28 px-4 py-2.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/10 rounded-xl text-base font-semibold focus:border-lemonade-accent outline-none transition-all"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Temperature</label>
              <span className="text-sm font-semibold text-lemonade-accent-hover bg-lemonade-accent/10 px-3 py-1 rounded">
                {formData.temperature?.toFixed(1) || '0.7'}
              </span>
            </div>
            <LemonSlider
              value={formData.temperature || 0.7}
              onChange={(v) => setFormData({ ...formData, temperature: v })}
              min={0}
              max={1}
              step={0.1}
              className="max-w-xs"
            />
            <div className="flex justify-between max-w-xs text-sm text-gray-400 dark:text-white/30">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider">Max Tokens</label>
            <input
              type="number"
              value={formData.maxTokens || 2000}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              min={100}
              max={8000}
              className="w-32 px-4 py-2.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/10 rounded-xl text-base font-semibold focus:border-lemonade-accent outline-none transition-all"
            />
          </div>

          <div className="pt-6 border-t border-gray-100/60 dark:border-white/[0.04] space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-medium text-gray-900 dark:text-white/90">Follow-up Questions</p>
                <p className="text-sm text-gray-500 dark:text-white/40">Allow the AI to probe deeper</p>
              </div>
              <LemonSwitch
                checked={formData.includeFollowUps ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, includeFollowUps: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-medium text-gray-900 dark:text-white/90">Performance Feedback</p>
                <p className="text-sm text-gray-500 dark:text-white/40">Generate feedback after the interview ends</p>
              </div>
              <LemonSwitch
                checked={formData.provideFeedback ?? true}
                onCheckedChange={(checked) => setFormData({ ...formData, provideFeedback: checked })}
              />
            </div>
          </div>
        </div>
      </LemonCard>

      <p className="text-sm text-gray-500 dark:text-white/40">
        Interview style and question difficulty are configured during the preparation phase.
      </p>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-3 px-6 py-3.5 bg-lemonade-accent text-black font-semibold text-base rounded-xl hover:bg-lemonade-accent-hover transition-colors duration-200 active:scale-[0.98]"
        >
          <Save size={20} />
          {saved ? 'Saved!' : 'Save AI Settings'}
        </button>
      </div>
    </div>
  );
};

export default Settings;
