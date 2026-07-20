'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Database, Cpu, CheckCircle2, XCircle, 
  ArrowRight, Download, Laptop, Lock, Sparkles, Layers, 
  BarChart3, Code2, Lightbulb, GraduationCap, Globe
} from 'lucide-react';

import { DownloadModal } from '@/components/DownloadModal';

export default function LandingPage() {
  const router = useRouter();
  const [activeCategoryTab, setActiveCategoryTab] = useState<'idea' | 'market' | 'tech' | 'academic' | 'generalist'>('idea');
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedOs, setSelectedOs] = useState<'windows' | 'mac' | 'linux' | 'all'>('all');

  const handleLaunchApp = () => {
    router.push('/workspace');
  };

  const handleOpenDownloadModal = (os: 'windows' | 'mac' | 'linux' | 'all' = 'all') => {
    setSelectedOs(os);
    setIsDownloadModalOpen(true);
  };

  const handleScrollToDownload = () => {
    const el = document.getElementById('download-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-[#d8f0df] selection:text-[#174f3c]">
      {/* NAVIGATION HEADER */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-6 sm:px-10 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={handleLaunchApp}>
            <div className="w-9 h-9 rounded-xl bg-[#174f3c] text-[#d9f57a] flex items-center justify-center font-bold shadow-md shadow-[#174f3c]/10">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <polyline points="8 11 10 13 14 9"></polyline>
              </svg>
            </div>
            <span className="font-serif font-bold text-xl text-stone-900 tracking-tight">ResearchFlow AI</span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <button 
              onClick={handleScrollToDownload}
              className="px-4 py-2 text-xs font-bold bg-[#174f3c] text-white rounded-xl hover:bg-[#123e2f] transition-all shadow-md shadow-[#174f3c]/20 hover:shadow-lg flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download size={14} className="text-[#d9f57a]" /> Download Application
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-16 pb-20 px-6 bg-gradient-to-b from-stone-100/60 via-stone-50 to-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-tr from-emerald-100/30 to-amber-100/20 blur-3xl pointer-events-none rounded-full"></div>

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#174f3c] text-xs font-semibold shadow-xs">
            <Sparkles size={13} className="text-emerald-600 animate-pulse" />
            <span>Local-First • Zero Paid APIs • Verifiable Evidence Engine</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-extrabold text-stone-900 tracking-tight leading-[1.15]">
            An evidence-first research agent that turns questions into <em className="italic font-serif text-[#174f3c] underline decoration-emerald-300 decoration-wavy underline-offset-8">reusable workspaces.</em>
          </h1>

          <p className="text-base sm:text-lg text-stone-600 max-w-3xl mx-auto font-normal leading-relaxed">
            Stop trusting hallucinated summaries. ResearchFlow AI extracts structured research scope, crawls public web & paper indexes, corroborates verifiable passages, and stores 100% of your data privately on your local drive.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleScrollToDownload}
              className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold bg-[#174f3c] text-white rounded-xl hover:bg-[#123e2f] transition-all shadow-lg shadow-[#174f3c]/25 flex items-center justify-center gap-2 hover:scale-[1.02] cursor-pointer"
            >
              <Download size={16} className="text-[#d9f57a]" /> Download Desktop Application
            </button>
            <button 
              onClick={handleLaunchApp}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 hover:border-stone-400 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              Try Web Demo Preview <ArrowRight size={16} className="text-[#174f3c]" />
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left max-w-4xl mx-auto border-t border-stone-200/60 mt-12">
            <div className="flex items-center gap-2.5 text-xs text-stone-600 font-medium">
              <Lock size={16} className="text-[#174f3c] shrink-0" />
              <span>100% On-Device Privacy</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-stone-600 font-medium">
              <ShieldCheck size={16} className="text-[#174f3c] shrink-0" />
              <span>Zero Artificial Hallucinations</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-stone-600 font-medium">
              <Database size={16} className="text-[#174f3c] shrink-0" />
              <span>Indexed Offline Cache</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-stone-600 font-medium">
              <Layers size={16} className="text-[#174f3c] shrink-0" />
              <span>5 Category Intelligence Engines</span>
            </div>
          </div>
        </div>
      </section>

      {/* WHY DIFFERENT: FEATURE GRID */}
      <section className="py-20 px-6 bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-[#174f3c]">Architectural Distinction</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">Why ResearchFlow AI is Different</h2>
            <p className="text-sm text-stone-600">Built ground-up to eliminate artificial hallucinations, protect research privacy, and deliver category-specialized evidence.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-7 space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-100/70 text-[#174f3c] flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h3 className="font-serif font-bold text-xl text-stone-900">Grounding Over Speculation</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Standard AI chat assistants invent quotes, fake DOI citations, and fabricate stats. ResearchFlow AI links every claim directly to indexed public web passages with explicit confidence metrics (<span className="text-emerald-700 font-bold">High-quality</span>, <span className="text-amber-700 font-bold">Supporting</span>, <span className="text-rose-700 font-bold">Conflicting</span>).
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-7 space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-100/70 text-[#174f3c] flex items-center justify-center">
                <Lock size={24} />
              </div>
              <h3 className="font-serif font-bold text-xl text-stone-900">100% On-Device Privacy</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                No cloud database, no subscription lock-in, and zero third-party AI tracking. Your projects, downloaded source excerpts, Decision Brief reports, and local cache remain stored strictly on your device’s hard drive.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-7 space-y-4 hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-100/70 text-[#174f3c] flex items-center justify-center">
                <Cpu size={24} />
              </div>
              <h3 className="font-serif font-bold text-xl text-stone-900">Topic vs. Audience Scope Extraction</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Queries like <em>"Research quantum computing for a first-year student"</em> usually return papers about engineering education instead of quantum physics. ResearchFlow AI isolates <code className="bg-stone-200 px-1 py-0.5 rounded text-[11px]">primaryTopic</code> for source crawling while tailoring readability to the audience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON MATRIX TABLE */}
      <section className="py-20 px-6 bg-stone-50">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-[#174f3c]">Feature Comparison</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">ResearchFlow AI vs. Traditional Solutions</h2>
            <p className="text-sm text-stone-600">See how our evidence-first desktop architecture compares with standard AI wrappers and web search engines.</p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100/70 border-b border-stone-200 text-stone-700">
                  <th className="p-4 font-bold uppercase tracking-wider">Feature Dimension</th>
                  <th className="p-4 font-bold text-[#174f3c] bg-emerald-50/50 border-x border-emerald-100/80">ResearchFlow AI</th>
                  <th className="p-4 font-semibold text-stone-600">Standard AI Search Wrappers</th>
                  <th className="p-4 font-semibold text-stone-600">Generic Search Engines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                <tr>
                  <td className="p-4 font-bold text-stone-850">Data Privacy & Ownership</td>
                  <td className="p-4 bg-emerald-50/20 border-x border-emerald-100/80 text-emerald-900 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> 100% Local On-Device Storage
                  </td>
                  <td className="p-4 text-stone-600">Cloud servers & user logging</td>
                  <td className="p-4 text-stone-600">Ad tracking & query profiling</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-stone-850">Verifiable Excerpt Citations</td>
                  <td className="p-4 bg-emerald-50/20 border-x border-emerald-100/80 text-emerald-900 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> Verifiable Passages & Quality Scores
                  </td>
                  <td className="p-4 text-stone-500 flex items-center gap-1">
                    <XCircle size={14} className="text-rose-500 shrink-0" /> Unverifiable AI Summaries
                  </td>
                  <td className="p-4 text-stone-600">Raw links without synthesis</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-stone-850">Category-Specific Retrieval</td>
                  <td className="p-4 bg-emerald-50/20 border-x border-emerald-100/80 text-emerald-900 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> 5 Custom Category Engines
                  </td>
                  <td className="p-4 text-stone-500 flex items-center gap-1">
                    <XCircle size={14} className="text-rose-500 shrink-0" /> One-size-fits-all query generator
                  </td>
                  <td className="p-4 text-stone-600">Generic page rank</td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-stone-850">Offline Local Index Cache</td>
                  <td className="p-4 bg-emerald-50/20 border-x border-emerald-100/80 text-emerald-900 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> Local Database Expiry & Fast Cache
                  </td>
                  <td className="p-4 text-stone-500 flex items-center gap-1">
                    <XCircle size={14} className="text-rose-500 shrink-0" /> Requires continuous paid cloud subscription
                  </td>
                  <td className="p-4 text-stone-500 flex items-center gap-1">
                    <XCircle size={14} className="text-rose-500 shrink-0" /> No local persistent evidence ledger
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-bold text-stone-850">Cost & API Key Requirements</td>
                  <td className="p-4 bg-emerald-50/20 border-x border-emerald-100/80 text-emerald-900 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /> 100% Free Public Sources & Endpoints
                  </td>
                  <td className="p-4 text-stone-600">$20–$200/month or paid API keys</td>
                  <td className="p-4 text-stone-600">Free with heavy ads</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CATEGORY INTELLIGENCE SHOWCASE */}
      <section className="py-20 px-6 bg-white border-t border-stone-200">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-[#174f3c]">Tailored Search Engines</p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">5 Specialized Category Engines</h2>
            <p className="text-sm text-stone-600">ResearchFlow AI adjusts search query keywords, source priorities, and report layouts for your exact domain.</p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 border-b border-stone-200 pb-4">
            <button
              onClick={() => setActiveCategoryTab('idea')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeCategoryTab === 'idea' ? 'bg-[#174f3c] text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <Lightbulb size={14} /> Idea Validation Canvas
            </button>
            <button
              onClick={() => setActiveCategoryTab('market')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeCategoryTab === 'market' ? 'bg-[#174f3c] text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <BarChart3 size={14} /> Market Intelligence
            </button>
            <button
              onClick={() => setActiveCategoryTab('tech')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeCategoryTab === 'tech' ? 'bg-[#174f3c] text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <Code2 size={14} /> Technical Docs
            </button>
            <button
              onClick={() => setActiveCategoryTab('academic')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeCategoryTab === 'academic' ? 'bg-[#174f3c] text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <GraduationCap size={14} /> Academic Review
            </button>
            <button
              onClick={() => setActiveCategoryTab('generalist')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${activeCategoryTab === 'generalist' ? 'bg-[#174f3c] text-white shadow-md' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              <Globe size={14} /> Generalist Reference
            </button>
          </div>

          {/* Active Tab Preview Box */}
          <div className="bg-stone-900 text-stone-100 rounded-2xl p-8 border border-stone-800 shadow-xl space-y-6">
            {activeCategoryTab === 'idea' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Idea Validation Canvas Engine</span>
                  <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded">Prioritizes Product Hunt, GitHub, Hacker News & SEC Filings</span>
                </div>
                <h4 className="text-lg font-serif font-bold text-white">SWOT Analysis Matrix & TAM Signals</h4>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Evaluates strengths, user pain points, competitor repositories, and market sizing metrics from live public web snippets alongside a deterministic recommendation (<span className="text-emerald-400 font-bold">Build</span>, <span className="text-amber-400 font-bold">Validate Further</span>, or <span className="text-rose-400 font-bold">Pivot</span>).
                </p>
              </div>
            )}

            {activeCategoryTab === 'market' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Market Intelligence Engine</span>
                  <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded">Prioritizes Vendor Sites, Pricing Pages & SEC Reports (+4.0 Score Boost)</span>
                </div>
                <h4 className="text-lg font-serif font-bold text-white">Commercial Landscape & Enterprise Adoption</h4>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Penalizes generic academic papers while highlighting vendor pricing tiers, commercial feature matrices, SEC regulatory filings, and market growth estimates.
                </p>
              </div>
            )}

            {activeCategoryTab === 'tech' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Technical Docs Engine</span>
                  <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded">Prioritizes Official Docs, API Specs, SDKs & GitHub Codebases</span>
                </div>
                <h4 className="text-lg font-serif font-bold text-white">Codebase Architecture & Official API References</h4>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Strictly enforces primary topic keyword presence, rejecting unrelated android/robotics fluff when searching Kubernetes or web framework topics.
                </p>
              </div>
            )}

            {activeCategoryTab === 'academic' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Academic Review Engine</span>
                  <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded">Prioritizes Peer-Reviewed Papers & OpenAlex / EuropePMC Indexes</span>
                </div>
                <h4 className="text-lg font-serif font-bold text-white">Dual-Concept Application Matching</h4>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Applies a dual-match bonus when scientific papers match both the theoretical concept and its application domain (e.g. <em>Explainable AI</em> + <em>Software Engineering</em>).
                </p>
              </div>
            )}

            {activeCategoryTab === 'generalist' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-stone-800 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Generalist Reference Engine</span>
                  <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded">Balanced Blend of Research Papers & Educational Indexes</span>
                </div>
                <h4 className="text-lg font-serif font-bold text-white">Foundational Overview & Multi-Source Synthesis</h4>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Blends university archives, government databases, Wikipedia references, and open book registries for comprehensive topic orientation.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* DOWNLOAD & DESKTOP BUILD SECTION */}
      <section id="download-section" className="py-20 px-6 bg-stone-900 text-stone-100">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-8-[#10b981]/30 text-emerald-400 text-xs font-mono">
              <Laptop size={14} /> STANDALONE DESKTOP APPLICATION
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white">Run ResearchFlow AI Locally</h2>
            <p className="text-sm text-stone-400">Download or run locally on your Windows device for 100% offline local database storage and instant research execution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Windows Desktop App */}
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between hover:border-emerald-500/50 transition-all">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-950/80 text-blue-400 border border-blue-800/40 flex items-center justify-center text-xl font-bold">
                  🪟
                </div>
                <span className="text-[10px] font-mono uppercase bg-blue-950 text-blue-400 px-2 py-0.5 rounded">Windows 10 / 11</span>
                <h3 className="font-serif text-lg font-bold text-white">Windows Desktop App</h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Standalone 64-bit Windows installer (.msi / .exe). Runs natively on your laptop with local SQLite & file storage.
                </p>
              </div>
              <button
                onClick={() => handleOpenDownloadModal('windows')}
                className="w-full py-3 text-xs font-bold bg-[#174f3c] text-white rounded-xl hover:bg-[#123e2f] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download size={14} className="text-[#d9f57a]" /> Download for Windows (.msi)
              </button>
            </div>

            {/* macOS Desktop App */}
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between hover:border-emerald-500/50 transition-all">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-stone-200 border border-stone-800 flex items-center justify-center text-xl font-bold">
                  🍎
                </div>
                <span className="text-[10px] font-mono uppercase bg-stone-800 text-stone-300 px-2 py-0.5 rounded">Apple Silicon & Intel</span>
                <h3 className="font-serif text-lg font-bold text-white">macOS Desktop App</h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Universal macOS disk image (.dmg). Fully signed desktop package for M1/M2/M3 & Intel Macs.
                </p>
              </div>
              <button
                onClick={() => handleOpenDownloadModal('mac')}
                className="w-full py-3 text-xs font-bold bg-stone-800 text-white border border-stone-700 rounded-xl hover:bg-stone-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download size={14} className="text-emerald-400" /> Download for macOS (.dmg)
              </button>
            </div>

            {/* Linux Desktop App & Web Demo */}
            <div className="bg-stone-950 border border-stone-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between hover:border-emerald-500/50 transition-all">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/80 text-amber-400 border border-amber-800/40 flex items-center justify-center text-xl font-bold">
                  🐧
                </div>
                <span className="text-[10px] font-mono uppercase bg-amber-950 text-amber-400 px-2 py-0.5 rounded">Linux AppImage / .deb</span>
                <h3 className="font-serif text-lg font-bold text-white">Linux & Web Demo</h3>
                <p className="text-xs text-stone-400 leading-relaxed">
                  Download Linux package (.AppImage) or try out the interactive web demo preview directly in browser.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => handleOpenDownloadModal('linux')}
                  className="w-full py-2.5 text-xs font-bold bg-stone-800 text-white border border-stone-700 rounded-xl hover:bg-stone-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={14} className="text-amber-400" /> Download Linux (.AppImage)
                </button>
                <button
                  onClick={handleLaunchApp}
                  className="w-full py-2 text-[11px] font-semibold text-stone-400 hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  Try Web Demo Preview →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-stone-950 border-t border-stone-800 py-10 px-6 text-stone-500 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#174f3c] text-[#d9f57a] flex items-center justify-center font-bold text-xs">
              RF
            </div>
            <span className="font-serif font-bold text-stone-300">ResearchFlow AI</span>
            <span className="text-stone-600">• Local-First Evidence Research Agent</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={handleLaunchApp} className="hover:text-stone-300 transition-colors cursor-pointer">Workspace</button>
            <button onClick={handleScrollToDownload} className="hover:text-stone-300 transition-colors cursor-pointer">Desktop Build</button>
          </div>
        </div>
      </footer>

      {/* STANDALONE DESKTOP DOWNLOAD MODAL */}
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        osType={selectedOs}
      />
    </div>
  );
}
