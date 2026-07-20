import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Define TS Interfaces
export interface Project {
  id: string;
  title: string;
  question: string;
  status: string;
  audience?: string;
  depth?: string;
  source_policy?: string;
  category?: string;
  created_at: string;
}

export interface Source {
  id: string;
  project_id: string;
  url?: string;
  title: string;
  publisher?: string;
  type: 'paper' | 'report' | 'gov' | 'web' | 'user_pdf';
  published_at?: string;
  accessed_at?: string;
  rank?: number;
  quality_score?: number;
}

export interface EvidenceChunk {
  id: string;
  source_id: string;
  project_id: string;
  text: string;
  locator?: string;
  support_label?: 'High-quality evidence' | 'Supporting evidence' | 'Limited evidence' | 'Conflicting evidence' | 'No evidence found' | 'Strongly supported' | 'Supported';
  quality_signals?: any;
  title?: string;
  section?: string;
  chapter?: string;
  keywords?: string[];
  summary?: string;
}

export interface Report {
  id: string;
  project_id: string;
  markdown: string;
  executive_takeaway?: string;
  evidence_count?: number;
  source_count?: number;
  created_at: string;
}

export interface ExplainMessage {
  id: string;
  project_id: string;
  question: string;
  answer: string;
  source_state: string;
  citations: any[];
  created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && supabaseUrl !== 'your_supabase_url';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// JSON Local Fallback Database implementation
const LOCAL_DB_FILE = path.join(process.cwd(), 'projects_db.json');

interface LocalDB {
  projects: Project[];
  sources: Source[];
  evidence_chunks: EvidenceChunk[];
  reports: Report[];
  explain_messages: ExplainMessage[];
}

function initLocalDB(): LocalDB {
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      const data = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      console.error('Error reading local DB, resetting:', e);
    }
  }
  const defaultDB: LocalDB = {
    projects: [],
    sources: [],
    evidence_chunks: [],
    reports: [],
    explain_messages: [],
  };
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(defaultDB, null, 2));
  return defaultDB;
}

function saveLocalDB(db: LocalDB) {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2));
}

// DATABASE LAYER OPERATIONS

export async function createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
  const newProject: Project = {
    ...project,
    id: Math.random().toString(36).substring(2, 11),
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single();
    if (!error && data) return data as Project;
    console.error('Supabase createProject failed, using fallback:', error);
  }

  // Fallback
  const db = initLocalDB();
  db.projects.push(newProject);
  saveLocalDB(db);
  return newProject;
}

export async function getProject(id: string): Promise<Project | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) return data as Project;
  }

  const db = initLocalDB();
  return db.projects.find((p) => p.id === id) || null;
}

export async function listProjects(): Promise<Project[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) return data as Project[];
  }

  const db = initLocalDB();
  return [...db.projects].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function updateProjectStatus(id: string, status: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from('projects')
      .update({ status })
      .eq('id', id);
    if (!error) return;
  }

  const db = initLocalDB();
  const proj = db.projects.find((p) => p.id === id);
  if (proj) {
    proj.status = status;
    saveLocalDB(db);
  }
}

export async function addSources(projectId: string, sources: Omit<Source, 'id'>[]): Promise<Source[]> {
  const newSources: Source[] = sources.map((s) => ({
    ...s,
    id: Math.random().toString(36).substring(2, 11),
  }));

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('sources')
      .insert(sources.map((s) => ({ ...s, project_id: projectId })))
      .select();
    if (!error && data) return data as Source[];
    console.error('Supabase addSources failed, using fallback:', error);
  }

  const db = initLocalDB();
  db.sources.push(...newSources);
  saveLocalDB(db);
  return newSources;
}

export async function getProjectSources(projectId: string): Promise<Source[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('project_id', projectId);
    if (!error && data) return data as Source[];
  }

  const db = initLocalDB();
  return db.sources.filter((s) => s.project_id === projectId);
}

export async function addEvidenceChunks(projectId: string, chunks: Omit<EvidenceChunk, 'id'>[]): Promise<EvidenceChunk[]> {
  const newChunks: EvidenceChunk[] = chunks.map((c) => ({
    ...c,
    id: Math.random().toString(36).substring(2, 11),
  }));

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('evidence_chunks')
      .insert(chunks.map((c) => ({ ...c, project_id: projectId })))
      .select();
    if (!error && data) return data as EvidenceChunk[];
    console.error('Supabase addEvidenceChunks failed, using fallback:', error);
  }

  const db = initLocalDB();
  db.evidence_chunks.push(...newChunks);
  saveLocalDB(db);
  return newChunks;
}

export async function getProjectEvidenceChunks(projectId: string): Promise<EvidenceChunk[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('evidence_chunks')
      .select('*')
      .eq('project_id', projectId);
    if (!error && data) return data as EvidenceChunk[];
  }

  const db = initLocalDB();
  return db.evidence_chunks.filter((c) => c.project_id === projectId);
}

export async function saveReport(projectId: string, report: Omit<Report, 'id' | 'created_at'>): Promise<Report> {
  const newReport: Report = {
    ...report,
    id: Math.random().toString(36).substring(2, 11),
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('reports')
      .insert([{ ...report, project_id: projectId }])
      .select()
      .single();
    if (!error && data) return data as Report;
    console.error('Supabase saveReport failed, using fallback:', error);
  }

  const db = initLocalDB();
  // Remove existing report for project if any
  db.reports = db.reports.filter((r) => r.project_id !== projectId);
  db.reports.push(newReport);
  saveLocalDB(db);
  return newReport;
}

export async function getProjectReport(projectId: string): Promise<Report | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('project_id', projectId)
      .single();
    if (!error && data) return data as Report;
  }

  const db = initLocalDB();
  return db.reports.find((r) => r.project_id === projectId) || null;
}

export async function addExplainMessage(projectId: string, message: { question: string; answer: string; source_state: string; citations: any[] }): Promise<ExplainMessage> {
  const newMessage: ExplainMessage = {
    ...message,
    id: Math.random().toString(36).substring(2, 11),
    project_id: projectId,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('explain_messages')
      .insert([{ ...message, project_id: projectId }])
      .select()
      .single();
    if (!error && data) return data as ExplainMessage;
  }

  const db = initLocalDB();
  db.explain_messages.push(newMessage);
  saveLocalDB(db);
  return newMessage;
}

export async function getProjectExplainMessages(projectId: string): Promise<ExplainMessage[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('explain_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (!error && data) return data as ExplainMessage[];
  }

  const db = initLocalDB();
  return db.explain_messages.filter((m) => m.project_id === projectId);
}
