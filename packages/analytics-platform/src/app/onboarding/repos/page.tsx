'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReposPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to main onboarding which handles all steps
    router.push('/onboarding');
  }, []);
  
  return <div>Loading...</div>;
}
