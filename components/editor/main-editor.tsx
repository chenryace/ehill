import { FC, memo, useCallback } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';
import EditorState from 'libs/web/state/editor';
import UIState from 'libs/web/state/ui';
import EditTitle from './edit-title';
import SaveButton from './save-button';
import ErrorBoundary from '../error-boundary';
import Editor, { EditorProps } from './editor';
import Backlinks from 'components/backlinks';
import { useToast } from 'libs/web/hooks/use-toast';
 
// MainEditor组件接口定义
interface MainEditorProps extends Partial<EditorProps> {
    note?: NoteModel;
    isPreview?: boolean;
    className?: string;
}

const MainEditor: FC<MainEditorProps> = memo(({ className, note, isPreview, ...props }) => {
    const {
        settings: { settings },
    } = UIState.useContainer();
    const toast = useToast();

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
            editorWidthClass = 'max-w-4xl md:max-w-full md:mx-20';
            break;
        default:
            editorWidthClass = 'max-w-prose'; // 默认值
            break;
    }

    const articleClassName =
        className || `pt-16 md:pt-40 px-6 m-auto h-full ${editorWidthClass}`;

    // 错误处理回调
    const handleEditorError = useCallback((error: Error) => {
        console.error('编辑器组件发生错误:', error);
        toast('编辑器加载失败，请刷新页面重试', 'error');
    }, [toast]);

    // 编辑器错误降级UI
    const EditorErrorFallback = useCallback(() => (
        <div className="p-5 m-5 border border-red-300 rounded bg-red-50">
            <h3 className="text-xl font-medium text-red-800">编辑器加载出错</h3>
            <p className="mt-2 text-red-700">抱歉，编辑器内容加载时出现了问题。</p>
            <p className="mt-1 text-red-700">请尝试刷新页面，或返回上一页。</p>
            <button 
                onClick={() => window.location.reload()} 
                className="mt-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
                刷新页面
            </button>
        </div>
    ), []);

    return (
        <EditorState.Provider initialState={note}>
            <ErrorBoundary 
              onError={handleEditorError}
              fallback={<EditorErrorFallback />}
            >
              <article className={articleClassName}>
                  <div className="flex justify-between items-center mb-4">
                      <EditTitle readOnly={props.readOnly} />
                      <div className="flex-shrink-0">
                          <SaveButton />
                      </div>
                  </div>
                  <Editor isPreview={isPreview} readOnly={props.readOnly} {...props} />
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
