'use client';
import { useEffect, useState } from 'react';
import type { Profile } from '@/lib/domain';
import type { RecommendationResult } from '@/lib/ai/recommendation-engine';

export function recommendationProfile(profile: Profile): Profile {
  return { ...profile, name: '', resumeText: '', links: '', experience: '', projects: '', certifications: '' };
}

// Mounted once at the app level: navigation does not trigger duplicate provider requests.
export function useRecommendations(profile: Profile, enabled: boolean) {
  const key = JSON.stringify(recommendationProfile(profile));
  const [state, setState] = useState<{ key: string; result: RecommendationResult } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/recommendations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: key, signal: controller.signal,
        });
        if (!response.ok) return;
        const result = await response.json() as RecommendationResult;
        if (active && (result.source === 'qwen' || result.source === 'deterministic') && Array.isArray(result.degreeRecommendations) && Array.isArray(result.careers)) setState({ key, result });
      } catch { /* Existing local recommendations remain available. */ }
    }, 500);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [key, enabled]);
  // Never show a previous profile/journey's response, even during the debounce window.
  return enabled && state?.key === key ? state.result : undefined;
}
