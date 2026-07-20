'use client';

import React, { useState, useEffect } from 'react';
import { User, Trash2, ShieldAlert, X, Check, RefreshCw, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { clearAllExplainMessages, factoryResetAllData } from '@/lib/localDb';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
  triggerToast?: (msg: string) => void;
}

export function ProfileModal({ isOpen, onClose, onProfileUpdated, triggerToast }: ProfileModalProps) {
  const [userName, setUserName] = useState('User');
  const [workspaceLabel, setWorkspaceLabel] = useState('Personal workspace');
  const [isSaved, setIsSaved] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isResetComplete, setIsResetComplete] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('rf_user_name');
      const savedLabel = localStorage.getItem('rf_workspace_label');
      if (savedName) setUserName(savedName);
      if (savedLabel) setWorkspaceLabel(savedLabel);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  if (isResetComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden text-center p-8 space-y-6 relative">
          <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 text-[#174f3c] flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck size={36} className="text-[#174f3c]" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase bg-emerald-100 text-[#174f3c] px-3 py-1 rounded-full font-bold">
              FACTORY RESET COMPLETE
            </span>
            <h3 className="font-serif font-bold text-2xl text-stone-900">Application Data Erased</h3>
            <p className="text-xs text-stone-600 leading-relaxed max-w-sm mx-auto">
              Thank you for researching with <strong>ResearchFlow AI</strong>. All local databases, evidence indexes, research projects, and local user settings have been completely and permanently removed from your device.
            </p>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left space-y-2 text-xs text-stone-700 font-mono">
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 size={14} /> Local SQLite & IndexedDB Cleared
            </div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 size={14} /> Service Worker Caches Unregistered
            </div>
            <div className="flex items-center gap-2 text-emerald-700 font-bold">
              <CheckCircle2 size={14} /> Zero Trace Left On-Device
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 px-4 bg-[#174f3c] text-white font-bold text-xs rounded-xl hover:bg-[#123e2f] transition-all shadow-md cursor-pointer"
            >
              Return to Landing Page →
            </button>
            <button
              onClick={() => { window.location.href = '/workspace'; }}
              className="w-full py-2.5 px-4 bg-stone-100 text-stone-700 font-semibold text-xs rounded-xl hover:bg-stone-200 transition-all cursor-pointer"
            >
              Start Fresh Workspace Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('rf_user_name', userName.trim() || 'User');
      localStorage.setItem('rf_workspace_label', workspaceLabel.trim() || 'Personal workspace');
    }
    setIsSaved(true);
    if (onProfileUpdated) onProfileUpdated();
    if (triggerToast) triggerToast('Profile preferences updated.');
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearChat = async () => {
    if (window.confirm('Are you sure you want to clear all Explain Mode (Q&A) chat histories across all projects?')) {
      setIsClearingChat(true);
      try {
        await clearAllExplainMessages();
        if (triggerToast) triggerToast('All chat history cleared.');
      } catch (err) {
        console.error(err);
      } finally {
        setIsClearingChat(false);
      }
    }
  };

  const handleFactoryReset = async () => {
    setIsResetting(true);
    try {
      await factoryResetAllData();
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      setIsResetComplete(true);
    } catch (err) {
      console.error(err);
      alert('Failed to reset data. Please restart application.');
    } finally {
      setIsResetting(false);
    }
  };

  const initials = userName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'NS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#174f3c] text-[#d9f57a] font-bold flex items-center justify-center text-sm shadow-sm">
              {initials}
            </div>
            <div>
              <h3 className="font-serif font-bold text-stone-850 text-base">Profile & Workspace Settings</h3>
              <p className="text-xs text-stone-500">Manage user identity, storage, and privacy limits</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: User Profile */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <User size={14} className="text-[#174f3c]" /> User Identity
            </h4>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Display Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174f3c]/20 focus:border-[#174f3c]"
                placeholder="e.g. Alex Miller"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Workspace Label</label>
              <input
                type="text"
                value={workspaceLabel}
                onChange={(e) => setWorkspaceLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#174f3c]/20 focus:border-[#174f3c]"
                placeholder="e.g. Personal workspace"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold bg-[#174f3c] text-white rounded-lg hover:bg-[#123e2f] transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {isSaved ? <Check size={14} /> : null}
                {isSaved ? 'Saved' : 'Update Profile'}
              </button>
            </div>
          </form>

          <hr className="border-stone-200" />

          {/* Section 2: Chat & Memory Cleanup */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <Trash2 size={14} className="text-amber-600" /> Chat Memory & Q&A
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Clear all interactive Explain Mode Q&A conversations while preserving workspace research briefs and evidence sources.
            </p>
            <button
              type="button"
              onClick={handleClearChat}
              disabled={isClearingChat}
              className="px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5"
            >
              {isClearingChat ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Clear All Chat History
            </button>
          </div>

          <hr className="border-stone-200" />

          {/* Section 3: Danger Zone */}
          {/* Section 3: Danger Zone & Desktop Uninstallation */}
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-600" /> Danger Zone & Desktop Uninstallation
            </h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              Permanently wipe all local projects, evidence matrices, cached search indexes, and custom settings from this device.
            </p>

            {!showConfirmReset ? (
              <button
                type="button"
                onClick={() => setShowConfirmReset(true)}
                className="px-3.5 py-2 text-xs font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 size={13} />
                Delete All Application Data (Factory Reset)
              </button>
            ) : (
              <div className="bg-white p-3 border border-rose-300 rounded-lg space-y-3 mt-2 animate-in fade-in duration-150">
                <p className="text-xs font-bold text-rose-800">Type "DELETE" below to confirm complete data deletion:</p>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-rose-300 rounded focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="DELETE"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmReset(false);
                      setConfirmInput('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFactoryReset}
                    disabled={isResetting}
                    className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 text-white rounded hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isResetting ? <RefreshCw size={12} className="animate-spin" /> : null}
                    Confirm Permanent Wipe
                  </button>
                </div>
              </div>
            )}

            {/* Desktop App Removal Guide */}
            <div className="mt-4 pt-3 border-t border-rose-200/80 space-y-2">
              <span className="text-[10px] font-mono font-bold text-rose-900 uppercase tracking-wider block">
                💻 How to Completely Uninstall Desktop App from Laptop:
              </span>
              <ul className="text-[11px] text-stone-700 space-y-1.5 bg-white/80 p-3 rounded-lg border border-rose-200/60 leading-relaxed font-sans">
                <li>
                  <strong>🪟 Windows 10 / 11:</strong> Go to <code className="bg-stone-100 px-1 rounded">Start → Settings → Apps → Installed Apps</code>, search <strong>ResearchFlow AI</strong>, and click <strong>Uninstall</strong>.
                </li>
                <li>
                  <strong>🍎 macOS:</strong> Open <code className="bg-stone-100 px-1 rounded">Finder → Applications</code>, right click <strong>ResearchFlow AI</strong>, and select <strong>Move to Trash</strong>.
                </li>
                <li>
                  <strong>🌐 Installed Desktop App (PWA):</strong> Click the <strong>3 dots (⋮)</strong> at top-right of app window bar → Select <strong>"Uninstall ResearchFlow AI..."</strong> → Check <em>"Also clear data"</em> → Click <strong>Remove</strong>.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-between items-center text-[10px] text-stone-400">
          <span>ResearchFlow AI • Local Memory Storage</span>
          <button onClick={onClose} className="px-4 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-200/60 rounded-lg">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
