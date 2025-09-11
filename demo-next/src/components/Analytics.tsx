// demo-next/src/components/Analytics.tsx
'use client';

import { useEffect } from 'react';
import "../aa/tracker.core";

export default function Analytics() {
  useEffect(() => {
    console.log('Analytics component mounted');
    
    // Initialize tracker here if needed
    // Check if your tracker.core.ts has an init function to call
    
  }, []);

  return null; // This component renders nothing
}