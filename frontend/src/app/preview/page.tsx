'use client';

import { Suspense } from 'react';
import PreviewContent from './PreviewContent';

export default function PreviewPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500">Loading preview…</div>}>
      <PreviewContent />
    </Suspense>
  );
}
