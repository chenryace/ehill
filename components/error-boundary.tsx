import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 增强版错误边界组件
 * 捕获子组件中的JavaScript错误，并显示备用UI
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 更新状态，下次渲染时显示备用UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 记录错误信息
    console.error('ErrorBoundary捕获到错误:', error, errorInfo);
    
    // 调用错误处理回调
    if (this.props.onError) {
      this.props.onError(error);
    }
    
    // 可以在这里添加错误上报逻辑
    // reportError(error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // 显示备用UI
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
