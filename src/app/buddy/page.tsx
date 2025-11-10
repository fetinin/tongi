'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BuddyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings/buddy');
  }, [router]);

  return null;
}
