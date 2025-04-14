import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 错误边界组件，用于捕获子组件树中的 JavaScript 错误
 * 防止整个应用崩溃，并提供优雅的降级UI
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // 更新 state 使下一次渲染显示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
    
    // 调用可选的错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义降级UI，则使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // 默认降级UI
      return (
        <div className="error-boundary-fallback">
          <h2>页面加载出错</h2>
          <p>抱歉，加载内容时出现了问题。</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="error-reset-button"
          >
            重试
          </button>
          <style jsx>{`
            .error-boundary-fallback {
              padding: 20px;
              margin: 20px 0;
              border: 1px solid #f5c6cb;
              border-radius: 4px;
              color: #721c24;
              background-color: #f8d7da;
              text-align: center;
            }
            .error-reset-button {
              margin-top: 10px;
              padding: 8px 16px;
              background-color: #dc3545;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            }
            .error-reset-button:hover {
              background-color: #c82333;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
