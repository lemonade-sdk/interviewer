-- AI Interviewer Database Schema

-- Interviews table
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  interview_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration INTEGER,
  transcript TEXT NOT NULL, -- JSON array of messages
  feedback TEXT, -- JSON object
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  applied_at TEXT,
  interview_ids TEXT NOT NULL, -- JSON array of interview IDs
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  theme TEXT NOT NULL DEFAULT 'system',
  language TEXT NOT NULL DEFAULT 'en',
  notifications INTEGER NOT NULL DEFAULT 1,
  auto_save INTEGER NOT NULL DEFAULT 1,
  default_interview_duration INTEGER NOT NULL DEFAULT 3600,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Interviewer settings table
CREATE TABLE IF NOT EXISTS interviewer_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Single row table
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  temperature REAL NOT NULL DEFAULT 0.7,
  max_tokens INTEGER NOT NULL DEFAULT 2000,
  interview_style TEXT NOT NULL DEFAULT 'conversational',
  question_difficulty TEXT NOT NULL DEFAULT 'medium',
  number_of_questions INTEGER NOT NULL DEFAULT 10,
  include_follow_ups INTEGER NOT NULL DEFAULT 1,
  provide_feedback INTEGER NOT NULL DEFAULT 1,
  -- Voice settings (integrated from ALTER statements)
  voice_mode INTEGER NOT NULL DEFAULT 0,
  asr_model TEXT,
  tts_voice TEXT,
  vad_sensitivity REAL NOT NULL DEFAULT 0.7,
  auto_play_tts INTEGER NOT NULL DEFAULT 1,
  recording_quality TEXT NOT NULL DEFAULT 'medium',
  active_persona_id TEXT,
  updated_at TEXT NOT NULL
);

-- Model configurations table
CREATE TABLE IF NOT EXISTS model_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  api_key TEXT,
  endpoint TEXT,
  max_tokens INTEGER NOT NULL,
  temperature REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- MCP servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT NOT NULL, -- JSON array
  env TEXT, -- JSON object
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_created_at ON interviews(created_at);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- Agent personas table
CREATE TABLE IF NOT EXISTS agent_personas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  interview_style TEXT NOT NULL DEFAULT 'conversational',
  question_difficulty TEXT NOT NULL DEFAULT 'medium',
  tts_voice TEXT,
  avatar_url TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Audio recordings table (for tracking audio files)
CREATE TABLE IF NOT EXISTS audio_recordings (
  id TEXT PRIMARY KEY,
  interview_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'user_audio', 'tts_audio', 'asr_transcript'
  duration REAL, -- in seconds
  file_size INTEGER, -- in bytes
  asr_transcript TEXT,
  vad_metadata TEXT, -- JSON string
  created_at TEXT NOT NULL,
  FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE
);

-- Audio settings table
CREATE TABLE IF NOT EXISTS audio_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Single row table
  input_device_id TEXT,
  output_device_id TEXT,
  input_volume INTEGER NOT NULL DEFAULT 80,
  output_volume INTEGER NOT NULL DEFAULT 80,
  echo_cancellation INTEGER NOT NULL DEFAULT 1,
  noise_suppression INTEGER NOT NULL DEFAULT 1,
  auto_gain_control INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- Indexes for audio recordings
CREATE INDEX IF NOT EXISTS idx_audio_recordings_interview ON audio_recordings(interview_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_message ON audio_recordings(message_id);
CREATE INDEX IF NOT EXISTS idx_personas_default ON agent_personas(is_default);

-- Insert default settings
INSERT OR IGNORE INTO user_settings (user_id, created_at, updated_at) 
VALUES ('default', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO interviewer_settings (
  id, model_provider, model_name, updated_at
) VALUES (
  1, 'lemonade-server', 'Llama-3.2-1B-Instruct-Hybrid', datetime('now')
);

INSERT OR IGNORE INTO audio_settings (id, updated_at)
VALUES (1, datetime('now'));

-- Insert default agent personas
INSERT OR IGNORE INTO agent_personas (
  id, name, description, system_prompt, interview_style, 
  question_difficulty, is_default, created_at, updated_at
) VALUES (
  'default-professional',
  'Professional Interviewer',
  'A balanced, professional interviewer focusing on practical skills and experience.',
  'You are a professional interviewer conducting a structured interview. Be respectful, ask clear questions, and evaluate responses fairly. Focus on the candidate''s experience and problem-solving abilities.',
  'conversational',
  'medium',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO agent_personas (
  id, name, description, system_prompt, interview_style,
  question_difficulty, is_default, created_at, updated_at
) VALUES (
  'senior-tech-lead',
  'Senior Tech Lead',
  'An experienced technical interviewer who dives deep into system design and architecture.',
  'You are a senior technical lead interviewing for a technical position. Ask in-depth questions about system design, architecture decisions, scalability, and best practices. Challenge the candidate to think critically.',
  'challenging',
  'hard',
  0,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO agent_personas (
  id, name, description, system_prompt, interview_style,
  question_difficulty, is_default, created_at, updated_at
) VALUES (
  'friendly-mentor',
  'Friendly Mentor',
  'A supportive interviewer who helps candidates perform their best.',
  'You are a friendly, supportive interviewer who wants to help the candidate succeed. Ask encouraging questions, provide helpful hints when needed, and create a comfortable environment. Focus on understanding the candidate''s potential.',
  'supportive',
  'easy',
  0,
  datetime('now'),
  datetime('now')
);
