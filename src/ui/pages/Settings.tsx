import React, { useEffect, useState } from 'react';
import { Save, Settings as SettingsIcon, Sparkles, Server } from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewerSettings, UserSettings } from '../../types';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'interviewer' | 'mcp'>('general');

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              <TabButton
                active={activeTab === 'general'}
                onClick={() => setActiveTab('general')}
                icon={<SettingsIcon size={20} />}
                label="General"
              />
              <TabButton
                active={activeTab === 'interviewer'}
                onClick={() => setActiveTab('interviewer')}
                icon={<Sparkles size={20} />}
                label="Interviewer AI"
              />
              <TabButton
                active={activeTab === 'mcp'}
                onClick={() => setActiveTab('mcp')}
                icon={<Server size={20} />}
                label="MCP Servers"
              />
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'interviewer' && <InterviewerSettingsPanel />}
            {activeTab === 'mcp' && <MCPSettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${
        active
          ? 'border-primary-600 text-primary-600 font-medium'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const GeneralSettings: React.FC = () => {
  const { settings, loadSettings } = useStore();
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

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
        <select
          value={formData.theme || 'system'}
          onChange={(e) => setFormData({ ...formData, theme: e.target.value as any })}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
        <select
          value={formData.language || 'en'}
          onChange={(e) => setFormData({ ...formData, language: e.target.value })}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="notifications"
          checked={formData.notifications ?? true}
          onChange={(e) => setFormData({ ...formData, notifications: e.target.checked })}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="notifications" className="ml-2 text-sm text-gray-700">
          Enable notifications
        </label>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="autoSave"
          checked={formData.autoSave ?? true}
          onChange={(e) => setFormData({ ...formData, autoSave: e.target.checked })}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="autoSave" className="ml-2 text-sm text-gray-700">
          Auto-save interviews
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Default Interview Duration (seconds)
        </label>
        <input
          type="number"
          value={formData.defaultInterviewDuration || 3600}
          onChange={(e) =>
            setFormData({ ...formData, defaultInterviewDuration: parseInt(e.target.value) })
          }
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        <Save size={20} />
        {saved ? 'Saved!' : 'Save Changes'}
      </button>
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
      {/* Lemonade Server Status */}
      <div className={`border rounded-lg p-4 ${
        serverStatus.isRunning
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              serverStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`} />
            <strong className={
              serverStatus.isRunning ? 'text-green-900' : 'text-yellow-900'
            }>
              Lemonade Server Status
            </strong>
          </div>
          <button
            onClick={checkServerStatus}
            className="text-sm px-3 py-1 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>
        <p className={`text-sm ${
          serverStatus.isRunning ? 'text-green-800' : 'text-yellow-800'
        }`}>
          {serverStatus.isRunning ? (
            <>
              ✓ Connected to Lemonade Server at {serverStatus.url}
            </>
          ) : (
            <>
              ⚠ Lemonade Server is not running. Please start Lemonade Server at {serverStatus.url}
              <br />
              <a
                href="https://lemonade-server.ai/docs/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View Installation Guide →
              </a>
            </>
          )}
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This application uses <strong>Lemonade Server</strong> - a local LLM server running on your machine. 
          All AI processing happens locally on your NPU/GPU, ensuring privacy and no API costs.
        </p>
      </div>

      {/* Model Selection */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Select Model from Lemonade Server
          </label>
          <button
            onClick={refreshModels}
            disabled={loadingModels || !serverStatus.isRunning}
            className="text-sm px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loadingModels ? 'Loading...' : 'Refresh Models'}
          </button>
        </div>
        <select
          value={formData.modelName || ''}
          onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          disabled={!serverStatus.isRunning}
        >
          <option value="">Select a model...</option>
          {availableModels.length > 0 ? (
            availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))
          ) : (
            <>
              <option value="Llama-3.2-1B-Instruct-Hybrid">Llama 3.2 1B Instruct (Hybrid)</option>
              <option value="Llama-3.2-3B-Instruct-Hybrid">Llama 3.2 3B Instruct (Hybrid)</option>
              <option value="Phi-3.5-mini-instruct-Hybrid">Phi 3.5 Mini Instruct (Hybrid)</option>
            </>
          )}
        </select>
        {!serverStatus.isRunning && (
          <p className="text-xs text-gray-500 mt-1">
            Start Lemonade Server to see available models
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Interview Style
        </label>
        <select
          value={formData.interviewStyle || 'conversational'}
          onChange={(e) => setFormData({ ...formData, interviewStyle: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="conversational">Conversational</option>
          <option value="formal">Formal</option>
          <option value="challenging">Challenging</option>
          <option value="supportive">Supportive</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Question Difficulty
        </label>
        <select
          value={formData.questionDifficulty || 'medium'}
          onChange={(e) =>
            setFormData({ ...formData, questionDifficulty: e.target.value as any })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Number of Questions
        </label>
        <input
          type="number"
          value={formData.numberOfQuestions || 10}
          onChange={(e) =>
            setFormData({ ...formData, numberOfQuestions: parseInt(e.target.value) })
          }
          min="1"
          max="50"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Temperature (0.0 - 1.0)
        </label>
        <input
          type="number"
          value={formData.temperature || 0.7}
          onChange={(e) =>
            setFormData({ ...formData, temperature: parseFloat(e.target.value) })
          }
          min="0"
          max="1"
          step="0.1"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Lower values make responses more focused, higher values more creative
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
        <input
          type="number"
          value={formData.maxTokens || 2000}
          onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
          min="100"
          max="8000"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="followUps"
          checked={formData.includeFollowUps ?? true}
          onChange={(e) => setFormData({ ...formData, includeFollowUps: e.target.checked })}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="followUps" className="ml-2 text-sm text-gray-700">
          Include follow-up questions
        </label>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="feedback"
          checked={formData.provideFeedback ?? true}
          onChange={(e) => setFormData({ ...formData, provideFeedback: e.target.checked })}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor="feedback" className="ml-2 text-sm text-gray-700">
          Provide feedback at end of interview
        </label>
      </div>

      <button
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        <Save size={20} />
        {saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  );
};

const MCPSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>MCP (Model Context Protocol) Servers:</strong> Configure external tools and
          services that can extend the interviewer's capabilities. This is an advanced feature.
        </p>
      </div>

      <div className="text-center py-12">
        <Server size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">MCP server configuration coming soon.</p>
        <p className="text-sm text-gray-500 mt-2">
          This feature will allow you to connect external tools and services to enhance the
          interview experience.
        </p>
      </div>
    </div>
  );
};

export default Settings;
