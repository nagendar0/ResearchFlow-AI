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
  status: 'idle' | 'planning' | 'discovering' | 'extracting' | 'validating' | 'synthesizing' | 'complete' | 'failed';
  category?: string;
  audience?: string;
  depth?: string;
  source_policy?: string;
  created_at: string;
  archived?: boolean;
  pinned?: boolean;
}

export default function WorkspacePage() {
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
  const [userName, setUserName] = useState('User');
  const [workspaceLabel, setWorkspaceLabel] = useState('Personal workspace');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const loadUserProfile = () => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('rf_user_name');
      const savedLabel = localStorage.getItem('rf_workspace_label');
      if (savedName && savedName.trim()) {
        setUserName(savedName);
      } else {
        setUserName('User');
      }
      if (savedLabel && savedLabel.trim()) {
        setWorkspaceLabel(savedLabel);
      } else {
        setWorkspaceLabel('Personal workspace');
      }
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
      const sorted = (localProjects as Project[]).sort((a, b) => {
        const pinA = a.pinned ? 1 : 0;
        const pinB = b.pinned ? 1 : 0;
        if (pinA !== pinB) {
          return pinB - pinA;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setProjects(sorted);
    } catch (e) {
      console.error('Local projects load error:', e);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleTogglePin = async (p: Project) => {
    const updated = {
      ...p,
      category: p.category || 'generalist',
      audience: p.audience || 'Student',
      depth: p.depth || 'Standard',
      source_policy: p.source_policy || 'Default',
      pinned: !p.pinned
    };
    await saveProject(updated);
    triggerToast(updated.pinned ? 'Project pinned.' : 'Project unpinned.');
    await loadProjects();
  };

  const handleToggleArchive = async (p: Project) => {
    const updated = {
      ...p,
      category: p.category || 'generalist',
      audience: p.audience || 'Student',
      depth: p.depth || 'Standard',
      source_policy: p.source_policy || 'Default',
      archived: !p.archived
    };
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

  const handleCreateResearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

        <button className="new-research" onClick={() => router.push('/workspace')}>
          <span>+</span> New research
        </button>

        <nav className="space-y-1 my-3">
          <a className="nav-link active flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg" href="/workspace">
            <Compass size={16} className="shrink-0" />
            <span>Research workspace</span>
          </a>
          <a className="nav-link flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg" href="/workspace">
            <BookOpen size={16} className="shrink-0" />
            <span>Evidence library</span>
          </a>
        </nav>

        <div className="projects-section flex-1 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center px-1 mb-2">
            <div className="projects-header font-mono text-[10px] text-stone-400 font-bold uppercase tracking-wider">
              {showArchived ? 'ARCHIVED PROJECTS' : 'RECENT PROJECTS'}
            </div>
            <button 
              onClick={() => setShowArchived(!showArchived)}
              className="text-[10px] text-stone-500 hover:text-stone-800 underline font-mono"
            >
              {showArchived ? 'SHOW ACTIVE' : 'SHOW ARCHIVED'}
            </button>
          </div>

          <div className="project-list overflow-y-auto flex-1 pr-1">
            {loadingProjects ? (
              <div className="p-3 text-xs text-stone-400 italic">Loading projects...</div>
            ) : projects.filter(p => !!p.archived === showArchived).length === 0 ? (
              <div className="p-3 text-xs text-stone-400 italic">
                {showArchived ? 'No archived projects.' : 'No recent projects. Start one above!'}
              </div>
            ) : (
              projects.filter(p => !!p.archived === showArchived).map((p) => (
                <div 
                  key={p.id} 
                  className={`project-item group relative flex justify-between items-center ${p.pinned ? 'bg-amber-50/50 border-l-2 border-amber-400' : ''}`}
                >
                  <a 
                    href={`/project?id=${p.id}`} 
                    className="flex-1 truncate pr-2 text-xs text-stone-700 hover:text-stone-950 font-medium" 
                    title={p.question}
                  >
                    {p.pinned && <span className="mr-1 text-amber-500">📌</span>}
                    {p.title}
                  </a>

                  {/* Context Menu Trigger */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === p.id ? null : p.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-700 rounded transition-opacity"
                    >
                      •••
                    </button>

                    {activeMenuId === p.id && (
                      <div 
                        className="absolute right-0 top-6 w-32 bg-white border border-stone-200 rounded-lg shadow-lg py-1 z-50 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            handleTogglePin(p);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-stone-50 flex items-center gap-1.5 text-stone-700"
                        >
                          <span>{p.pinned ? '📌' : '📍'}</span> {p.pinned ? 'Unpin' : 'Pin to top'}
                        </button>
                        <button
                          onClick={() => {
                            handleToggleArchive(p);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3 py-1.5 hover:bg-stone-50 flex items-center gap-1.5 text-stone-700"
                        >
                          <span>{p.archived ? '📤' : '📦'}</span> {p.archived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                          onClick={() => {
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
              onClick={() => router.push('/')}
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
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={getPlaceholderText(category)}
              rows={3}
            />

            {/* Category Selector Bar */}
            <div className="pt-3 border-t border-stone-200/70 mt-3 space-y-2">
              <div className="text-[10px] font-mono font-bold text-stone-400 uppercase tracking-wider">
                Research Category:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button" 
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${category === 'generalist' ? 'bg-[#174f3c] text-white border-[#174f3c] shadow-xs' : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'}`}
                  onClick={() => handleCategorySelect('generalist')}
                >
                  🌐 Generalist
                </button>

                <button 
                  type="button" 
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${category === 'idea' ? 'bg-[#174f3c] text-white border-[#174f3c] shadow-xs' : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'}`}
                  onClick={() => handleCategorySelect('idea')}
                >
                  💡 Idea Validation
                </button>

                <button 
                  type="button" 
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${category === 'academic' ? 'bg-[#174f3c] text-white border-[#174f3c] shadow-xs' : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'}`}
                  onClick={() => handleCategorySelect('academic')}
                >
                  🎓 Academic Review
                </button>

                <button 
                  type="button" 
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${category === 'market' ? 'bg-[#174f3c] text-white border-[#174f3c] shadow-xs' : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'}`}
                  onClick={() => handleCategorySelect('market')}
                >
                  📊 Market Intelligence
                </button>

                <button 
                  type="button" 
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${category === 'tech' ? 'bg-[#174f3c] text-white border-[#174f3c] shadow-xs' : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'}`}
                  onClick={() => handleCategorySelect('tech')}
                >
                  💻 Technical Docs
                </button>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-3 border-t border-stone-200/70 mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                <svg className="w-3.5 h-3.5 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Web, papers & trusted sources (API-free)
              </span>

              <button 
                className="px-5 py-2.5 bg-[#174f3c] text-white font-bold text-xs rounded-xl hover:bg-[#123e2f] transition-all shadow-md shadow-[#174f3c]/20 flex items-center gap-1.5 cursor-pointer sm:ml-auto" 
                onClick={handleCreateResearch}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Initializing...' : 'Start research →'}
              </button>
            </div>
          </div>

          <div className="suggestions">
            <span>Try an example prompt:</span>
            <button onClick={() => handleSuggestionClick('Research Quantum Machine Learning for postgraduate computer science students.')}>
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
