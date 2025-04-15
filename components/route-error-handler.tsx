import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * 简化版路由错误处理组件
 * 仅记录路由错误，不干预正常的路由行为
 */
const RouteErrorHandler = () => {
  const router = useRouter();

  useEffect(() => {
    // 路由错误处理函数
    const handleRouteError = (error: Error) => {
      // 检查是否为路由取消错误
      if (
        error.message?.includes('Route Cancelled') ||
        error.message?.includes('Cancel rendering route') ||
        error.message?.includes('Loading initial props cancelled')
      ) {
        // 仅记录警告，不干预事件传播
        console.warn('路由导航已取消，这是正常行为，不影响应用功能:', error.message);
      } else {
        // 对于其他类型的错误，记录但不阻止传播
        console.error('路由错误:', error);
      }
      
      // 返回false表示不阻止错误继续传播
      return false;
    };

    // 添加路由错误事件监听器
    if (router.events) {
      router.events.on('routeChangeError', handleRouteError);
    }

    // 清理函数
    return () => {
      // 移除路由错误事件监听器
      if (router.events) {
        router.events.off('routeChangeError', handleRouteError);
      }
    };
  }, [router]);

  // 这个组件不渲染任何内容
  return null;
};

export default RouteErrorHandler;
