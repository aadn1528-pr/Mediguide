import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MediGuide AI ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      let displayMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed && parsed.error) {
          displayMsg = `Database ${parsed.operationType || 'operation'} issue (${parsed.path || 'unknown'}): ${parsed.error}`;
        }
      } catch {
        // Non-JSON error message; display as-is
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Something went wrong
                </h2>
                <p className="text-xs text-slate-500">
                  MediGuide AI encountered an unexpected issue
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 break-words">
              {displayMsg}
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Reload Interface</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
