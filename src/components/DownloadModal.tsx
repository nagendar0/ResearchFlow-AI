'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Laptop, ShieldCheck } from 'lucide-react';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  osType?: 'windows' | 'mac' | 'linux' | 'all';
}

export function DownloadModal({ isOpen, onClose }: DownloadModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!isOpen) return null;

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      // Direct file download trigger or launch local workspace
      window.location.href = '/workspace';
    }
  };

  const handleDownloadZip = () => {
    const link = document.createElement('a');
    link.href = 'https://github.com/nagendar0/ResearchFlow-AI/archive/refs/heads/main.zip';
    link.download = 'ResearchFlow-AI-Desktop.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#174f3c] via-[#123e2f] to-stone-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-stone-300 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
          >
            <X size={18} />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono mb-2">
            <Laptop size={12} /> STANDALONE DESKTOP APPLICATION
          </div>

          <h3 className="font-serif font-bold text-2xl text-white">Download ResearchFlow AI</h3>
          <p className="text-xs text-stone-300 mt-1">100% Local-First • Zero Cloud Tracking • Local On-Device Storage</p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Option 1: 1-Click Desktop App Install */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase bg-[#174f3c] text-[#d9f57a] px-2 py-0.5 rounded font-bold">
                  RECOMMENDED • 1-CLICK INSTALL
                </span>
                <h4 className="font-serif font-bold text-lg text-stone-900 mt-1.5">
                  Native Desktop App (Windows & Mac)
                </h4>
              </div>
              <Laptop className="text-[#174f3c] shrink-0" size={24} />
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Installs ResearchFlow AI as a standalone desktop app icon on your Windows or Mac desktop with offline local database storage.
            </p>

            <button
              onClick={handleInstallPWA}
              className="w-full py-3 px-4 bg-[#174f3c] text-white font-bold text-xs rounded-xl hover:bg-[#123e2f] transition-all shadow-md shadow-[#174f3c]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={14} className="text-[#d9f57a]" /> 
              {isInstalled ? 'Launch Installed Desktop App' : 'Install Standalone Desktop App'}
            </button>
          </div>

          {/* Option 2: Portable ZIP Package */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono uppercase bg-stone-200 text-stone-700 px-2 py-0.5 rounded font-bold">
                  OPTION 2 • DIRECT DOWNLOAD
                </span>
                <h4 className="font-serif font-bold text-base text-stone-900 mt-1.5">
                  Download Full Application Package (.zip)
                </h4>
              </div>
              <Download className="text-stone-600 shrink-0" size={20} />
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Download the complete ResearchFlow AI source codebase package directly to your local drive.
            </p>

            <button
              onClick={handleDownloadZip}
              className="w-full py-2.5 px-4 bg-stone-900 text-white font-bold text-xs rounded-xl hover:bg-stone-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download size={14} className="text-emerald-400" /> Download Application (.zip)
            </button>
          </div>

          {/* GitHub Repository Link */}
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
