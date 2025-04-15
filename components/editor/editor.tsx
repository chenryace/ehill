import { FC, memo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import EditorState from 'libs/web/state/editor';
import { NoteModel } from 'libs/shared/note';

// 动态导入编辑器组件，避免SSR问题
const DynamicMainEditor = dynamic(() => import('./main-editor'), {
  ssr: false,
});

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

// 主编辑器组件
const Editor: FC = memo(() => {
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

  return (
    <div className="editor-container">
      {note && (
        <div
          className={`editor-wrapper ${
            isEditing ? 'editing' : 'preview'
          }`}
          data-mode={isEditing ? 'edit' : 'preview'}
        >
          <div className="editor">
            <DynamicMainEditor
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
