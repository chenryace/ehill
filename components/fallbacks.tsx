import React from 'react';
 
 interface FallbackProps {
   error?: Error;
   resetErrorBoundary?: () => void;
 }
 
 /**
  * 编辑器降级UI组件
  * 当编辑器加载失败时显示
  */
 export const EditorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
   <div className="editor-fallback">
     <h3>编辑器加载出错</h3>
     <p>抱歉，编辑器内容加载时出现了问题。这可能是由于内容过大或网络问题导致的。</p>
     {error && (
       <div className="error-details">
         <p className="error-message">{error.message}</p>
       </div>
     )}
     {resetErrorBoundary && (
       <button 
         onClick={resetErrorBoundary}
         className="retry-button"
       >
         重试加载
       </button>
     )}
     <p>您也可以尝试刷新页面，或返回上一页。</p>
     <style jsx>{`
       .editor-fallback {
         padding: 20px;
         margin: 20px 0;
         border: 1px solid #e0e0e0;
         border-radius: 4px;
         background-color: #f8f9fa;
         text-align: center;
       }
       
       .error-details {
         margin: 15px 0;
         padding: 10px;
         background-color: #fff0f0;
         border-radius: 4px;
         border-left: 3px solid #ff6b6b;
       }
       
       .error-message {
         font-family: monospace;
         color: #d63031;
       }
       
       .retry-button {
         background-color: #3498db;
         color: white;
         border: none;
         padding: 8px 16px;
         border-radius: 4px;
         cursor: pointer;
         margin: 10px 0;
         font-weight: bold;
       }
       
       .retry-button:hover {
         background-color: #2980b9;
       }
     `}</style>
   </div>
 );
 
 /**
  * 笔记加载降级UI组件
  * 当笔记数据加载失败时显示
  */
 export const NoteFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
   <div className="note-fallback">
     <h3>笔记加载出错</h3>
     <p>抱歉，无法加载笔记内容。这可能是由于网络问题或数据库连接问题导致的。</p>
     {error && (
       <div className="error-details">
         <p className="error-message">{error.message}</p>
       </div>
     )}
     {resetErrorBoundary && (
       <button 
         onClick={resetErrorBoundary}
         className="retry-button"
       >
         重试加载
       </button>
     )}
     <style jsx>{`
       .note-fallback {
         padding: 20px;
         margin: 20px auto;
         max-width: 600px;
         border: 1px solid #e0e0e0;
         border-radius: 4px;
         background-color: #f8f9fa;
         text-align: center;
       }
       
       .error-details {
         margin: 15px 0;
         padding: 10px;
         background-color: #fff0f0;
         border-radius: 4px;
         border-left: 3px solid #ff6b6b;
       }
       
       .error-message {
         font-family: monospace;
         color: #d63031;
       }
       
       .retry-button {
         background-color: #3498db;
         color: white;
         border: none;
         padding: 8px 16px;
         border-radius: 4px;
         cursor: pointer;
         margin: 10px 0;
         font-weight: bold;
       }
       
       .retry-button:hover {
         background-color: #2980b9;
       }
     `}</style>
   </div>
 );
 
 /**
  * 应用全局降级UI组件
  * 当应用发生严重错误时显示
  */
 export const AppFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
   <div className="app-fallback">
     <div className="fallback-container">
       <h2>应用发生错误</h2>
       <p>抱歉，应用程序遇到了意外错误。我们的团队已经收到通知，并将尽快修复。</p>
       {error && (
         <div className="error-details">
           <p className="error-message">{error.message}</p>
         </div>
       )}
       {resetErrorBoundary && (
         <button 
           onClick={resetErrorBoundary}
           className="retry-button"
         >
           重新加载应用
         </button>
       )}
       <p>您也可以尝试刷新页面或稍后再试。</p>
     </div>
     <style jsx>{`
       .app-fallback {
         display: flex;
         justify-content: center;
         align-items: center;
         min-height: 100vh;
         background-color: #f8f9fa;
         padding: 20px;
       }
       
       .fallback-container {
         max-width: 600px;
         padding: 30px;
         background-color: white;
         border-radius: 8px;
         box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
         text-align: center;
       }
       
       .error-details {
         margin: 20px 0;
         padding: 15px;
         background-color: #fff0f0;
         border-radius: 4px;
         border-left: 3px solid #ff6b6b;
         text-align: left;
       }
       
       .error-message {
         font-family: monospace;
         color: #d63031;
         word-break: break-word;
       }
       
       .retry-button {
         background-color: #3498db;
         color: white;
         border: none;
         padding: 10px 20px;
         border-radius: 4px;
         cursor: pointer;
         margin: 15px 0;
         font-weight: bold;
         font-size: 16px;
       }
       
       .retry-button:hover {
         background-color: #2980b9;
       }
     `}</style>
   </div>
 );
 
 export default {
   EditorFallback,
   NoteFallback,
   AppFallback
 };