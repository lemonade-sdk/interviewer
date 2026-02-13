import React, { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, Sparkles, Moon, Sun, Monitor } from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewerSettings, UserSettings } from '../../types';
import { SystemInfoPanel } from '../components/SystemInfoPanel';
import { MultiModelStatus } from '../components/MultiModelStatus';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Slider } from '../components/ui/slider';
import { cn } from '../lib/utils';

const Settings: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure your interview experience</p>
        </div>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general" className="gap-1.5">
              <SettingsIcon size={14} />
              General
            </TabsTrigger>
            <TabsTrigger value="interviewer" className="gap-1.5">
              <Sparkles size={14} />
              Interviewer AI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="interviewer" className="mt-6">
            <InterviewerSettingsPanel />
          </TabsContent>
        </Tabs>
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
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'System', icon: Monitor },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => handleThemeChange(value)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all',
                    formData.theme === value
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Language</Label>
            <Select
              value={formData.language || 'en'}
              onValueChange={(v) => setFormData({ ...formData, language: v })}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Interview Timer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Interview Timer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Duration (minutes)</Label>
            <Input
              type="number"
              value={formData.defaultInterviewDuration || 30}
              onChange={(e) =>
                setFormData({ ...formData, defaultInterviewDuration: parseInt(e.target.value) })
              }
              min={5}
              max={120}
              className="w-full max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              The interview timer will count down from this duration. The AI will adjust its behavior as time runs low.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Receive interview reminders</p>
            </div>
            <Switch
              checked={formData.notifications ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, notifications: checked })}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-save</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Automatically save interview transcripts</p>
            </div>
            <Switch
              checked={formData.autoSave ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, autoSave: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="gap-2">
        <Save size={16} />
        {saved ? 'Saved!' : 'Save Changes'}
      </Button>
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
    <div className="space-y-6">
      {/* Multi-Model Status */}
      <MultiModelStatus />

      {/* System Information */}
      <SystemInfoPanel />

      {/* Server Status */}
      <Card className={cn(
        'border',
        serverStatus.isRunning
          ? 'border-green-200 dark:border-green-800'
          : 'border-yellow-200 dark:border-yellow-800'
      )}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2.5 h-2.5 rounded-full',
                serverStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
              )} />
              <span className="text-sm font-semibold">Lemonade Server</span>
            </div>
            <Button variant="outline" size="xs" onClick={checkServerStatus}>Refresh</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {serverStatus.isRunning
              ? `Connected at ${serverStatus.url}`
              : 'Not running — start with: lemonade-server serve'}
          </p>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> This application uses <strong>Lemonade Server</strong> — a local LLM server. 
            All AI processing happens locally on your NPU/GPU, ensuring privacy and no API costs.
          </p>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Model</CardTitle>
            <Button
              variant="outline"
              size="xs"
              onClick={refreshModels}
              disabled={loadingModels || !serverStatus.isRunning}
            >
              {loadingModels ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Select
            value={formData.modelName || ''}
            onValueChange={(v) => setFormData({ ...formData, modelName: v })}
            disabled={!serverStatus.isRunning}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {availableModels.length > 0 ? (
                availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="Llama-3.2-1B-Instruct-Hybrid">Llama 3.2 1B Instruct (Hybrid)</SelectItem>
                  <SelectItem value="Llama-3.2-3B-Instruct-Hybrid">Llama 3.2 3B Instruct (Hybrid)</SelectItem>
                  <SelectItem value="Phi-3.5-mini-instruct-Hybrid">Phi 3.5 Mini Instruct (Hybrid)</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          {!serverStatus.isRunning && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Start Lemonade Server to see available models
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">AI Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Number of Questions</Label>
            <Input
              type="number"
              value={formData.numberOfQuestions || 10}
              onChange={(e) =>
                setFormData({ ...formData, numberOfQuestions: parseInt(e.target.value) })
              }
              min={1}
              max={50}
              className="max-w-xs"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <Badge variant="secondary" className="text-xs font-mono">
                {formData.temperature?.toFixed(1) || '0.7'}
              </Badge>
            </div>
            <Slider
              value={[formData.temperature || 0.7]}
              onValueChange={([v]) => setFormData({ ...formData, temperature: v })}
              min={0}
              max={1}
              step={0.1}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Lower = more focused, Higher = more creative
            </p>
          </div>

          <div className="space-y-2">
            <Label>Max Tokens</Label>
            <Input
              type="number"
              value={formData.maxTokens || 2000}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              min={100}
              max={8000}
              className="max-w-xs"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Follow-up Questions</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Allow the AI to probe deeper based on responses</p>
            </div>
            <Switch
              checked={formData.includeFollowUps ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, includeFollowUps: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>End-of-Interview Feedback</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Generate performance feedback when interview ends</p>
            </div>
            <Switch
              checked={formData.provideFeedback ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, provideFeedback: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Interview style and question difficulty are now configured during the interview preparation phase.
      </p>

      <Button onClick={handleSave} className="gap-2">
        <Save size={16} />
        {saved ? 'Saved!' : 'Save Changes'}
      </Button>
    </div>
  );
};

export default Settings;
