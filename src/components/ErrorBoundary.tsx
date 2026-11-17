import React from 'react';

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
      message: error.message || 'An unexpected error occurred in the studio.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-[#E5E0D5] rounded-2xl p-8 space-y-4">
            <p className="text-xs font-mono uppercase tracking-wider text-[#9A3412]">
              Application Recovery
            </p>
            <h1 className="font-editorial text-2xl font-semibold text-[#161514]">
              Something interrupted the workspace
            </h1>
            <p className="text-sm text-[#57534E] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium bg-[#161514] text-white rounded-lg hover:bg-[#292524] transition-colors"
            >
              Reload Studio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
