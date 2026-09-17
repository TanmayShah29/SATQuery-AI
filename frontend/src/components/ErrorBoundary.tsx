/**
 * Per-studio ErrorBoundary — Agent C (C-6)
 */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  studioName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const label = this.props.studioName ? `:${this.props.studioName}` : '';
    console.error(`[ErrorBoundary${label}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="text-yellow-500 mb-4" size={48} aria-hidden="true" />
          <h3 className="text-lg font-semibold mb-2 text-white">Something went wrong</h3>
          <p className="text-gray-400 mb-4 max-w-sm">
            {this.props.studioName
              ? `The ${this.props.studioName} studio encountered an error.`
              : 'An unexpected error occurred.'}
          </p>
          {this.state.error && (
            <pre className="text-xs text-gray-600 mb-4 max-w-full overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors text-white text-sm"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
