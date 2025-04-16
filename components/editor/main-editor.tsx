import dynamic from 'next/dynamic';
 import { FC, memo, useRef, useEffect } from 'react';
 import { NoteModel } from 'libs/shared/note';
 import { EDITOR_SIZE } from 'libs/shared/meta';
 import EditorState from 'libs/web/state/editor';
 import UIState from 'libs/web/state/ui';
 import EditTitle from './edit-title';
 import SaveButton from './save-button';
 import { EditorProps } from './editor';
 import ErrorBoundary from '../error-boundary';
 import MarkdownEditor from '@notea/rich-markdown-editor';
 
 // 定义编辑器属性接口，不再从editor.tsx导入
 interface EditorProps {
   onChange?: (value: () => string) => void;
   onCreateLink?: (title: string) => Promise<string>;
   onSearchLink?: (keyword: string) => Promise<any[]>;
   onClickLink?: (href: string) => void;
   onUploadImage?: (file: File, id?: string) => Promise<string>;
   onHoverLink?: (event: MouseEvent) => boolean;
   readOnly?: boolean;
   defaultValue?: string;
   autoFocus?: boolean;
   ref?: React.RefObject<MarkdownEditor>;
 }
 
 // 使用动态导入和React.memo优化性能
 const Editor = dynamic(() => import('./editor'), { ssr: false });
 const Backlinks = dynamic(() => import('./backlinks'), { 
   ssr: false,
   loading: () => <div className="mt-8 text-gray-400">加载反向链接...</div>
 });
 
 // 编辑器错误降级UI
 const EditorFallback = () => (
   <div className="editor-error-fallback">
     <h3>编辑器加载出错</h3>
     <p>抱歉，编辑器内容加载时出现了问题。这可能是由于内容过大或网络问题导致的。</p>
     <p>您可以尝试刷新页面，或返回上一页。</p>
     <style jsx>{`
       .editor-error-fallback {
         padding: 20px;
         margin: 20px 0;
         border: 1px solid #e0e0e0;
         border-radius: 4px;
         background-color: #f8f9fa;
       }
     `}</style>
   </div>
 );
 
 const MainEditor: FC<
     EditorProps & {
         note?: NoteModel;
         isPreview?: boolean;
         className?: string;
     }
 > = memo(({ className, note, isPreview, ...props }) => {
     const {
         settings: { settings },
     } = UIState.useContainer();
 
     // 使用ref跟踪当前笔记ID，仅用于调试目的
     const currentNoteIdRef = useRef<string | undefined>(note?.id);
 
     // 检查笔记ID是否变化，仅用于调试目的
     useEffect(() => {
         if (note?.id !== currentNoteIdRef.current) {
             console.log('MainEditor: 笔记ID变化:', currentNoteIdRef.current, '->', note?.id);
             currentNoteIdRef.current = note?.id;
         }
     }, [note?.id]);
 
     // 计算编辑器宽度类名
     let editorWidthClass: string;
     switch (note?.editorsize ?? settings.editorsize) {
         case EDITOR_SIZE.SMALL:
             editorWidthClass = 'max-w-prose';
             break;
         case EDITOR_SIZE.LARGE:
             editorWidthClass = 'max-w-4xl';
             break;
         case EDITOR_SIZE.AS_WIDE_AS_POSSIBLE:
             // until we reach md size, just do LARGE to have consistency
             editorWidthClass = 'max-w-4xl md:max-w-full md:mx-20';
             break;
     }
 
     const articleClassName =
         className || `pt-16 md:pt-40 px-6 m-auto h-full ${editorWidthClass}`;
 
     // 错误处理回调
     const handleEditorError = (error: Error) => {
         console.error('编辑器组件发生错误:', error);
         // 这里可以添加错误上报或其他处理逻辑
     };
 
     return (
         <EditorState.Provider initialState={note}>
             <ErrorBoundary 
               onError={handleEditorError}
               fallback={<EditorFallback />}
             >
               <article className={articleClassName}>
                   <div className="flex justify-between items-center mb-4">
                       <EditTitle readOnly={props.readOnly} />
                       <div className="flex-shrink-0">
                           <SaveButton />
                       </div>
                   </div>
                   <Editor isPreview={isPreview} {...props} />
                   {!isPreview && <Backlinks />}
               </article>
             </ErrorBoundary>
         </EditorState.Provider>
     );
 });
 
 // 添加显示名称以便于调试
 MainEditor.displayName = 'MainEditor';
 
 // 导出EditorProps接口以供其他组件使用
 export type { EditorProps };
 export default MainEditor;
