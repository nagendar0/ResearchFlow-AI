export interface LocalProject {
  id: string;
  title: string;
  question: string;
  category: string;
  audience: string;
  depth: string;
  source_policy: string;
  status: 'idle' | 'planning' | 'discovering' | 'extracting' | 'validating' | 'synthesizing' | 'complete' | 'failed';
  created_at: string;
  archived?: boolean;
}

export interface LocalSource {
  id: string;
  project_id: string;
  title: string;
  url: string;
  publisher: string;
  type: 'web' | 'paper' | 'report' | 'gov';
  published_at: string;
  accessed_at: string;
  rank: number;
  quality_score: number;
}

export interface LocalEvidenceChunk {
  id: string;
  project_id: string;
  source_id: string;
  text: string;
  locator: string;
  support_label: 'Strongly supported' | 'Supported' | 'Limited evidence' | 'Conflicting evidence';
  quality_signals: {
    relevance: number;
    recency: string;
    credibility: string;
  };
}

export interface LocalReport {
  id: string;
  project_id: string;
  markdown: string;
  executive_takeaway: string;
  source_count: number;
  evidence_count: number;
  created_at: string;
}

import { invoke } from '@tauri-apps/api/core';

export interface LocalExplainMessage {
  id: string;
  project_id: string;
  question: string;
  answer: string;
  source_state: string;
  citations: any[];
  created_at: string;
}

export interface LocalCacheEntry {
  key: string; // e.g. "category:query"
  query: string;
  category: string;
  sources: any[];
  evidence: any[];
  report: any;
  created_at: string;
  expiry_time: string;
}

// ----------------------------------------------------
// TAURI CHECK AND FS WRAPPERS
// ----------------------------------------------------
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function invokeTauri<T = string>(cmd: string, args: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

// ----------------------------------------------------
// INDEXEDDB WEB FALLBACK ENGINE
// ----------------------------------------------------
const DB_NAME = 'EvidenceFlowLocalDB';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sources')) {
        db.createObjectStore('sources', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('evidence_chunks')) {
        db.createObjectStore('evidence_chunks', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('explain_messages')) {
        db.createObjectStore('explain_messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('search_cache')) {
        db.createObjectStore('search_cache', { keyPath: 'key' });
      }
    };
  });
}

function getCacheFilename(category: string, query: string): string {
  const sanitized = query
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 100);
  return `cache_${category}_${sanitized}.json`;
}

