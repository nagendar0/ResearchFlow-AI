'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, X } from 'lucide-react';

interface WelcomeOnboardingModalProps {
  onComplete: (name: string, label: string) => void;
}

export function WelcomeOnboardingModal({ onComplete }: WelcomeOnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [workspaceLabel, setWorkspaceLabel] = useState('Personal workspace');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isOnboarded = localStorage.getItem('rf_onboarded');
      const savedName = localStorage.getItem('rf_user_name');
      if (!isOnboarded || !savedName) {
        setIsOpen(true);
      }
    }
  }, []);

  if (!isOpen) return null;

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('rf_onboarded', 'true');
    }
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = userName.trim() || 'User';
    const finalLabel = workspaceLabel.trim() || 'Personal workspace';

    if (typeof window !== 'undefined') {
      localStorage.setItem('rf_user_name', finalName);
      localStorage.setItem('rf_workspace_label', finalLabel);
      localStorage.setItem('rf_onboarded', 'true');
    }

    setIsOpen(false);
    onComplete(finalName, finalLabel);
  };

  const initials = (userName.trim() || 'User')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden relative">
        {/* Top Decorative Banner */}
        <div className="bg-gradient-to-r from-[#174f3c] via-[#123e2f] to-stone-900 p-8 text-white text-center relative overflow-hidden">
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-stone-300 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>

          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-[#d9f57a] font-bold text-xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            {initials}
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono mb-2">
            <Sparkles size={12} className="animate-pulse" /> FIRST-TIME SETUP
          </div>

          <h2 className="font-serif font-bold text-2xl text-white tracking-tight">Welcome to ResearchFlow AI</h2>
          <p className="text-xs text-stone-300 mt-1 max-w-xs mx-auto">Set up your local research identity to personalize your evidence workspace</p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-5">
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              What is your name?
            </label>
            <input
              type="text"
              required
              autoFocus
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#174f3c]/20 focus:border-[#174f3c] transition-all"
              placeholder="e.g. Alex Miller"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
              Workspace Label
            </label>
            <input
              type="text"
              value={workspaceLabel}
              onChange={(e) => setWorkspaceLabel(e.target.value)}
              className="w-full px-4 py-3 text-sm border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#174f3c]/20 focus:border-[#174f3c] transition-all"
              placeholder="e.g. Personal workspace"
            />
          </div>

          {/* Privacy Guarantee Note */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#174f3c]">
              <ShieldCheck size={14} /> 100% On-Device Privacy Guarantee
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Your name and research data are stored strictly on your local device. Zero accounts, cloud databases, or tracking.
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-[#174f3c] text-white font-bold text-sm rounded-xl hover:bg-[#123e2f] transition-all shadow-md shadow-[#174f3c]/20 flex items-center justify-center gap-2 group cursor-pointer"
            >
              Get Started <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-xs text-stone-500 hover:text-stone-800 transition-colors cursor-pointer text-center"
            >
              Skip setup for now
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
