'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, BookOpen } from 'lucide-react';
import { getAllProjects, saveProject, deleteProject } from '@/lib/localDb';
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
  created_at: string;
  archived?: boolean;
  pinned?: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [question, setQuestion] = useState('');
  const audience = 'Student';
  const depth = 'Standard';
  const sourcePolicy = 'Default';
  const [category, setCategory] = useState('generalist');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
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

  const getPlaceholderText = (cat: string) => {
    switch (cat) {
      case 'generalist': return 'e.g. Research quantum computing for a first-year engineering student';
      case 'idea': return 'e.g. Is there an app or service that allows renting high-end camera gear locally? Analyze competition.';
      case 'academic': return 'e.g. What are the latest breakthroughs and experimental consensus in nuclear fusion confinement?';
      case 'market': return 'e.g. Map the competitive landscape for carbon removal startups in India.';
      case 'tech': return 'e.g. How do Next.js 15 Server Actions handle concurrency and parallel database connections?';
      default: return 'e.g. Research quantum computing for a first-year engineering student';
    }
  };

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
  };

  const [showArchived, setShowArchived] = useState(false);

  const loadProjects = async () => {
    try {
      const localProjects = await getAllProjects();
      const sorted = (localProjects as any[]).sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) {
          return pinB - pinA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setProjects(sorted);
    } catch (e) {
      console.error('Error loading projects:', e);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch projects on load
  useEffect(() => {
    loadProjects();
  }, []);

  const handleTogglePin = async (p: any) => {
    const updated = { ...p, pinned: !p.pinned };
    await saveProject(updated);
    triggerToast(updated.pinned ? 'Project pinned.' : 'Project unpinned.');
    await loadProjects();
  };

  const handleToggleArchive = async (p: any) => {
    const updated = { ...p, archived: !p.archived };
    await saveProject(updated);
    triggerToast(updated.archived ? 'Project archived.' : 'Project unarchived.');
    await loadProjects();
  };

  const handleDeleteProject = async (projectId: string) => {
    if (window.confirm('Are you sure you want to permanently delete this research project?')) {
      await deleteProject(projectId);
      triggerToast('Project deleted.');
      await loadProjects();
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };
  const handleStartResearch = async () => {
    const q = question.trim();
    if (!q) {
      triggerToast('Please enter a research topic or question to start.');
      return;
    }

    setIsSubmitting(true);
    try {
      const projectId = crypto.randomUUID();
      const newProj = {
        id: projectId,
        title: q.length > 40 ? q.slice(0, 40) + '...' : q,
        question: q,
        audience,
        depth,
        source_policy: sourcePolicy,
        category,
        status: 'idle' as const,
        created_at: new Date().toISOString(),
      };
      await saveProject(newProj);
      triggerToast('Project initialized. Routing to research desk...');
      router.push(`/project?id=${projectId}&run=true`);
    } catch (e) {
      console.error(e);
      triggerToast('Could not initialize local project. Check space.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestionClick = (suggestedQ: string) => {
    setQuestion(suggestedQ);
  };

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
        <button className="new-research" onClick={() => router.push('/')}>
          <span>＋</span> New research
        </button>
        <nav aria-label="Primary">
          <a className="nav-link active" href="/">
            <span className="mr-2"><Compass size={16} className="inline mr-2" /></span> Research workspace
          </a>
          <a className="nav-link" href="#" onClick={() => triggerToast('Library view available in specific project workspaces.')}>
            <span className="mr-2"><BookOpen size={16} className="inline mr-2" /></span> Evidence library
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
            {loadingProjects ? (
              <p className="text-xs text-stone-400 px-2 italic">Loading library...</p>
            ) : projects.filter(p => showArchived ? p.archived : !p.archived).length === 0 ? (
              <p className="text-xs text-stone-400 px-2 italic">
                {showArchived ? "No archived projects." : "No active projects."}
              </p>
            ) : (
              projects.filter(p => showArchived ? p.archived : !p.archived).map((p) => (
                <div
                  key={p.id}
                  className="group relative flex items-center justify-between rounded-lg hover:bg-stone-150 transition-colors w-full min-w-0"
                >
                  <a
                    href={`/project?id=${p.id}`}
                    className="project-sidebar-item flex-1 truncate pr-8 min-w-0"
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

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col">
        <header>
          <div className="breadcrumb">
            Research workspace <span>/</span> <strong>New project</strong>
          </div>
          <div className="header-actions flex items-center gap-2">
            <button 
              className="px-3.5 py-1.5 text-xs font-bold text-[#174f3c] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              onClick={() => router.push('/landing')}
            >
              <span>✨ Why ResearchFlow AI?</span>
            </button>
          </div>
        </header>

        {/* HERO SECTION / LAUNCHER */}
        <section className="hero">
          <p className="eyebrow">EVIDENCE-FIRST RESEARCH AGENT</p>
          <h1>An evidence-first research agent that turns a question into a <em>reusable research workspace.</em></h1>
          <p className="subhead">
            Research once. Keep the evidence, report, citations, and searchable knowledge base—then explore it with confidence.
          </p>

          <div className="prompt-card">
            <label htmlFor="question">What would you like to understand?</label>
            <textarea
              id="question"
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={getPlaceholderText(category)}
            />
            
            {/* Category Selector Pills */}
            <div className="flex gap-2 flex-wrap mb-4 mt-2 border-t border-stone-100 pt-3">
              <span className="text-xs text-stone-500 font-semibold flex items-center mr-2">Research Category:</span>
              <button 
                type="button"
                onClick={() => handleCategorySelect('generalist')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${category === 'generalist' ? 'bg-[#174f3c] text-white border-transparent font-semibold shadow-sm' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                🌐 Generalist
              </button>
              <button 
                type="button"
                onClick={() => handleCategorySelect('idea')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${category === 'idea' ? 'bg-[#174f3c] text-white border-transparent font-semibold shadow-sm' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                💡 Idea Validation
              </button>
              <button 
                type="button"
                onClick={() => handleCategorySelect('academic')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${category === 'academic' ? 'bg-[#174f3c] text-white border-transparent font-semibold shadow-sm' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                🔬 Academic Review
              </button>
              <button 
                type="button"
                onClick={() => handleCategorySelect('market')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${category === 'market' ? 'bg-[#174f3c] text-white border-transparent font-semibold shadow-sm' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                📊 Market Intelligence
              </button>
              <button 
                type="button"
                onClick={() => handleCategorySelect('tech')}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 cursor-pointer ${category === 'tech' ? 'bg-[#174f3c] text-white border-transparent font-semibold shadow-sm' : 'bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-300'}`}
              >
                💻 Technical Docs
              </button>
            </div>
            
            <div className="prompt-footer">
              <span className="scope">
                <span className="live-dot"></span> Web, papers & trusted sources (API-key free)
              </span>
              <button 
                className="research-button" 
                onClick={handleStartResearch}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Initializing...' : 'Start research'} 
                <span className="ml-2">→</span>
              </button>
            </div>
          </div>

          <div className="suggestions">
            <span>Try:</span>
            <button onClick={() => handleSuggestionClick('Research quantum computing for a first-year engineering student')}>
              Quantum computing
            </button>
            <button onClick={() => handleSuggestionClick('What are the strongest arguments for and against a four-day workweek?')}>
              Four-day workweek
            </button>
            <button onClick={() => handleSuggestionClick('Map the competitive landscape for carbon removal in India.')}>
              Carbon removal in India
            </button>
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
