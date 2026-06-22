import { Component, ErrorInfo, ReactNode } from 'react';
import SystemErrorFallback from './SystemErrorFallback';
import { toast } from 'sonner';
import { auditService } from '@/shared/services/auditService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    const reasonMsg = event.reason instanceof Error ? event.reason.message : String(event.reason);
    toast.error(`System Connection Issue: ${reasonMsg}`, {
      duration: 5000,
    });
    
    // Log promise failure silently
    auditService.log('promise_rejection', 'system', 'unhandled_rejection', null, {
      message: reasonMsg,
      stack: event.reason instanceof Error ? event.reason.stack : undefined
    });
  };

  public componentDidMount() {
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log crash details in database audit trail using auditService
    auditService.log('crash_exception', 'system', 'react_boundary', null, {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  private resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SystemErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
