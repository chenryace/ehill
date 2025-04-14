import dynamic from 'next/dynamic';
import { FC, memo } from 'react';
import { NoteModel } from 'libs/shared/note';
import { EDITOR_SIZE } from 'libs/shared/meta';
import EditorState from 'libs/web/state/editor';
import UIState from 'libs/web/state/ui';
import EditTitle from './edit-title';
import SaveButton from './save-button';
import { EditorProps } from './editor';

// 使用动态导入和React.memo优化性能
const Editor = dynamic(() => import('./editor'), { ssr: false });
const Backlinks = dynamic(() => import('./backlinks'), { 
  ssr: false,
  loading: () => <div className="mt-8 text-gray-400">加载反向链接...</div>
});

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

    return (
        <EditorState.Provider initialState={note}>
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
        </EditorState.Provider>
    );
});

// 添加显示名称以便于调试
MainEditor.displayName = 'MainEditor';

export default MainEditor;