export async function getCachedResults(category: string, query: string): Promise<LocalCacheEntry | null> {
  const cacheKey = `${category}:${query.trim().toLowerCase()}`;
  if (isTauri) {
    try {
      const filename = getCacheFilename(category, query);
      const content = await invokeTauri<string>('read_local_file', { dirType: 'cache', filename });
      const entry: LocalCacheEntry = JSON.parse(content);
      if (entry && new Date(entry.expiry_time).getTime() > Date.now()) {
        return entry;
      }
      return null;
    } catch {
      return null;
    }
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction('search_cache', 'readonly');
      const store = transaction.objectStore('search_cache');
      const request = store.get(cacheKey);
      request.onsuccess = () => {
        const entry: LocalCacheEntry | null = request.result || null;
        if (entry && new Date(entry.expiry_time).getTime() > Date.now()) {
          resolve(entry);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveCachedResults(entry: LocalCacheEntry): Promise<void> {
  if (isTauri) {
    try {
      const filename = getCacheFilename(entry.category, entry.query);
      await invokeTauri('save_local_file', {
        dirType: 'cache',
        filename,
        content: JSON.stringify(entry, null, 2),
      });
    } catch (e) {
      console.error('Error saving cache to Tauri:', e);
    }
    return;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('search_cache', 'readwrite');
      const store = transaction.objectStore('search_cache');
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Error saving cache to IndexedDB:', e);
  }
}

export async function clearCache(): Promise<void> {
  if (isTauri) {
    try {
      const filenames = await invokeTauri<string[]>('list_local_files', { dirType: 'cache' });
      for (const file of filenames) {
        if (file.endsWith('.json')) {
          await invokeTauri('delete_local_file', { dirType: 'cache', filename: file });
        }
      }
    } catch (e) {
      console.error('Error clearing Tauri cache:', e);
    }
    return;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('search_cache', 'readwrite');
      const store = transaction.objectStore('search_cache');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Error clearing IndexedDB cache:', e);
  }
}

// ----------------------------------------------------
// DATABASE API EXPORTS (DUAL-MODE WRAPPERS)
// ----------------------------------------------------

export async function getAllProjects(): Promise<LocalProject[]> {
  if (isTauri) {
    try {
      const filenames = await invokeTauri<string[]>('list_local_files', { dirType: 'projects' });
      const projects: LocalProject[] = [];
      for (const file of filenames) {
        if (file.endsWith('.json')) {
          const content = await invokeTauri<string>('read_local_file', { dirType: 'projects', filename: file });
          projects.push(JSON.parse(content));
        }
      }
      return projects;
    } catch (e) {
      console.error('Error reading Tauri files:', e);
      return [];
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectById(id: string): Promise<LocalProject | null> {
  if (isTauri) {
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'projects', filename: `${id}.json` });
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProject(project: LocalProject): Promise<void> {
  if (isTauri) {
    await invokeTauri('save_local_file', {
      dirType: 'projects',
      filename: `${project.id}.json`,
      content: JSON.stringify(project, null, 2),
    });
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.put(project);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveSources(sources: LocalSource[]): Promise<void> {
  if (sources.length === 0) return;
  const projectId = sources[0].project_id;

  if (isTauri) {
    // Append or overwrite sources log file for this project
    let existingSources: LocalSource[] = [];
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'sources', filename: `sources_${projectId}.json` });
      existingSources = JSON.parse(content);
    } catch {}

    const merged = [...existingSources];
    sources.forEach((src) => {
      const idx = merged.findIndex((s) => s.id === src.id);
      if (idx !== -1) merged[idx] = src;
      else merged.push(src);
    });

    await invokeTauri('save_local_file', {
      dirType: 'sources',
      filename: `sources_${projectId}.json`,
      content: JSON.stringify(merged, null, 2),
    });
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sources', 'readwrite');
    const store = transaction.objectStore('sources');
    sources.forEach((src) => store.put(src));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getProjectSources(projectId: string): Promise<LocalSource[]> {
  if (isTauri) {
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'sources', filename: `sources_${projectId}.json` });
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sources', 'readonly');
    const store = transaction.objectStore('sources');
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      resolve(all.filter((s: any) => s.project_id === projectId));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveEvidenceChunks(chunks: LocalEvidenceChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const projectId = chunks[0].project_id;

  if (isTauri) {
    let existingChunks: LocalEvidenceChunk[] = [];
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'evidence', filename: `evidence_${projectId}.json` });
      existingChunks = JSON.parse(content);
    } catch {}

    const merged = [...existingChunks];
    chunks.forEach((chunk) => {
      const idx = merged.findIndex((c) => c.id === chunk.id);
      if (idx !== -1) merged[idx] = chunk;
      else merged.push(chunk);
    });

    await invokeTauri('save_local_file', {
      dirType: 'evidence',
      filename: `evidence_${projectId}.json`,
      content: JSON.stringify(merged, null, 2),
    });
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('evidence_chunks', 'readwrite');
    const store = transaction.objectStore('evidence_chunks');
    chunks.forEach((c) => store.put(c));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getProjectEvidenceChunks(projectId: string): Promise<LocalEvidenceChunk[]> {
  if (isTauri) {
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'evidence', filename: `evidence_${projectId}.json` });
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('evidence_chunks', 'readonly');
    const store = transaction.objectStore('evidence_chunks');
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      resolve(all.filter((c: any) => c.project_id === projectId));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveReport(report: LocalReport): Promise<void> {
  if (isTauri) {
    // 1. Save data structure JSON
    await invokeTauri('save_local_file', {
      dirType: 'reports',
      filename: `report_${report.project_id}.json`,
      content: JSON.stringify(report, null, 2),
    });

    // 2. Save a clean Markdown (.md) document for easy direct desktop opening
    await invokeTauri('save_local_file', {
      dirType: 'documents',
      filename: `report_${report.project_id}.md`,
      content: report.markdown,
    });
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('reports', 'readwrite');
    const store = transaction.objectStore('reports');
    const request = store.put(report);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectReport(projectId: string): Promise<LocalReport | null> {
  if (isTauri) {
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'reports', filename: `report_${projectId}.json` });
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('reports', 'readonly');
    const store = transaction.objectStore('reports');
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      resolve(all.find((r: any) => r.project_id === projectId) || null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveExplainMessage(msg: LocalExplainMessage): Promise<void> {
  const projectId = msg.project_id;

  if (isTauri) {
    let existingMsgs: LocalExplainMessage[] = [];
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'explain', filename: `explain_${projectId}.json` });
      existingMsgs = JSON.parse(content);
    } catch {}

    const merged = [...existingMsgs];
    const idx = merged.findIndex((m) => m.id === msg.id);
    if (idx !== -1) merged[idx] = msg;
    else merged.push(msg);

    await invokeTauri('save_local_file', {
      dirType: 'explain',
      filename: `explain_${projectId}.json`,
      content: JSON.stringify(merged, null, 2),
    });
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('explain_messages', 'readwrite');
    const store = transaction.objectStore('explain_messages');
    const request = store.put(msg);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getProjectExplainMessages(projectId: string): Promise<LocalExplainMessage[]> {
  if (isTauri) {
    try {
      const content = await invokeTauri('read_local_file', { dirType: 'explain', filename: `explain_${projectId}.json` });
      return JSON.parse(content).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } catch {
      return [];
    }
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('explain_messages', 'readonly');
    const store = transaction.objectStore('explain_messages');
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      resolve(
        all
          .filter((m: any) => m.project_id === projectId)
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      );
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (isTauri) {
    try {
      await invokeTauri('delete_local_file', { dirType: 'projects', filename: `${id}.json` });
      await invokeTauri('delete_local_file', { dirType: 'sources', filename: `sources_${id}.json` });
      await invokeTauri('delete_local_file', { dirType: 'evidence', filename: `evidence_${id}.json` });
      await invokeTauri('delete_local_file', { dirType: 'reports', filename: `report_${id}.json` });
      await invokeTauri('delete_local_file', { dirType: 'documents', filename: `report_${id}.md` });
      await invokeTauri('delete_local_file', { dirType: 'explain', filename: `explain_${id}.json` });
    } catch (e) {
      console.error('Error deleting project on Tauri:', e);
    }
    return;
  }

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['projects', 'sources', 'evidence_chunks', 'reports', 'explain_messages'], 'readwrite');
    
    // Delete project
    transaction.objectStore('projects').delete(id);
    
    // Delete sources matching project_id
    const sourcesStore = transaction.objectStore('sources');
    const reqSources = sourcesStore.getAll();
    reqSources.onsuccess = () => {
      const records = reqSources.result || [];
      records.forEach((r: any) => {
        if (r.project_id === id) sourcesStore.delete(r.id);
      });
    };

    // Delete evidence_chunks matching project_id
    const evidenceStore = transaction.objectStore('evidence_chunks');
    const reqEvidence = evidenceStore.getAll();
    reqEvidence.onsuccess = () => {
      const records = reqEvidence.result || [];
      records.forEach((r: any) => {
        if (r.project_id === id) evidenceStore.delete(r.id);
      });
    };

    // Delete reports matching project_id
    const reportsStore = transaction.objectStore('reports');
    const reqReports = reportsStore.getAll();
    reqReports.onsuccess = () => {
      const records = reqReports.result || [];
      records.forEach((r: any) => {
        if (r.project_id === id) reportsStore.delete(r.id);
      });
    };

    // Delete explain_messages matching project_id
    const explainStore = transaction.objectStore('explain_messages');
    const reqExplain = explainStore.getAll();
    reqExplain.onsuccess = () => {
      const records = reqExplain.result || [];
      records.forEach((r: any) => {
        if (r.project_id === id) explainStore.delete(r.id);
      });
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAllExplainMessages(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('explain_messages', 'readwrite');
    const store = transaction.objectStore('explain_messages');
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function factoryResetAllData(): Promise<void> {
  if (isTauri) {
    try {
      await invokeTauri('delete_local_file', { dirType: 'projects', filename: '*' });
      await invokeTauri('delete_local_file', { dirType: 'sources', filename: '*' });
      await invokeTauri('delete_local_file', { dirType: 'evidence', filename: '*' });
      await invokeTauri('delete_local_file', { dirType: 'reports', filename: '*' });
      await invokeTauri('delete_local_file', { dirType: 'documents', filename: '*' });
      await invokeTauri('delete_local_file', { dirType: 'explain', filename: '*' });
      await invokeTauri('delete_local_file', { dirType: 'cache', filename: '*' });
    } catch (e) {
      console.warn('Tauri reset error:', e);
    }
  }

  try {
    const db = await openDB();
    const storeNames = Array.from(db.objectStoreNames);
    if (storeNames.length > 0) {
      const transaction = db.transaction(storeNames, 'readwrite');
      storeNames.forEach((name) => {
        try {
          transaction.objectStore(name).clear();
        } catch (e) {
          console.warn(`Failed clearing store ${name}:`, e);
        }
      });
      await new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    }
    db.close();
  } catch (e) {
    console.warn('DB clear error:', e);
  }

  if (typeof window !== 'undefined') {
    if (window.indexedDB) {
      try {
        window.indexedDB.deleteDatabase('ResearchFlowDB');
      } catch (e) {
        console.warn('Delete DB error:', e);
      }
    }
    localStorage.clear();
    sessionStorage.clear();
  }
}
