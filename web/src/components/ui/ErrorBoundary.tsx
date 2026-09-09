import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in PRANA UI:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-vanilla border-2 border-ink-black rounded-xl p-6 shadow-[5px_5px_0px_#18181B] text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-error/15 text-error border border-error">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <h2 className="font-headline-sm text-xl font-bold text-ink-black">
              Telemetry Display Interrupted
            </h2>
            <p className="text-sm text-ink-muted">
              An unexpected rendering error occurred in this view. The system caught the fault safely.
            </p>
            {this.state.error && (
              <div className="p-3 bg-surface-vanilla-strong/80 rounded border border-outline-variant/60 text-left font-mono text-xs text-ink-muted overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="pt-2">
              <Button
                variant="primary"
                onClick={this.handleReset}
                leftIcon={<RotateCcw className="w-4 h-4 mr-1" />}
              >
                Reload Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
