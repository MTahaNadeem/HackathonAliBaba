'use client';
import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('CourseCompass App Router Error:', error);
  }, [error]);

  return (
    <div className="error-boundary-wrapper" role="alert">
      <div className="error-boundary-card">
        <div className="icon-circle">
          <AlertTriangle size={28} />
        </div>
        <h2>Something went wrong</h2>
        <p>
          We encountered an unexpected issue while loading CourseCompass AI. Your saved data is
          secure.
        </p>
        <div className="error-boundary-actions">
          <button type="button" className="button blue" onClick={() => reset()}>
            <RotateCcw size={16} /> Try again
          </button>
          <button
            type="button"
            className="button outline"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.hash = 'dashboard';
                window.location.reload();
              }
            }}
          >
            <Home size={16} /> Return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
