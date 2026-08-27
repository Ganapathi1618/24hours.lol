'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Keeps one failing widget (the stats bar, the board) from taking the whole
 * page down. Render errors are logged once and replaced with the fallback.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ui] render error', error, info.componentStack);
  }

  override render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
