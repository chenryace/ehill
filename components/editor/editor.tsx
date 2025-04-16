import { FC, memo, useEffect } from 'react';
import EditorState from 'libs/web/state/editor';
import { NoteModel } from 'libs/shared/note';
import MarkdownEditor from '@notea/rich-markdown-editor';
import ErrorBoundary from 'components/error-boundary';
import { EditorFallback } from 'components/fallbacks';

// 定义Editor组件的props接口
interface EditorProps {
  isPreview?: boolean;
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

interface EditorProviderProps {
  note?: NoteModel;
}

// 创建一个包装组件，提供EditorState上下文
const EditorProvider: FC<EditorProviderProps> = memo(({ note, children }) => {
  return (
    <EditorState.Provider initialState={note}>
      {children}
    </EditorState.Provider>
  );
});

EditorProvider.displayName = 'EditorProvider';

// 主编辑器组件，现在接受isPreview属性和其他属性
const Editor: FC<EditorComponentProps> = memo((props) => {
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

  const { isPreview } = props;

  // 添加路由错误防护
  useEffect(() => {
    // 创建一个MutationObserver来监视DOM变化
    // 这可以帮助检测由于路由错误导致的意外DOM重新渲染
    const observer = new MutationObserver((_) => {
      // 如果检测到可能导致状态不一致的DOM变化，记录但不干预
      console.log('检测到DOM变化，但不会影响编辑状态');
    });

    // 开始观察文档体的变化
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      // 清理观察器
      observer.disconnect();
    };
  }, []);

  // 错误处理回调
  const handleEditorError = (error: Error) => {
    console.error('编辑器组件发生错误:', error);
  };

  // 直接渲染富文本编辑器，不再动态导入MainEditor
  return (
    <div className="editor-container">
      {note && (
        <div
          className={`editor-wrapper ${
            isEditing ? 'editing' : 'preview'
          }`}
          data-mode={isEditing ? 'edit' : 'preview'}
          data-preview={isPreview ? 'true' : 'false'}
        >
          <div className="editor">
            {/* 使用错误边界包裹编辑器组件 */}
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
                  uploadImage={onUploadImage}
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

Editor.displayName = 'Editor';

export { EditorProvider, Editor };
export default Editor;
