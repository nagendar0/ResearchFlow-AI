-- schema.sql
-- Run this in your Supabase SQL Editor to set up the database tables

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle', -- idle, planning, discovering, extracting, validating, synthesizing, complete, failed
  audience TEXT DEFAULT 'General',
  depth TEXT DEFAULT 'Standard',
  source_policy TEXT DEFAULT 'Default',
  category TEXT DEFAULT 'generalist',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- SOURCES TABLE (Connected to a project)
CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url TEXT,
  title TEXT NOT NULL,
  publisher TEXT,
  type TEXT DEFAULT 'web', -- paper, report, gov, web, user_pdf
  published_at TEXT,
  accessed_at TEXT,
  rank INTEGER,
  quality_score NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- EVIDENCE CHUNKS TABLE (Connected to a source)
CREATE TABLE IF NOT EXISTS evidence_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  locator TEXT, -- page number, section, paragraph index
  support_label TEXT DEFAULT 'Supported', -- Strongly supported, Supported, Limited evidence, Conflicting evidence
  quality_signals JSONB, -- recency, relevance, extraction quality, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- REPORTS TABLE (Connected to a project)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  markdown TEXT NOT NULL,
  executive_takeaway TEXT,
  evidence_count INTEGER DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- EXPLAIN MESSAGES TABLE (For Q&A session history)
CREATE TABLE IF NOT EXISTS explain_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  source_state TEXT DEFAULT 'From report', -- 'From report' or 'Additional verified information'
  citations JSONB DEFAULT '[]'::jsonb, -- Array of source chunk ids/locators
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Keep all workspace data private until user-specific access policies are added.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE explain_messages ENABLE ROW LEVEL SECURITY;
