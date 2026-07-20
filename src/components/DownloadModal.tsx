'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Laptop, ShieldCheck } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  osType?: 'windows' | 'mac' | 'linux' | 'all';
}

export function DownloadModal({ isOpen, onClose, osType = 'all' }: DownloadModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

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
          {/* Main Action: Launch & Install Desktop App */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase bg-[#174f3c] text-[#d9f57a] px-2.5 py-1 rounded-md font-bold">
                  RECOMMENDED • 1-CLICK LAUNCH
                </span>
                <h4 className="font-serif font-bold text-xl text-stone-900 mt-2">
                  Launch Desktop Application
                </h4>
              </div>
              <Laptop className="text-[#174f3c] shrink-0" size={28} />
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Launches ResearchFlow AI on your desktop. On first launch, you will set your research username and workspace label.
            </p>

            <button
              onClick={handleLaunchOrInstallApp}
              className="w-full py-3.5 px-4 bg-[#174f3c] text-white font-bold text-xs rounded-xl hover:bg-[#123e2f] transition-all shadow-md shadow-[#174f3c]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={15} className="text-[#d9f57a]" /> 
              {isInstalled ? 'Open Desktop App Workspace →' : 'Launch Application & Set Up Username →'}
            </button>
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
