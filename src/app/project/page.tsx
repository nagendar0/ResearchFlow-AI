'use client';

import { Suspense } from 'react';
import ClientWorkspace from './ClientWorkspace';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-100 flex items-center justify-center text-sm text-stone-500 font-mono">Loading workspace...</div>}>
      <ClientWorkspace />
    </Suspense>
  );
}
