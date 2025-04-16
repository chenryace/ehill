import dynamic from 'next/dynamic';
import { FC, memo, useRef, useEffect } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';
import EditorState from 'libs/web/state/editor';
import UIState from 'libs/web/state/ui';
import EditTitle from './edit-title';
import SaveButton from './save-button';
import ErrorBoundary from '../error-boundary';
import { EditorFallback, NoteFallback } from '../fallbacks';
import MarkdownEditor from '@notea/rich-markdown-editor';

// 定义编辑器属性接口
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
  isPreview?: boolean;
}

// 动态导入反向链接组件，避免SSR问题
const Backlinks = dynamic(() => import('./backlinks'), { 
  ssr: false,
  loading: () => <div className="mt-8 text-gray-400">加载反向链接...</div>
});

// 内部编辑器内容组件
const EditorContent: FC<EditorProps> = memo((props) => {
  const {
    editorEl,
    onEditorChange,
    onCreateLink,
    onSearchLink,
    onClickLink,
    onUploadImage,
    onHoverLink,
    note,
    isEditing,
    currentContent,
  } = EditorState.useContainer();

  // 错误处理回调
  const handleEditorError = (error: Error) => {
    console.error('编辑器组件发生错误:', error);
  };

  return (
    <div className="editor-container">
      {note && (
        <div
          className={`editor-wrapper ${
            isEditing ? 'editing' : 'preview'
          }`}
          data-mode={isEditing ? 'edit' : 'preview'}
          data-preview={props.isPreview ? 'true' : 'false'}
        >
          <div className="editor">
            <ErrorBoundary 
              onError={handleEditorError}
              fallback={<EditorFallback />}
            >
              {typeof window !== 'undefined' && (
                <MarkdownEditor
                  ref={editorEl}
                  onChange={onEditorChange}
                  onCreateLink={onCreateLink}
                  onSearchLink={onSearchLink}
                  onClickLink={onClickLink}
                  onUploadImage={onUploadImage}
                  onHoverLink={onHoverLink}
                  readOnly={!isEditing}
                  defaultValue={currentContent || note.content || ''}
                  autoFocus={isEditing}
                />
              )}
            </ErrorBoundary>
          </div>
        </div>
      )}
      <style jsx>{`
        .editor-container {
          height: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .editor-wrapper {
          flex: 1;
          overflow: auto;
          transition: background-color 0.3s ease;
        }
        
        .editor-wrapper.editing {
          background-color: #ffffff;
        }
        
        .editor-wrapper.preview {
          background-color: #f9f9f9;
        }
        
        .editor {
          height: 100%;
          padding: 0 1rem;
        }
        
        @media (max-width: 640px) {
          .editor {
            padding: 0 0.5rem;
          }
        }
        
        /* 添加编辑模式和预览模式的视觉区分 */
        :global(.editing .ProseMirror) {
          border-left: 3px solid #3498db;
          padding-left: 1rem;
        }
        
        :global(.preview .ProseMirror) {
          border-left: none;
          padding-left: 0;
        }
      `}</style>
    </div>
  );
});

EditorContent.displayName = 'EditorContent';

// 主编辑器组件
const MainEditor: FC<
    EditorProps & {
        note?: NoteModel;
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
    };

    return (
        <EditorState.Provider initialState={note}>
            <ErrorBoundary 
              onError={handleEditorError}
              fallback={<NoteFallback />}
            >
              <article className={articleClassName}>
                  <div className="flex justify-between items-center mb-4">
                      <EditTitle readOnly={props.readOnly} />
                      <div className="flex-shrink-0">
                          <SaveButton />
                      </div>
                  </div>
                  <EditorContent isPreview={isPreview} {...props} />
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
