// 创建一个全局错误处理器，用于捕获和处理Next.js路由错误
import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * 全局路由错误处理组件
 * 用于捕获和处理Next.js路由相关的错误，防止它们在控制台中显示为错误
 */
const RouteErrorHandler = () => {
  const router = useRouter();

  useEffect(() => {
    // 路由错误处理函数
    const handleRouteError = (error) => {
      // 检查是否为路由取消错误
      if (
        error.message?.includes('Route Cancelled') ||
        error.message?.includes('Cancel rendering route') ||
        error.message?.includes('Loading initial props cancelled')
      ) {
        // 将错误降级为警告，避免在控制台显示为错误
        console.warn('路由导航已取消，这是正常行为，不影响应用功能:', error.message);
        
        // 阻止错误继续传播
        error.cancelled = true;
        
        // 返回true表示错误已处理
        return true;
      }
      
      // 对于其他类型的错误，记录但不阻止传播
      console.error('路由错误:', error);
      return false;
    };

    // 添加路由错误事件监听器
    if (router.events) {
      router.events.on('routeChangeError', handleRouteError);
    }

    // 全局错误处理
    const originalErrorHandler = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
      // 检查是否为路由取消错误
      if (
        message?.includes('Route Cancelled') ||
        message?.includes('Cancel rendering route') ||
        message?.includes('Loading initial props cancelled')
      ) {
        // 将错误降级为警告
        console.warn('捕获到路由取消错误，已处理:', message);
        // 阻止错误继续传播
        return true;
      }
      
      // 对于其他错误，调用原始错误处理器
      if (originalErrorHandler) {
        return originalErrorHandler(message, source, lineno, colno, error);
      }
      return false;
    };

    // 全局Promise错误处理
    const originalUnhandledRejection = window.onunhandledrejection;
    window.onunhandledrejection = function(event) {
      const error = event.reason;
      // 检查是否为路由取消错误
      if (
        error?.message?.includes('Route Cancelled') ||
        error?.message?.includes('Cancel rendering route') ||
        error?.message?.includes('Loading initial props cancelled')
      ) {
        // 将错误降级为警告
        console.warn('捕获到未处理的路由取消Promise错误，已处理:', error.message);
        // 阻止事件继续传播
        event.preventDefault();
        return true;
      }
      
      // 对于其他未处理的Promise错误，调用原始处理器
      if (originalUnhandledRejection) {
        return originalUnhandledRejection(event);
      }
      return false;
    };

    // 清理函数
    return () => {
      // 移除路由错误事件监听器
      if (router.events) {
        router.events.off('routeChangeError', handleRouteError);
      }
      
      // 恢复原始错误处理器
      window.onerror = originalErrorHandler;
      window.onunhandledrejection = originalUnhandledRejection;
    };
  }, [router]);

  // 这个组件不渲染任何内容
  return null;
};

export default RouteErrorHandler;
