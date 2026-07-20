'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ArrowLeft, Compass, BookOpen, FileText, HelpCircle,
  ExternalLink, Copy, FileDown, Send, AlertTriangle, ShieldCheck,
  Upload, FileJson
} from 'lucide-react';
import { jsPDF } from 'jspdf';

import { 
  getProjectById, getProjectSources as getLocalProjectSources, getProjectEvidenceChunks as getLocalProjectEvidenceChunks, 
  getProjectReport, getProjectExplainMessages, saveProject, 
  saveSources, saveEvidenceChunks, saveReport as saveLocalReport, saveExplainMessage,
  getAllProjects, deleteProject
} from '@/lib/localDb';
import { executeResearch, searchEvidence, searchWebSources, extractChunkMetadata } from '@/lib/engine';
import { ProfileModal } from '@/components/ProfileModal';
import { WelcomeOnboardingModal } from '@/components/WelcomeOnboardingModal';

interface Project {
  id: string;
  title: string;
  question: string;
  status: string;
  audience?: string;
  depth?: string;
  source_policy?: string;
  category?: string;
  created_at: string;
  archived?: boolean;
  pinned?: boolean;
}

interface Source {
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

interface EvidenceChunk {
  id: string;
  source_id: string;
  project_id: string;
  text: string;
  locator?: string;
  support_label?: 'Strongly supported' | 'Supported' | 'Limited evidence' | 'Conflicting evidence';
  quality_signals?: any;
}

interface Report {
  id: string;
  project_id: string;
  markdown: string;
  executive_takeaway?: string;
  evidence_count?: number;
  source_count?: number;
  created_at: string;
}

interface ExplainMessage {
  id: string;
  project_id: string;
  question: string;
  answer: string;
  source_state: string;
  citations: any[];
  detected_intent?: string;
  created_at: string;
}

// Custom simple Markdown renderer with rich support for tables, lists, and code blocks
function RenderMarkdown({ 
  text, 
  sources = [], 
  evidence = [] 
}: { 
  text: string; 
  sources?: Source[]; 
  evidence?: EvidenceChunk[]; 
}) {
  if (!text) return null;
  
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[][] = [];
  
  let inCode = false;
  let codeContent: string[] = [];
  
  let inList = false;
  let listItems: string[] = [];

  const renderInline = (value: string, keyPrefix: string): React.ReactNode[] => {
    // Matches bold tags, markdown links, or citation references like [1], [2]
    const tokens = value.split(/(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|\[\d+\])/g).filter(Boolean);
    return tokens.map((token, index) => {
      const link = token.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (link) {
        return <a key={`${keyPrefix}-link-${index}`} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-[#174f3c] underline underline-offset-2 hover:text-[#0e3829]">{link[1]}</a>;
      }
      if (token.startsWith('**') && token.endsWith('**')) {
        return <strong key={`${keyPrefix}-bold-${index}`} className="font-semibold">{token.slice(2, -2)}</strong>;
      }
      
      const citationMatch = token.match(/^\[(\d+)\]$/);
      if (citationMatch) {
        const rank = parseInt(citationMatch[1], 10);
        const matchingSource = sources.find((s) => s.rank === rank);
        if (matchingSource) {
          const passages = evidence.filter((e) => e.source_id === matchingSource.id).map(e => e.text);
          const tooltipContent = passages.length > 0 
            ? passages[0] 
            : "Click to audit evidence references in the ledger.";
          
          return (
            <span key={`${keyPrefix}-cit-${index}`} className="group relative inline-block mx-0.5 cursor-pointer">
              <span className="bg-[#d8f0df] text-[#174f3c] hover:bg-[#caf169] transition-all px-1.5 py-0.5 rounded text-[11px] font-bold font-mono">
                [{rank}]
              </span>
              {/* CSS Tooltip */}
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-stone-900 text-stone-100 text-[10px] p-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-205 z-50 shadow-xl leading-relaxed whitespace-normal border border-stone-800 font-sans">
                <strong className="block text-emerald-400 mb-0.5 truncate">{matchingSource.title}</strong>
                <span className="block text-[9px] text-stone-400 mb-1.5 uppercase font-semibold tracking-wider">
                  {matchingSource.publisher || 'Unknown'} · {((matchingSource.quality_score ?? 1.0) * 100).toFixed(0)}% Quality
                </span>
                <span className="italic block text-stone-205 bg-stone-950 p-1.5 rounded">"{tooltipContent.length > 140 ? tooltipContent.slice(0, 140) + '...' : tooltipContent}"</span>
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-900"></span>
              </span>
            </span>
          );
        }
      }
      return <React.Fragment key={`${keyPrefix}-text-${index}`}>{token}</React.Fragment>;
    });
  };
  
  const flushList = (key: string | number) => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 mb-3 text-sm leading-relaxed space-y-1">
          {listItems.map((item, idx) => {
            return <li key={idx}>{renderInline(item, `list-${key}-${idx}`)}</li>;
          })}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = (key: string | number) => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      renderedElements.push(
        <div key={`table-wrapper-${key}`} className="overflow-x-auto my-4 border border-stone-200 rounded-lg">
          <table className="min-w-full divide-y divide-stone-200 text-xs">
            {tableHeaders.length > 0 && (
              <thead className="bg-stone-50">
                <tr>
                  {tableHeaders.map((h, idx) => (
                    <th key={idx} className="px-4 py-2 text-left font-bold text-stone-700 border-r border-stone-200 last:border-0">{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-stone-200 bg-white">
              {tableRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-stone-50/50">
                  {row.map((cell, cIdx) => {
                    return (
                      <td key={cIdx} className="px-4 py-2 text-stone-600 border-r border-stone-200 last:border-0">
                        {renderInline(cell, `table-${rIdx}-${cIdx}`)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeaders = [];
      tableRows = [];
      inTable = false;
    }
  };

  const flushCode = (key: string | number) => {
    if (codeContent.length > 0) {
      renderedElements.push(
        <pre key={`code-${key}`} className="bg-stone-900 text-[#d9f57a] p-4 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed my-4 shadow-inner">
          <code>{codeContent.join('\n')}</code>
        </pre>
      );
      codeContent = [];
      inCode = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Code block check
    if (trimmed.startsWith('```')) {
      if (inCode) {
        flushCode(i);
      } else {
        flushList(i);
        flushTable(i);
        inCode = true;
      }
      continue;
    }
    
    if (inCode) {
      codeContent.push(line);
      continue;
    }
    
    // Table check
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList(i);
      const cells = trimmed
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      
      // Skip separator row (e.g. |:---|:---|)
      if (cells.every((c) => c.startsWith(':') || c.startsWith('-') || c.endsWith('-'))) {
        continue;
      }
      
      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    } else {
      flushTable(i);
    }
    
    // List check
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
      continue;
    } else if (trimmed.length > 0 && !inList && !inTable) {
      // Continue plain text line
    } else {
      flushList(i);
    }
    
    // Header check
    if (trimmed.startsWith('# ')) {
      renderedElements.push(
        <h1 key={i} className="font-serif text-3xl font-bold mt-6 mb-4 border-b border-stone-200 pb-2 text-stone-900">
          {renderInline(trimmed.slice(2), `h1-${i}`)}
        </h1>
      );
    } else if (trimmed.startsWith('## ')) {
      renderedElements.push(
        <h2 key={i} className="font-serif text-2xl font-semibold mt-6 mb-3 text-stone-900">
          {renderInline(trimmed.slice(3), `h2-${i}`)}
        </h2>
      );
    } else if (trimmed.startsWith('### ')) {
      renderedElements.push(
        <h3 key={i} className="font-serif text-lg font-bold mt-4 mb-2 text-stone-850">
          {renderInline(trimmed.slice(4), `h3-${i}`)}
        </h3>
      );
    } else if (trimmed.length === 0) {
      // Empty line
    } else {
      renderedElements.push(
        <p key={i} className="mb-3 text-sm leading-relaxed text-stone-750">
          {renderInline(trimmed, `paragraph-${i}`)}
        </p>
      );
    }
  }
  
  // Final flushes
  flushList('final');
  flushTable('final');
  flushCode('final');
  
  return (
    <div className="prose prose-stone max-w-none text-stone-850">
      {renderedElements}
    </div>
  );
}

// Category-based SVG Visualizations
function WorkspaceVisualizer({ 
  category, 
  sources = [] 
}: { 
  category: string; 
  sources: Source[]; 
}) {
  if (sources.length === 0) return null;

  // 1. Idea validation quadrant map
  if (category === 'idea') {
    const competitors = sources.slice(0, 3);
    const positions = [
      { x: 180, y: 140, name: 'Alternative A' },
      { x: 300, y: 90, name: 'Alternative B' },
      { x: 110, y: 200, name: 'Alternative C' },
    ];
    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
        <h4 className="font-serif text-sm font-bold text-stone-850 mb-3 flex items-center gap-1.5">
          📊 Market Positioning Map (Quadrant Chart)
        </h4>
        <div className="relative w-full h-[260px] bg-white border border-stone-150 rounded-lg overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 400 250">
            {/* Axis Lines */}
            <line x1="40" y1="210" x2="380" y2="210" stroke="#a3a3a3" strokeWidth="1.5" />
            <line x1="40" y1="20" x2="40" y2="210" stroke="#a3a3a3" strokeWidth="1.5" />
            
            {/* Grid labels */}
            <text x="380" y="225" fontSize="8" textAnchor="end" fill="#737373" fontWeight="bold">Low Competitor Density</text>
            <text x="45" y="30" fontSize="8" fill="#737373" fontWeight="bold" transform="rotate(90, 45, 30)">High Gaps / Opportunities</text>
            
            {/* Proposed Idea Node (Star) */}
            <g className="cursor-pointer">
              <polygon points="260,65 263,74 272,74 265,80 267,89 260,83 253,89 255,80 248,74 257,74" fill="#174f3c" stroke="#caf169" strokeWidth="1.5" />
              <text x="260" y="55" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#174f3c">⭐ Proposed Idea</text>
            </g>

            {/* Competitor Nodes */}
            {competitors.map((src, idx) => {
              const pos = positions[idx] || { x: 120, y: 120, name: 'Competitor' };
              return (
                <g key={src.id} className="cursor-pointer">
                  <circle cx={pos.x} cy={pos.y} r="8" fill="#a3a3a3" stroke="#e5e5e5" strokeWidth="1.5" />
                  <text x={pos.x} y={pos.y - 12} fontSize="8" fill="#525252" textAnchor="middle" fontWeight="semibold">
                    {src.title.length > 20 ? src.title.slice(0, 17) + '...' : src.title}
                  </text>
                  <title>{src.title} (Publisher: {src.publisher || 'N/A'}, Quality: {((src.quality_score ?? 1.0) * 100).toFixed(0)}%)</title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  // 2. Source distribution donut chart
  if (category === 'market' || category === 'generalist') {
    const counts = sources.reduce<Record<string, number>>((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {});
    
    const total = sources.length;
    const colors: Record<string, string> = { paper: '#1e3a8a', gov: '#047857', report: '#b45309', web: '#6b7280', user_pdf: '#701a75' };

    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
        <h4 className="font-serif text-sm font-bold text-stone-850 mb-3">
          📊 Source Distribution Analysis
        </h4>
        <div className="flex flex-col sm:flex-row items-center gap-6 bg-white p-4 rounded-lg border border-stone-150">
          <svg className="w-28 h-28 shrink-0" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#f3f4f6" strokeWidth="3" />
            {Object.entries(counts).map(([type, cnt], idx) => {
              const prevSum = Object.entries(counts).slice(0, idx).reduce((sum, entry) => sum + entry[1], 0);
              const strokePercent = (cnt / total) * 100;
              const offsetPercent = (prevSum / total) * 100;
              return (
                <circle 
                  key={type}
                  cx="18" 
                  cy="18" 
                  r="15.9" 
                  fill="transparent" 
                  stroke={colors[type] || '#174f3c'} 
                  strokeWidth="3.2" 
                  strokeDasharray={`${strokePercent} ${100 - strokePercent}`} 
                  strokeDashoffset={100 - offsetPercent + 25}
                />
              );
            })}
            <circle cx="18" cy="18" r="11" fill="#ffffff" />
            <text x="18" y="20.5" fontSize="7.5" fontWeight="bold" textAnchor="middle" fill="#1c1917">
              {total}
            </text>
            <text x="18" y="24" fontSize="4.5" textAnchor="middle" fill="#78716c">
              SOURCES
            </text>
          </svg>
          <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
            {Object.entries(counts).map(([type, cnt]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colors[type] || '#174f3c' }}></span>
                <span className="capitalize text-stone-600 font-semibold">{type === 'user_pdf' ? 'user uploads' : type}:</span>
                <span className="text-stone-900 font-bold">{cnt} ({((cnt / total) * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. Academic Consensus Timeline Plot
  if (category === 'academic') {
    const years = sources
      .map(s => parseInt(s.published_at || '', 10))
      .filter(yr => !isNaN(yr))
      .sort((a, b) => a - b);
      
    if (years.length === 0) return null;

    const minYear = years[0] - 1;
    const maxYear = years[years.length - 1] + 1;
    const span = maxYear - minYear || 1;

    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
        <h4 className="font-serif text-sm font-bold text-stone-850 mb-3">
          🔬 Literature Chronology Matrix
        </h4>
        <div className="bg-white p-4 rounded-lg border border-stone-150">
          <div className="relative h-12 w-full mt-4 flex items-center">
            <div className="absolute left-4 right-4 h-0.5 bg-stone-200"></div>
            {sources.map((src) => {
              const yr = parseInt(src.published_at || '', 10);
              if (isNaN(yr)) return null;
              const leftPct = 4 + ((yr - minYear) / span) * 92;
              return (
                <div 
                  key={src.id} 
                  className="absolute -translate-x-1/2 group cursor-pointer"
                  style={{ left: `${leftPct}%` }}
                >
                  <div className="w-4 h-4 rounded-full bg-emerald-700 hover:bg-[#caf169] border-2 border-white shadow-md transition-colors"></div>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-stone-900 text-stone-100 text-[10px] p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none text-center shadow-lg leading-tight">
                    <strong>{yr}</strong>: {src.title.slice(0, 40)}...
                  </span>
                  <span className="absolute top-full left-1/2 -translate-x-1/2 text-[9px] font-mono text-stone-500 mt-1 font-bold">
                    {yr}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[10px] text-stone-400 text-center mt-6">
            Scatter distribution of indexed open-access literature publications
          </div>
        </div>
      </div>
    );
  }

  // 4. Tech packages checklist
  if (category === 'tech') {
    const packages = sources.filter(s => s.type === 'web' && (s.publisher === 'npm Registry' || s.publisher === 'Crates.io Registry' || s.publisher === 'GitHub'));
    if (packages.length === 0) return null;

    return (
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mb-6">
        <h4 className="font-serif text-sm font-bold text-stone-850 mb-3">
          💻 Package Dependability Audit
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white p-3 rounded-lg border border-stone-150 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded font-mono mr-2">
                  {pkg.publisher?.replace(' Registry', '')}
                </span>
                <strong className="text-xs text-stone-800">{pkg.title}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-stone-400 font-bold">Score: {((pkg.quality_score ?? 1.0) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default function ProjectWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldRun = searchParams.get('run') === 'true';
  const id = searchParams.get('id') || '';

  // States
  const [project, setProject] = useState<Project | null>(null);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [evidence, setEvidence] = useState<EvidenceChunk[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [explainMessages, setExplainMessages] = useState<ExplainMessage[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [researchStarted, setResearchStarted] = useState(false);
  const [researchMessage, setResearchMessage] = useState('Workspace loaded.');
  const [currentTab, setCurrentTab] = useState<'report' | 'explain' | 'library'>('report');
  
  // Q&A Box
  const [questionText, setQuestionText] = useState('');
  const [allowExternal, setAllowExternal] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  
  // Highlight/Filter specific source cards
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const consoleContainerRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<Source[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showArchived, setShowArchived] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [userName, setUserName] = useState('Nagen S.');
  const [workspaceLabel, setWorkspaceLabel] = useState('Personal workspace');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const loadUserProfile = () => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('rf_user_name');
      const savedLabel = localStorage.getItem('rf_workspace_label');
      if (savedName) setUserName(savedName);
      if (savedLabel) setWorkspaceLabel(savedLabel);
    }
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  const avatarInitials = userName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NS';

  // Close dropdown on click outside
  useEffect(() => {
    const handleGlobalClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const loadSidebarProjects = async () => {
    try {
      const list = await getAllProjects();
      const sorted = (list as any[]).sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) {
          return pinB - pinA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setProjectsList(sorted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePin = async (p: any) => {
    const updated = { ...p, pinned: !p.pinned };
    await saveProject(updated);
    triggerToast(updated.pinned ? 'Project pinned.' : 'Project unpinned.');
    await loadSidebarProjects();
  };

  const handleToggleArchive = async (p: any) => {
    const updated = { ...p, archived: !p.archived };
    await saveProject(updated);
    triggerToast(updated.archived ? 'Project archived.' : 'Project unarchived.');
    await loadSidebarProjects();
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this research project?')) {
      await deleteProject(projectId);
      triggerToast('Project deleted.');
      await loadSidebarProjects();
      if (id === projectId) {
        router.push('/');
      }
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Load project details
  const fetchProjectDetails = async () => {
    try {
      const projObj = await getProjectById(id);
      if (projObj) {
        const interruptedStatuses = ['planning', 'discovering', 'extracting', 'validating', 'synthesizing'];
        const normalizedProject = interruptedStatuses.includes(projObj.status)
          ? { ...projObj, status: 'failed' }
          : projObj;
        if (normalizedProject !== projObj) {
          await saveProject(normalizedProject as any);
        }
        setProject(normalizedProject as any);
        const [projSources, projEvidence, projReport, projMsgs] = await Promise.all([
          getLocalProjectSources(id),
          getLocalProjectEvidenceChunks(id),
          getProjectReport(id),
          getProjectExplainMessages(id),
        ]);
        // Uploaded PDF records are legacy data and are not part of the Decision Brief workflow.
        const decisionBriefSources = projSources.filter((source: Source) => source.type !== 'user_pdf');
        const decisionBriefSourceIds = new Set(decisionBriefSources.map((source: Source) => source.id));
        const decisionBriefEvidence = projEvidence.filter((chunk: EvidenceChunk) => decisionBriefSourceIds.has(chunk.source_id));
        if (decisionBriefSources.length > 0) {
          setSources(decisionBriefSources as any);
          sourcesRef.current = decisionBriefSources as any;
        }
        if (decisionBriefEvidence.length > 0) {
          setEvidence(decisionBriefEvidence as any);
        }
        if (projReport) {
          setReport(projReport as any);
        }
        setExplainMessages(projMsgs as any);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Run research orchestration
  const runResearchPipeline = async (forceRefresh: boolean = false) => {
    if (researchStarted || !project) return;

    // Internet connectivity check
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      triggerToast('Internet Connection Required: Please check your connection.');
      setResearchMessage('Failed: Connect to the internet to run crawls.');
      return;
    }

    setResearchStarted(true);
    if (forceRefresh) {
      setReport(null);
      setSources([]);
      setEvidence([]);
    }
    setResearchMessage('Triggering deterministic research orchestrator...');
    const initTime = new Date().toLocaleTimeString();
    setConsoleLogs([
      `[${initTime}] SYSTEM: Initializing ResearchFlow AI workspace memory...`,
      `[${initTime}] SYSTEM: Local hard-drive directory connection initialized.`,
    ]);
    try {
      // Execute the research directly in browser memory!
      await executeResearch(id, project.question, project.category || 'generalist', async (update) => {
        // Update live status log
        setResearchMessage(update.message);

        // Append static console log
        const timeStr = new Date().toLocaleTimeString();
        let logText = '';
        if (update.stage === 'planning') {
          logText = `[${timeStr}] PLANNING: ${update.message}`;
        } else if (update.stage === 'discovering') {
          logText = `[${timeStr}] DISCOVERING: ${update.message}`;
        } else if (update.stage === 'extracting') {
          logText = `[${timeStr}] EXTRACTING: ${update.message}`;
        } else if (update.stage === 'validating') {
          logText = `[${timeStr}] VALIDATING: ${update.message}`;
        } else if (update.stage === 'synthesizing') {
          logText = `[${timeStr}] SYNTHESIZING: ${update.message}`;
        }
        
        if (logText) {
          setConsoleLogs((prev) => {
            // Avoid adding identical adjacent logs
            if (prev.length > 0 && prev[prev.length - 1].includes(update.stage.toUpperCase())) {
              return prev;
            }
            return [...prev, logText];
          });
        }
        
        // Persist each stage so a refresh or desktop restart cannot leave a ghost "running" project.
        setProject((prev) => {
          if (!prev) return null;
          const nextProject = { ...prev, status: update.stage };
          void saveProject(nextProject as any).catch((error) => console.error('Unable to save project status:', error));
          return nextProject;
        });

        // Save sources if discovered
        if (update.sourcesFound && update.sourcesFound.length > 0) {
          const sourcesWithIds = update.sourcesFound.map(s => ({
            ...s,
            id: Math.random().toString(36).substring(2, 15),
          }));
          await saveSources(sourcesWithIds as any);
          setSources(sourcesWithIds as any);
          sourcesRef.current = sourcesWithIds as any;
        }

        // Save evidence if extracted
        if (update.evidenceFound && update.evidenceFound.length > 0) {
          const evidenceWithIds = update.evidenceFound.map((chunk) => {
            const matchingSource = sourcesRef.current.find((s) => s.id === chunk.source_id || s.title === chunk.source_id) || sourcesRef.current[0];
            const sourceTitle = matchingSource?.title || 'Saved source';
            const metadata = extractChunkMetadata(chunk.text || '', sourceTitle);
            return {
              ...chunk,
              ...metadata,
              id: Math.random().toString(36).substring(2, 15),
              source_id: matchingSource ? matchingSource.id : '',
            };
          });
          await saveEvidenceChunks(evidenceWithIds as any);
          setEvidence(evidenceWithIds as any);
        }

        // Save report if synthesized
        if (update.report) {
          const reportObj = {
            ...update.report,
            id: Math.random().toString(36).substring(2, 15),
            created_at: new Date().toISOString(),
          };
          setReport(reportObj as any);
          await saveLocalReport(reportObj as any);
        }
      }, forceRefresh);

      // Mark project as complete
      if (project) {
        const finalProj = { ...project, status: 'complete' as const };
        await saveProject(finalProj as any);
        setProject(finalProj as any);
      }

      setResearchStarted(false);
      setResearchMessage('Research complete!');
      triggerToast('Research workspace created successfully!');
      await fetchProjectDetails();
      setCurrentTab('report');
    } catch (e: any) {
      const failedProject = project ? { ...project, status: 'failed' } : null;
      if (failedProject) {
        await saveProject(failedProject as any);
        setProject(failedProject as any);
      }
      setResearchStarted(false);
      setResearchMessage('Orchestration failed.');
      triggerToast('Orchestration failed.');
      const errTime = new Date().toLocaleTimeString();
      setConsoleLogs((prev) => [
        ...prev,
        `[${errTime}] ERROR: Orchestration failed. ${e?.message || e || 'Unknown error'}`
      ]);
    }
  };

  // Load initial dataset & handle auto-run
  useEffect(() => {
    async function loadWorkspace() {
      setLoading(true);
      await fetchProjectDetails();
      
      // Load projects list for Sidebar
      await loadSidebarProjects();
      setLoading(false);
    }
    loadWorkspace();
    // fetchProjectDetails is deliberately triggered by project id changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Handle auto-run after loading completes
  useEffect(() => {
    if (!loading && project && shouldRun && project.status === 'idle' && !researchStarted) {
      runResearchPipeline();
    }
    // The guarded auto-run should respond to state transitions, not function identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, project, shouldRun, researchStarted]);

  // Auto-scroll chat window
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [explainMessages, isAsking]);

  // Auto-scroll console window internally
  useEffect(() => {
    if (consoleContainerRef.current) {
      consoleContainerRef.current.scrollTop = consoleContainerRef.current.scrollHeight;
    }
  }, [project?.status, researchMessage]);

  const handleAskQuestion = async (overrideQuestion?: string) => {
    const q = (overrideQuestion || questionText).trim();
    if (!q || !project) return;

    setIsAsking(true);
    if (!overrideQuestion) {
      setQuestionText('');
    }
    
    // Optimistic user bubble
    const userMsgId = 'temp-' + Date.now();
    const userMsg: ExplainMessage = {
      id: userMsgId,
      project_id: id,
      question: q,
      answer: 'Understanding your question and checking the Decision Brief...',
      source_state: 'From report',
      citations: [],
      created_at: new Date().toISOString(),
    };
    
    setExplainMessages((prev) => [...prev, userMsg]);

    try {
      // 1. Local Search
      let searchResult = searchEvidence(q, evidence as any, sources as any, project?.category || 'generalist', explainMessages);

      // 2. Live search is opt-in and only runs after Decision Brief retrieval misses.
      if (searchResult.shouldSearchExternal && allowExternal) {
        if (typeof window !== 'undefined' && !window.navigator.onLine) {
          triggerToast('Offline Mode: live search is unavailable.');
          searchResult = {
            answer: '⚠️ Internet connection required to search external web sources for this inquiry. Please connect to the internet and try again.',
            source_state: 'No matching evidence',
            citations: [],
            shouldSearchExternal: false,
          };
        } else {
          const liveData = await searchWebSources(q, id, project.category || 'generalist', explainMessages);
          
          if (liveData.sources.length > 0) {
            // Generate IDs and save sources
            const sourcesToSave = liveData.sources.map(s => ({
              ...s,
              id: Math.random().toString(36).substring(2, 15),
            }));
            await saveSources(sourcesToSave as any);

            // Save chunks bound to correct source IDs
            const chunksToSave = liveData.evidence.map((chunk) => {
              const matchingSource = sourcesToSave.find((s) => s.title === chunk.source_id) || sourcesToSave[0];
              return {
                ...chunk,
                id: Math.random().toString(36).substring(2, 15),
                source_id: matchingSource ? matchingSource.id : '',
              };
            });
            await saveEvidenceChunks(chunksToSave as any);

            // Map citations to saved IDs
            const finalCitations = chunksToSave.map((c) => {
              const matchingSavedSource = sourcesToSave.find((s) => s.id === c.source_id) || sourcesToSave[0];
              return {
                chunkId: c.id,
                sourceTitle: matchingSavedSource.title,
                url: matchingSavedSource.url,
                text: c.text,
              };
            });

            searchResult = {
              answer: liveData.answer,
              source_state: 'Live supplemental sources',
              citations: finalCitations,
              shouldSearchExternal: false,
              detected_intent: (liveData as any).detected_intent,
            };
          }
        }
      }

      // 3. Save ExplainMessage to LocalDB
      const finalMsg: ExplainMessage = {
        id: 'msg-' + Math.random().toString(36).substring(2, 15),
        project_id: id,
        question: q,
        answer: searchResult.answer,
        source_state: searchResult.source_state,
        citations: searchResult.citations,
        detected_intent: (searchResult as any).detected_intent,
        created_at: new Date().toISOString(),
      };
      await saveExplainMessage(finalMsg);

      // 4. Update state
      setExplainMessages((prev) => 
        prev.map((m) => m.id === userMsgId ? (finalMsg as any) : m)
      );
      await fetchProjectDetails();
    } catch (e) {
      console.error(e);
      triggerToast('Q&A analysis error.');
    } finally {
      setIsAsking(false);
    }
  };


  const handleCopyReport = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.markdown);
    triggerToast('Report markdown copied to clipboard.');
  };

  const handleExportPDF = () => {
    if (!project || !report) {
      triggerToast('There is no completed report to download yet.');
      return;
    }

    const document = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const margin = 20;
    const contentWidth = 210 - margin * 2;
    const pageBottom = 270;
    let pageNumber = 1;
    let cursorY = 40;

    const safeFileName = (project.title || 'research-brief')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'research-brief';

    const plainText = (value: string) => value
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/\|/g, ' · ')
      .replace(/\s+/g, ' ')
      .trim();

    const drawHeader = () => {
      // Elegant thin accent top border
      document.setFillColor(23, 79, 60);
      document.rect(0, 0, 210, 8, 'F');
      
      document.setTextColor(110, 119, 114);
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.text('RESEARCHFLOW AI · DECISION BRIEF REPORT', margin, 15);
      
      document.setDrawColor(219, 225, 218);
      document.setLineWidth(0.3);
      document.line(margin, 17, 210 - margin, 17);
      document.setTextColor(22, 33, 30);
    };

    const drawFooter = () => {
      document.setDrawColor(219, 225, 218);
      document.setLineWidth(0.3);
      document.line(margin, 280, 210 - margin, 280);
      
      document.setTextColor(110, 119, 114);
      document.setFontSize(8);
      document.text(`Published: ${new Date(report.created_at).toLocaleDateString()} · Page ${pageNumber}`, margin, 285);
      document.setTextColor(22, 33, 30);
    };

    const nextPage = () => {
      drawFooter();
      document.addPage();
      pageNumber += 1;
      drawHeader();
      cursorY = 25;
    };

    const write = (value: string, fontSize = 10, style: 'normal' | 'bold' = 'normal', gap = 5) => {
      const content = plainText(value);
      if (!content) return;
      document.setFont('helvetica', style);
      document.setFontSize(fontSize);
      const lineHeight = fontSize * 0.45 + 1.2;
      const lines = document.splitTextToSize(content, contentWidth) as string[];
      if (cursorY + lines.length * lineHeight + gap > pageBottom) nextPage();
      document.text(lines, margin, cursorY);
      cursorY += lines.length * lineHeight + gap;
    };

    // --- COVER SHEET ---
    document.setFillColor(243, 240, 232);
    document.rect(margin, 30, contentWidth, 80, 'F');
    
    document.setTextColor(23, 79, 60);
    document.setFont('helvetica', 'bold');
    document.setFontSize(22);
    const titleLines = document.splitTextToSize(project.title || 'Research Brief', contentWidth - 20) as string[];
    document.text(titleLines, margin + 10, 52);
    
    document.setTextColor(22, 33, 30);
    document.setFont('helvetica', 'normal');
    document.setFontSize(10);
    document.text(`Topic: ${project.question}`, margin + 10, 85);
    document.text(`Research Category: ${project.category?.toUpperCase() || 'GENERAL'} · Sources: ${sources.length}`, margin + 10, 93);
    document.text(`Created by: ResearchFlow AI Workspace`, margin + 10, 100);

    cursorY = 130;
    
    drawHeader();

    report.markdown.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        cursorY += 2;
        return;
      }
      if (trimmed.startsWith('# ')) {
        write(trimmed.slice(2), 16, 'bold', 6);
      } else if (trimmed.startsWith('## ')) {
        write(trimmed.slice(3), 13, 'bold', 4);
      } else if (trimmed.startsWith('### ')) {
        write(trimmed.slice(4), 11, 'bold', 3);
      } else if (trimmed.startsWith('|')) {
        if (!/^\|?\s*:?-{3,}/.test(trimmed)) {
          write(trimmed.replace(/^\||\|$/g, '').split('|').map(c => c.trim()).join('  |  '), 8.5, 'normal', 3);
        }
      } else {
        write(trimmed.replace(/^[-*]\s+/, '• '), 9.5, 'normal', 3.5);
      }
    });

    // Write Bibliography section
    if (cursorY + 40 > pageBottom) nextPage();
    cursorY += 5;
    document.setFont('helvetica', 'bold');
    document.setFontSize(13);
    document.text("Bibliography & Evidence Register", margin, cursorY);
    cursorY += 8;

    sources.forEach((src) => {
      if (cursorY + 15 > pageBottom) nextPage();
      document.setFont('helvetica', 'bold');
      document.setFontSize(9);
      document.text(`[Source ${src.rank}] ${src.title}`, margin, cursorY);
      cursorY += 4.5;
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.text(`Publisher: ${src.publisher || 'Unknown'} · Type: ${src.type} · Quality: ${((src.quality_score ?? 1.0) * 100).toFixed(0)}%`, margin, cursorY);
      cursorY += 4.5;
      if (src.url) {
        document.setTextColor(23, 79, 60);
        document.text(`Reference Link: ${src.url}`, margin, cursorY);
        document.setTextColor(22, 33, 30);
        cursorY += 5;
      } else {
        cursorY += 3;
      }
    });

    drawFooter();
    document.save(`${safeFileName}-decision-brief.pdf`);
    triggerToast('Premium PDF exported successfully!');
  };

  const handleExportJSON = () => {
    if (!project) return;
    const bundle = {
      project,
      sources,
      evidence,
      report
    };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(bundle, null, 2)
    )}`;
    const downloadAnchor = window.document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    const safeTitle = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadAnchor.setAttribute('download', `researchflow-${safeTitle}-bundle.json`);
    window.document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('Project workspace JSON bundle exported.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    triggerToast(`Reading document: ${file.name}...`);
    
    const reader = new FileReader();
    
    if (['txt', 'md', 'json'].includes(fileExtension || '')) {
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        if (!text) return;
        await parseAndStoreUploadedText(file.name, text, fileExtension === 'json');
      };
      reader.readAsText(file);
    } 
    else if (fileExtension === 'pdf') {
      try {
        if (!(window as any).pdfjsLib) {
          triggerToast("Loading PDF parser engine from CDN...");
          await new Promise<void>((resolve, reject) => {
            const script = window.document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
            script.onload = () => {
              (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
              resolve();
            };
            script.onerror = () => reject(new Error("Unable to load PDF parser. Check internet connection."));
            window.document.head.appendChild(script);
          });
        }
        
        reader.onload = async (event) => {
          const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
          const pdfjsLib = (window as any).pdfjsLib;
          try {
            const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
            let fullText = '';
            
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map((item: any) => item.str).join(' ');
              fullText += pageText + '\n';
            }
            
            await parseAndStoreUploadedText(file.name, fullText, false);
          } catch (pdfError: any) {
            console.error(pdfError);
            triggerToast(`PDF parsing failed: ${pdfError.message}`);
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (err: any) {
        triggerToast(err.message);
      }
    } else {
      triggerToast("Unsupported format. Use .txt, .md, .pdf, or project .json bundles.");
    }
  };

  const parseAndStoreUploadedText = async (filename: string, text: string, isJsonBundle: boolean) => {
    if (isJsonBundle) {
      try {
        const bundle = JSON.parse(text);
        if (bundle.project && Array.isArray(bundle.sources) && Array.isArray(bundle.evidence)) {
          await saveProject(bundle.project);
          await saveSources(bundle.sources);
          await saveEvidenceChunks(bundle.evidence);
          if (bundle.report) {
            await saveLocalReport(bundle.report);
          }
          triggerToast("Research workspace bundle imported successfully!");
          router.push(`/project?id=${bundle.project.id}`);
          return;
        }
      } catch (err: any) {
        console.error(err);
        triggerToast("Invalid project bundle JSON file.");
        return;
      }
    }

    const paragraphs = text
      .split(/\n\n|\r\n\r\n|\.\s+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);
      
    if (paragraphs.length === 0) {
      triggerToast("Uploaded file contains no readable text passages.");
      return;
    }

    const sourceId = 'src-' + Math.random().toString(36).substring(2, 15);
    const newSource: any = {
      id: sourceId,
      project_id: id,
      title: filename,
      url: '',
      publisher: 'Local Upload',
      type: 'user_pdf',
      published_at: new Date().getFullYear().toString(),
      accessed_at: new Date().toISOString().split('T')[0],
      rank: sources.length + 1,
      quality_score: 1.0
    };

    const newEvidence: any[] = paragraphs.map((para, pIdx) => {
      const metadata = extractChunkMetadata(para, filename);
      return {
        id: 'chunk-' + Math.random().toString(36).substring(2, 15),
        project_id: id,
        source_id: sourceId,
        text: para.endsWith('.') ? para : `${para}.`,
        locator: `Page / Section ${Math.floor(pIdx / 5) + 1}`,
        support_label: 'Strongly supported',
        quality_signals: {
          relevance: 1.0,
          recency: 'Recent',
          credibility: 'User Document'
        },
        ...metadata
      };
    });

    await saveSources([newSource] as any);
    await saveEvidenceChunks(newEvidence as any);
    triggerToast(`Imported ${newEvidence.length} evidence excerpts from ${filename}!`);
    await fetchProjectDetails();
  };

  // UI Helpers
  const getBadgeClass = (type: string) => {
    switch (type) {
      case 'paper': return 'source-badge paper';
      case 'gov': return 'source-badge gov';
      case 'report': return 'source-badge report';
      case 'user_pdf': return 'source-badge report';
      default: return 'source-badge web';
    }
  };

  const getBadgeChar = (type: string) => {
    switch (type) {
      case 'paper': return 'P';
      case 'gov': return 'G';
      case 'report': return 'R';
      case 'user_pdf': return 'PDF';
      default: return 'W';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50 text-stone-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#174f3c] mx-auto mb-4"></div>
          <p className="font-serif italic">Loading EvidenceFlow Workspace...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-50 text-stone-850 p-6">
        <AlertTriangle className="text-red-700 mb-4" size={48} />
        <h2 className="font-serif text-2xl font-bold mb-2">Workspace Not Found</h2>
        <p className="text-sm text-stone-500 mb-6">The workspace ID you are requesting is missing or deleted.</p>
        <button className="research-button" onClick={() => router.push('/')}>
          <ArrowLeft size={16} className="inline mr-2" /> Go back to Library
        </button>
      </div>
    );
  }

  const isResearchRunning = ['planning', 'discovering', 'extracting', 'validating', 'synthesizing'].includes(project.status) || researchStarted;

  return (
    <div className="flex min-h-screen">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark bg-[#174f3c] text-[#d9f57a] flex items-center justify-center rounded-lg" style={{ padding: '4px' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <polyline points="8 11 10 13 14 9"></polyline>
            </svg>
          </span>
          <span>ResearchFlow AI</span>
        </a>
        <button className="new-research" onClick={() => router.push('/workspace')}>
          <span>＋</span> New research
        </button>
        <nav aria-label="Primary">
          <a className={`nav-link ${currentTab === 'report' ? 'active' : ''}`} href="#" onClick={() => setCurrentTab('report')}>
            <span className="mr-2"><Compass size={16} className="inline mr-2" /></span> Workspace Brief
          </a>
          <a className={`nav-link ${currentTab === 'library' ? 'active' : ''}`} href="#" onClick={() => setCurrentTab('library')}>
            <span className="mr-2"><BookOpen size={16} className="inline mr-2" /></span> Evidence Ledger ({evidence.length})
          </a>
        </nav>

        {/* Existing Projects section in Sidebar */}
        <div className="mt-8 flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center px-2 mb-2 shrink-0">
            <p className="eyebrow uppercase tracking-wider">RECENT PROJECTS</p>
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className="text-[9px] font-bold text-stone-500 hover:text-[#174f3c] uppercase tracking-wider transition-colors"
            >
              {showArchived ? "Show Active" : "Show Archived"}
            </button>
          </div>
          <div className="project-sidebar-list flex-1 overflow-y-auto pr-1" style={{ alignContent: 'start' }}>
            {projectsList.filter(p => showArchived ? p.archived : !p.archived).length === 0 ? (
              <p className="text-xs text-stone-400 px-2 italic">
                {showArchived ? "No archived projects." : "No active projects."}
              </p>
            ) : (
              projectsList.filter(p => showArchived ? p.archived : !p.archived).map((p) => (
                <div
                  key={p.id}
                  className="group relative flex items-center justify-between rounded-lg hover:bg-stone-150 transition-colors w-full min-w-0"
                >
                  <a
                    href={`/project?id=${p.id}`}
                    className={`project-sidebar-item flex-1 truncate pr-8 min-w-0 ${p.id === id ? 'active' : ''}`}
                    title={p.question}
                  >
                    {p.pinned && <span className="mr-1 text-[10px]">📌</span>}
                    {p.title}
                  </a>
                  
                  {/* Three-dots Menu Trigger */}
                  <div className="relative flex items-center pr-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === p.id ? null : p.id);
                      }}
                      className="p-1 rounded text-stone-500 hover:text-[#174f3c] hover:bg-stone-200 transition-colors"
                      title="More actions"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="19" cy="12" r="1.5"></circle>
                        <circle cx="5" cy="12" r="1.5"></circle>
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    {activeMenuId === p.id && (
                      <div className="absolute right-0 top-7 w-32 bg-white border border-stone-200 rounded-lg shadow-lg z-50 py-1 font-sans text-xs">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleTogglePin(p);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-stone-750 hover:bg-stone-50 transition-colors flex items-center gap-1.5 font-sans"
                        >
                          <span>📌</span> {p.pinned ? "Unpin" : "Pin"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleArchive(p);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-stone-750 hover:bg-stone-50 transition-colors flex items-center gap-1.5 font-sans"
                        >
                          <span>📦</span> {p.archived ? "Unarchive" : "Archive"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteProject(p.id);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-red-650 hover:bg-red-50 transition-colors flex items-center gap-1.5 font-sans"
                        >
                          <span>🗑️</span> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-bottom shrink-0">
          <button className="profile" onClick={() => setIsProfileModalOpen(true)}>
            <span className="avatar">{avatarInitials}</span>
            <span>
              <b>{userName}</b>
              <small>{workspaceLabel}</small>
            </span>
            <span className="chevron">⌄</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header>
          <div className="breadcrumb">
            Research workspace <span>/</span> <strong className="max-w-[400px] truncate inline-block align-bottom" title={project.question}>{project.title}</strong>
          </div>
          <div className="header-actions flex gap-2 items-center">
            <button 
              className="px-3.5 py-1.5 text-xs font-bold text-[#174f3c] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              onClick={() => router.push('/landing')}
            >
              <span>✨ Product Showcase</span>
            </button>
            {project.status === 'idle' && (
              <button className="research-button" onClick={() => runResearchPipeline(false)}>
                Start Pipeline
              </button>
            )}
            {project.status === 'complete' && (
              <button 
                className="secondary-button py-1.5 px-3 flex items-center gap-1.5 text-xs text-[#174f3c] border-[#174f3c] hover:bg-[#d8f0df]/40 font-bold"
                onClick={() => runResearchPipeline(true)}
              >
                🔄 Refresh Sources
              </button>
            )}
          </div>
        </header>

        {/* WORKSPACE CONTENT GRID */}
        <section className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-y-auto">
          {/* LEFT/MAIN PANE: Report, Q&A, or Library list */}
          <div className="lg:col-span-8 border-r border-stone-200 p-8 overflow-y-auto max-h-[calc(100vh-74px)]">
            
            {/* TAB CONTAINER */}
            <div className="tab-nav">
              <button 
                className={`tab-button ${currentTab === 'report' ? 'active' : ''}`}
                onClick={() => setCurrentTab('report')}
              >
                Decision Brief
              </button>
              {report && (
                <>
                  <button 
                    className={`tab-button ${currentTab === 'explain' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('explain')}
                  >
                    Explain Mode (Q&A)
                  </button>
                  <button 
                    className={`tab-button ${currentTab === 'library' ? 'active' : ''}`}
                    onClick={() => setCurrentTab('library')}
                  >
                    Evidence Ledger
                  </button>
                </>
              )}
            </div>

            {/* TAB 1: DECISION BRIEF */}
            {currentTab === 'report' && (
              <div>
                <div className="mb-4 bg-emerald-50/50 text-[#174f3c] text-xs px-4 py-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                  <span>🔒</span>
                  <span>Research uses public internet sources. Your workspace data remains on this device.</span>
                </div>
                {isResearchRunning ? (
                  /* ANIMATED PROCESSING WORKSPACE VISUALIZATION */
                  <div className="bg-stone-900 text-stone-100 rounded-xl p-8 shadow-lg border border-stone-800 font-mono text-xs overflow-hidden relative">
                    {/* Top bar */}
                    <div className="flex justify-between items-center pb-3 border-b border-stone-800 mb-6">
                      <div className="flex gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      </div>
                      <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Pipeline Engine v2.0</span>
                    </div>

                    {/* Animated graph visualization */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 relative">
                      {/* Connecting Line background */}
                      <div className="absolute top-[22px] left-[10%] right-[10%] h-0.5 bg-stone-800 hidden md:block z-0"></div>

                      {/* Node 1: PLAN */}
                      <div className="flex flex-col items-center z-10 text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${project.status === 'planning' ? 'bg-[#174f3c]/20 border-emerald-500 pulse-active' : ['discovering', 'extracting', 'validating', 'synthesizing', 'complete'].includes(project.status) ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-stone-950 border-stone-800 text-stone-600'}`}>
                          🔍
                        </div>
                        <span className={`mt-2 font-bold text-[10px] uppercase tracking-wider ${project.status === 'planning' ? 'text-emerald-400' : 'text-stone-400'}`}>Plan</span>
                      </div>

                      {/* Node 2: CRAWL */}
                      <div className="flex flex-col items-center z-10 text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${project.status === 'discovering' ? 'bg-[#174f3c]/20 border-emerald-500 pulse-active' : ['extracting', 'validating', 'synthesizing', 'complete'].includes(project.status) ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-stone-950 border-stone-800 text-stone-600'}`}>
                          🌐
                        </div>
                        <span className={`mt-2 font-bold text-[10px] uppercase tracking-wider ${project.status === 'discovering' ? 'text-emerald-400' : 'text-stone-400'}`}>Crawl</span>
                      </div>

                      {/* Node 3: EXTRACT */}
                      <div className="flex flex-col items-center z-10 text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${project.status === 'extracting' ? 'bg-[#174f3c]/20 border-emerald-500 pulse-active' : ['validating', 'synthesizing', 'complete'].includes(project.status) ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-stone-950 border-stone-800 text-stone-600'}`}>
                          ✂️
                        </div>
                        <span className={`mt-2 font-bold text-[10px] uppercase tracking-wider ${project.status === 'extracting' ? 'text-emerald-400' : 'text-stone-400'}`}>Extract</span>
                      </div>

                      {/* Node 4: VALIDATE */}
                      <div className="flex flex-col items-center z-10 text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${project.status === 'validating' ? 'bg-[#174f3c]/20 border-emerald-500 pulse-active' : ['synthesizing', 'complete'].includes(project.status) ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-stone-950 border-stone-800 text-stone-600'}`}>
                          ⚖️
                        </div>
                        <span className={`mt-2 font-bold text-[10px] uppercase tracking-wider ${project.status === 'validating' ? 'text-emerald-400' : 'text-stone-400'}`}>Validate</span>
                      </div>

                      {/* Node 5: SYNTHESIZE */}
                      <div className="flex flex-col items-center z-10 text-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${project.status === 'synthesizing' ? 'bg-[#174f3c]/20 border-emerald-500 pulse-active' : project.status === 'complete' ? 'bg-emerald-950 border-emerald-500 text-[#10b981]' : 'bg-stone-950 border-stone-800 text-stone-600'}`}>
                          📊
                        </div>
                        <span className={`mt-2 font-bold text-[10px] uppercase tracking-wider ${project.status === 'synthesizing' ? 'text-emerald-400' : 'text-stone-400'}`}>Synthesize</span>
                      </div>
                    </div>

                    {/* Live code/terminal logs frame */}
                    <div ref={consoleContainerRef} className="console-feed bg-stone-950 p-4 rounded-lg border border-stone-800 font-mono text-stone-300 text-[11px] leading-relaxed shadow-inner h-44 overflow-y-auto relative">
                      <style>{`
                        .console-feed::-webkit-scrollbar {
                          width: 5px;
                        }
                        .console-feed::-webkit-scrollbar-track {
                          background: #0c0a09;
                        }
                        .console-feed::-webkit-scrollbar-thumb {
                          background: #292524;
                          border-radius: 4px;
                        }
                        .console-feed::-webkit-scrollbar-thumb:hover {
                          background: #10b981;
                        }
                        @keyframes pulse-glow {
                          0%, 100% {
                            box-shadow: 0 0 10px rgba(16,185,129,0.3);
                            border-color: #10b981;
                          }
                          50% {
                            box-shadow: 0 0 20px rgba(52,211,153,0.7);
                            border-color: #34d399;
                          }
                        }
                        .pulse-active {
                          animation: pulse-glow 1.5s infinite ease-in-out;
                        }
                      `}</style>
                      <div className="text-stone-500 font-semibold mb-2 flex items-center justify-between sticky top-0 bg-stone-950 pb-1 z-10">
                        <span>CONSOLE OUTPUT FEED:</span>
                        <span className="animate-pulse flex items-center gap-1 text-emerald-500 text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> LIVE RUNNING
                        </span>
                      </div>
                      {consoleLogs.length > 0 ? (
                        consoleLogs.map((log, i) => (
                          <p key={i} className={log.includes('SYSTEM') ? 'text-stone-650' : 'text-emerald-400'}>{log}</p>
                        ))
                      ) : (
                        <>
                          <p className="text-stone-600">[{new Date().toLocaleTimeString()}] SYSTEM: Initializing ResearchFlow AI workspace memory...</p>
                          <p className="text-stone-600">[{new Date().toLocaleTimeString()}] SYSTEM: Local hard-drive directory connection initialized.</p>
                          {project.status === 'complete' && (
                            <p className="text-emerald-400">[{new Date().toLocaleTimeString()}] COMPLETED: Research report compiled and loaded successfully.</p>
                          )}
                        </>
                      )}
                      
                      <p className="text-stone-400 mt-2 animate-bounce">█</p>
                    </div>

                    {/* Pulsating green progress bar */}
                    <div className="mt-4">
                      <div className="flex justify-between items-center text-[10px] text-stone-500 font-bold mb-1">
                        <span>PIPELINE DISPATCH CAPACITY</span>
                        <span>
                          {project.status === 'planning' ? '10%' : project.status === 'discovering' ? '30%' : project.status === 'extracting' ? '60%' : project.status === 'validating' ? '80%' : project.status === 'synthesizing' ? '95%' : '0%'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-850 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-500 ease-out" 
                          style={{ 
                            width: project.status === 'planning' ? '10%' : project.status === 'discovering' ? '30%' : project.status === 'extracting' ? '60%' : project.status === 'validating' ? '80%' : project.status === 'synthesizing' ? '95%' : '0%' 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : report ? (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-xs text-stone-500">
                        📁 {sources.length} sources indexed • 🔗 {evidence.length} evidence passages verified
                      </div>
                      <div className="export-actions">
                        <button className="secondary-button flex items-center gap-1.5" onClick={handleCopyReport}>
                          <Copy size={13} /> Copy Markdown
                        </button>
                        <button className="secondary-button flex items-center gap-1.5" onClick={handleExportJSON} title="Export Workspace Backup Bundle">
                          <FileJson size={13} /> Export Bundle
                        </button>
                        <button className="export-button flex items-center gap-1.5" onClick={handleExportPDF}>
                          <FileDown size={13} /> Download PDF
                        </button>
                      </div>
                    </div>

                    <div className="brief-card">
                      <div className="brief-top mb-4">
                        <span className="brief-tag font-semibold tracking-wider">WORKSPACE SYNTHESIS</span>
                        <span>Published: {new Date(report.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <WorkspaceVisualizer category={project.category || 'generalist'} sources={sources} />
                      
                      <RenderMarkdown text={report.markdown} sources={sources} evidence={evidence} />

                      {/* Explicit Trust Callout */}
                      <div className="evidence-callout mt-8 border-l-4 border-[#174f3c]">
                        <span className="flex items-center gap-1"><ShieldCheck size={12} /> TRUST METRIC</span>
                        <b>{evidence.length} extracted passages across {sources.length} linked sources</b>
                        <p className="mt-1">
                          The report quotes retrieved source passages and links each finding to its original page. Review source context before relying on any conclusion.
                        </p>
                        <button className="mt-2 text-xs text-[#174f3c] font-bold" onClick={() => setCurrentTab('library')}>
                          Audit Evidence Ledger →
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* DEFAULT IDLE STATE CARD */
                  <div className="text-center py-20 bg-stone-50 rounded-xl border border-dashed border-stone-300">
                    <FileText className="text-stone-400 mx-auto mb-4" size={40} />
                    <h3 className="font-serif text-lg font-semibold">No brief generated yet</h3>
                    <p className="text-sm text-stone-500 mb-4">The research orchestrator must run first to compile this brief.</p>
                    {['idle', 'failed'].includes(project.status) && (
                      <button className="research-button mx-auto" onClick={() => runResearchPipeline()}>
                        {project.status === 'failed' ? 'Retry Research' : 'Run Research'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: EXPLAIN MODE (Q&A) */}
            {currentTab === 'explain' && (
              <div className="flex flex-col h-[calc(100vh-220px)] justify-between">
                <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                  {explainMessages.length === 0 ? (
                    <div className="text-center py-12 text-stone-500 flex flex-col justify-center items-center h-full">
                      <HelpCircle className="mx-auto text-[#174f3c]/70 mb-3 animate-pulse" size={36} />
                      <h4 className="font-serif font-bold text-stone-850 text-lg">Grounded Chat Assistant</h4>
                      <p className="text-xs max-w-sm mx-auto mt-2 leading-relaxed text-stone-500 mb-6">
                        Ask questions naturally. The engine checks this Decision Brief and its saved evidence first. Live search is optional and runs only if the brief has no answer.
                      </p>
                      {/* Suggestion Chips */}
                      <div className="w-full max-w-md">
                        <span className="block text-[9px] font-bold tracking-wider text-stone-400 mb-2.5 uppercase text-left pl-1">Suggested Questions:</span>
                        <div className="flex flex-col gap-2">
                          {(project?.category === 'idea' ? [
                            "What are the direct competitor alternatives found?",
                            "Which core market assumptions need testing next?",
                            "Summarize the features comparison matrix."
                          ] : project?.category === 'academic' ? [
                            "What are the main scientific consensus statements?",
                            "Are there any conflicting trial findings or research gaps?",
                            "Summarize the methodology of the peer-reviewed sources."
                          ] : project?.category === 'tech' ? [
                            "What are the recommended package configurations?",
                            "Are there any license or vulnerability concerns noted?",
                            "Explain the concurrency details from the sources."
                          ] : project?.category === 'market' ? [
                            "What are the main market segments and demographics?",
                            "What growth drivers and trends are identified?",
                            "List the friction barriers or supply-chain concerns."
                          ] : [
                            "Summarize the key takeaways from the sources.",
                            "What are the main definitions and context?",
                            "List all indexed reference publications."
                          ]).map((suggestedQ, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAskQuestion(suggestedQ)}
                              className="text-left text-xs bg-white hover:bg-[#d8f0df]/40 border border-stone-200 hover:border-[#174f3c] text-stone-700 hover:text-[#174f3c] transition-all p-3 rounded-xl shadow-sm font-sans"
                            >
                              💡 {suggestedQ}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="qa-container">
                      {explainMessages.map((msg) => (
                        <div key={msg.id} className="space-y-2">
                          {/* User question bubble */}
                          <div className="qa-bubble user">
                            {msg.question}
                          </div>
                          {/* Agent answer bubble */}
                          <div className="qa-bubble agent">
                            <span className={`qa-badge ${msg.source_state === 'From Decision Brief' ? 'report' : 'additional'}`}>
                              {msg.source_state}
                            </span>
                            {msg.detected_intent && (
                              <span className="qa-badge bg-stone-50 text-stone-700 border border-stone-200 ml-1.5 font-bold uppercase tracking-wider text-[9px] px-2 py-0.5 rounded-full font-mono">
                                🎯 {msg.detected_intent}
                              </span>
                            )}
                            <div className="text-stone-850 font-normal leading-relaxed text-sm">
                              <RenderMarkdown text={msg.answer} sources={sources} evidence={evidence} />
                            </div>

                            {/* Citations section */}
                            {msg.citations && msg.citations.length > 0 && (
                              <div className="citation-list">
                                <span className="block font-semibold mb-1 text-[10px] text-stone-500">CITATIONS & EVIDENCE RECEIPTS:</span>
                                {msg.citations.map((c: any, index: number) => (
                                  <div key={index} className="citation-item text-xs flex justify-between items-start gap-4">
                                    <div className="text-stone-600 italic">
                                      "{c.text}"
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-[#174f3c]">
                                        {c.sourceTitle.length > 20 ? c.sourceTitle.slice(0, 20) + '...' : c.sourceTitle} <ExternalLink size={10} />
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isAsking && (
                        <div className="qa-bubble agent italic text-stone-400 flex items-center gap-2">
                          <div className="animate-pulse rounded-full h-2 w-2 bg-[#174f3c]"></div>
                          Checking the Decision Brief and its evidence...
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>
                  )}
                </div>

                {/* Input box */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-stone-500 flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={allowExternal} 
                        onChange={(e) => setAllowExternal(e.target.checked)}
                        className="rounded text-[#174f3c] focus:ring-[#174f3c] border-stone-300"
                      />
                      Use live web search only if the Decision Brief has no answer
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#174f3c]"
                      placeholder="e.g. What does the Decision Brief say about site operations?"
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAskQuestion();
                      }}
                    />
                    <button 
                      className="research-button px-4 py-2 flex items-center gap-1"
                      onClick={() => handleAskQuestion()}
                      disabled={isAsking}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: EVIDENCE LEDGER LIST */}
            {currentTab === 'library' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-serif font-bold text-lg text-stone-850">All Extracted Evidence Cards</h3>
                  <span className="text-xs text-stone-400">Total: {evidence.length} cards</span>
                </div>

                {/* Upload Zone */}
                <div 
                  className="bg-stone-50 border-2 border-dashed border-stone-300 rounded-xl p-6 mb-6 text-center cursor-pointer hover:bg-stone-100 hover:border-[#174f3c] transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mx-auto text-stone-400 mb-2" size={24} />
                  <p className="text-xs font-bold text-stone-750">Upload Local Document (PDF, TXT, MD) or JSON Bundle</p>
                  <p className="text-[10px] text-stone-500 mt-1">Files are parsed client-side in memory and stored in your local library.</p>
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.txt,.md,.json"
                  />
                </div>

                <div className="space-y-4">
                  {evidence.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">No evidence loaded. Run the research orchestrator first.</p>
                  ) : (
                    evidence.map((chunk) => {
                      const src = sources.find((s) => s.id === chunk.source_id);
                      return (
                        <article key={chunk.id} className="finding bg-white p-4 border border-stone-200 rounded-lg shadow-sm">
                          <div className={src ? getBadgeClass(src.type) : 'source-badge web'}>
                            {src ? getBadgeChar(src.type) : 'W'}
                          </div>
                          <div className="flex-1">
                            <div className="finding-meta flex justify-between items-center mb-1">
                              <span>
                                {src ? src.publisher?.toUpperCase() : 'UNKNOWN'} • {src ? src.published_at : '2026'}
                              </span>
                              <span className={`confidence ${chunk.support_label === 'Strongly supported' ? 'high' : chunk.support_label === 'Conflicting evidence' ? 'bg-rose-100 text-rose-800' : 'medium'}`}>
                                {chunk.support_label}
                              </span>
                            </div>
                            <h3 className="font-bold text-stone-850 mt-1 mb-1">{src ? src.title : 'Source document'}</h3>
                            <p className="text-xs text-stone-600 italic bg-stone-50 p-2 rounded mt-2">
                              "{chunk.text}"
                            </p>
                            {chunk.locator && (
                              <div className="text-[10px] text-stone-400 mt-2 font-mono">
                                Locator: {chunk.locator}
                              </div>
                            )}
                            {src?.url && (
                              <a href={src.url} target="_blank" rel="noopener noreferrer" className="citation mt-2 inline-flex items-center gap-1">
                                [Source Card] View original reference <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANE: Interactive Source Cards & Signals */}
          <div className="lg:col-span-4 bg-stone-50 p-6 overflow-y-auto max-h-[calc(100vh-74px)]">
            <p className="eyebrow mb-3">SOURCE PIPELINE METADATA</p>
            <h2 className="font-serif text-lg font-bold text-stone-850 mb-4">Evidence Sources</h2>

            <div className="space-y-4">
              {sources.length === 0 ? (
                <div className="text-center py-12 text-stone-400 italic text-xs">
                  Sources will be populated during discovering phase.
                </div>
              ) : (
                sources.map((src) => (
                  <div 
                    key={src.id}
                    className={`bg-white border rounded-xl p-4 shadow-sm transition-all duration-200 cursor-pointer ${selectedSourceId === src.id ? 'ring-2 ring-[#174f3c] border-transparent' : 'border-stone-200 hover:border-stone-300'}`}
                    onClick={() => setSelectedSourceId(selectedSourceId === src.id ? null : src.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={getBadgeClass(src.type)}>
                        {getBadgeChar(src.type)}
                      </span>
                      <span className="text-[10px] font-mono bg-stone-100 px-2 py-0.5 rounded text-stone-500">
                        Rank #{src.rank}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-stone-800 leading-tight mb-2 truncate-2-lines" title={src.title}>
                      {src.title}
                    </h4>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-500 pt-2 border-t border-stone-100">
                      <div>
                        <strong>Publisher:</strong> {src.publisher || 'N/A'}
                      </div>
                      <div>
                        <strong>Quality Score:</strong> {src.quality_score ? (src.quality_score * 100).toFixed(0) + '%' : '100%'}
                      </div>
                      <div>
                        <strong>Type:</strong> {src.type}
                      </div>
                      <div>
                        <strong>Access Date:</strong> {src.accessed_at || 'N/A'}
                      </div>
                    </div>

                    {/* Show associated evidence snippet when clicked */}
                    {selectedSourceId === src.id && (
                      <div className="mt-3 pt-3 border-t border-stone-200">
                        <span className="text-[9px] font-bold text-stone-400 block mb-1">VERIFIED PASSAGES IN WORKSPACE:</span>
                        <div className="space-y-2">
                          {evidence.filter((e) => e.source_id === src.id).map((e) => (
                            <p key={e.id} className="text-[11px] text-stone-600 leading-relaxed italic bg-stone-50 p-1.5 rounded">
                              "{e.text}"
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* PROFILE & SETTINGS MODAL */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={loadUserProfile}
        triggerToast={triggerToast}
      />

      {/* FIRST-TIME WELCOME ONBOARDING MODAL */}
      <WelcomeOnboardingModal
        onComplete={(name, label) => {
          setUserName(name);
          setWorkspaceLabel(label);
          triggerToast(`Welcome to ResearchFlow AI, ${name}!`);
        }}
      />

      {/* TOAST NOTIFICATION */}
      <div className={`toast ${toastMessage ? 'show' : ''}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}
