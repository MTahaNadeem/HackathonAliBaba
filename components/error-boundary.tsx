'use client';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CourseCompass caught an unhandled UI error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary-wrapper" role="alert">
          <div className="error-boundary-card">
            <div className="icon-circle">
              <AlertTriangle size={28} />
            </div>
            <h2>Something went wrong</h2>
            <p>
              We encountered an unexpected issue while displaying this page. Your saved preferences
              and plans remain secure.
            </p>
            <div className="error-boundary-actions">
              <button
                type="button"
                className="button blue"
                onClick={this.handleReset}
              >
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
    return this.props.children;
  }
}
