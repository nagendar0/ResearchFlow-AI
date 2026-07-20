'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Laptop, ShieldCheck, Check, Copy } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  osType?: 'windows' | 'mac' | 'linux' | 'all';
}

export function DownloadModal({ isOpen, onClose, osType = 'all' }: DownloadModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleLaunchOrInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch {}
    }
    // Navigate directly to the application workspace (where onboarding asks for name)
    window.location.href = '/workspace';
  };

  const handleDownloadZip = () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/nagendar0/ResearchFlow-AI/archive/refs/heads/main.zip';
    link.download = 'ResearchFlow-AI-Desktop.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyGitCommand = () => {
    navigator.clipboard.writeText('git clone https://github.com/nagendar0/ResearchFlow-AI.git');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getOsTitle = () => {
    if (osType === 'windows') return 'Windows 10 / 11 Desktop Build';
    if (osType === 'mac') return 'macOS Apple Silicon & Intel Build';
    if (osType === 'linux') return 'Linux AppImage / .deb Build';
    return 'Desktop Application Package';
  };

  const getOsBadge = () => {
    if (osType === 'windows') return '🪟 WINDOWS BUILD';
    if (osType === 'mac') return '🍎 macOS BUILD';
    if (osType === 'linux') return '🐧 LINUX BUILD';
    return '💻 STANDALONE DESKTOP APPLICATION';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#174f3c] via-[#123e2f] to-stone-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-stone-300 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono mb-2">
            <Laptop size={12} /> {getOsBadge()}
          </div>

          <h3 className="font-serif font-bold text-2xl text-white">{getOsTitle()}</h3>
          <p className="text-xs text-stone-300 mt-1">100% Local-First • Zero Cloud Tracking • On-Device Storage</p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Option 1: Launch & Install Desktop App */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase bg-[#174f3c] text-[#d9f57a] px-2 py-0.5 rounded font-bold">
                  RECOMMENDED • 1-CLICK LAUNCH
                </span>
                <h4 className="font-serif font-bold text-lg text-stone-900 mt-1.5">
                  Launch Local Desktop Application
                </h4>
              </div>
              <Laptop className="text-[#174f3c] shrink-0" size={24} />
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Launches ResearchFlow AI on your desktop. First-time launch will prompt you to set your research username and workspace label.
            </p>

            <button
              onClick={handleLaunchOrInstallApp}
              className="w-full py-3 px-4 bg-[#174f3c] text-white font-bold text-xs rounded-xl hover:bg-[#123e2f] transition-all shadow-md shadow-[#174f3c]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={14} className="text-[#d9f57a]" /> 
              {isInstalled ? 'Open Desktop App Workspace →' : 'Launch Application & Set Up Username →'}
            </button>
          </div>

          {/* Option 2: Download Full ZIP Package */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-bold">
                  OPTION 2 • DIRECT ZIP DOWNLOAD
                </span>
                <h4 className="font-serif font-bold text-base text-stone-900 mt-1.5">
                  Download Application Package (.zip)
                </h4>
              </div>
              <Download className="text-stone-600 shrink-0" size={20} />
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Download the complete standalone ResearchFlow AI source package directly to your local drive.
            </p>

            <button
              onClick={handleDownloadZip}
              className="w-full py-2.5 px-4 bg-stone-900 text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={14} className="text-emerald-400" /> Download Application (.zip)
            </button>
          </div>

          {/* Option 3: Git Clone Command */}
          <div className="bg-stone-900 text-stone-200 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">OPTION 3 • GIT CLONE REPOSITORY</span>
              <button
                onClick={handleCopyGitCommand}
                className="text-[11px] text-stone-300 hover:text-white flex items-center gap-1 font-mono bg-stone-800 px-2 py-1 rounded cursor-pointer"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy Command'}
              </button>
            </div>
            <code className="block font-mono text-[11px] bg-stone-950 text-stone-300 p-2.5 rounded-lg overflow-x-auto border border-stone-800">
              git clone https://github.com/nagendar0/ResearchFlow-AI.git
            </code>
          </div>

          {/* GitHub Link */}
          <div className="pt-2 flex justify-between items-center border-t border-stone-200 text-xs">
            <span className="text-stone-500 font-medium flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#174f3c]" /> Open-Source Repository
            </span>
            <a
              href="https://github.com/nagendar0/ResearchFlow-AI"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#174f3c] font-bold hover:underline flex items-center gap-1"
            >
              View Repository on GitHub →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
