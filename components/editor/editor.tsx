import { FC, useEffect, useState, useCallback, memo, useRef } from 'react';
import { use100vh } from 'react-div-100vh';
import MarkdownEditor, { Props } from '@notea/rich-markdown-editor';
import { useEditorTheme } from './theme';
import useMounted from 'libs/web/hooks/use-mounted';
import Tooltip from './tooltip';
import extensions from './extensions';
import EditorState from 'libs/web/state/editor';
import { useToast } from 'libs/web/hooks/use-toast';
import { useDictionary } from './dictionary';
import { useEmbeds } from './embeds';
import { useHotkeys } from 'react-hotkeys-hook';

export interface EditorProps extends Pick<Props, 'readOnly'> {
    isPreview?: boolean;
}

const Editor: FC<EditorProps> = memo(({ readOnly: propReadOnly, isPreview }) => {
    const {
        onSearchLink,
        onCreateLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        onEditorChange,
        backlinks,
        editorEl,
        note,
        isEditing,
        toggleEditMode,
        saveNote,
        isSaving,
    } = EditorState.useContainer();
    
    // 首先定义editorReadOnly变量
    const editorReadOnly = propReadOnly || !isEditing;
    
    // 然后再使用它来定义editorClassName
    const editorClassName = `px-4 md:px-0 ${editorReadOnly ? 'editor-readonly' : ''} ${isSaving ? 'editor-saving' : ''}`;
    
    const height = use100vh();
    const mounted = useMounted();
    const editorTheme = useEditorTheme();
    const [hasMinHeight, setHasMinHeight] = useState(true);
    const toast = useToast();
    const dictionary = useDictionary();
    const embeds = useEmbeds();
    
    // 添加编辑状态指示器
    const [showEditingIndicator, setShowEditingIndicator] = useState(false);
    
    // 防止滚动触发编辑模式的标志
    const isScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // 显示编辑状态指示器
    useEffect(() => {
        if (isEditing) {
            setShowEditingIndicator(true);
            const timer = setTimeout(() => {
                setShowEditingIndicator(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [isEditing]);
    
    // 添加键盘快捷键
    useHotkeys('ctrl+s, cmd+s', (e) => {
        e.preventDefault();
        if (isEditing) {
            saveNote?.();
        }
    }, { enableOnTags: ['INPUT', 'TEXTAREA', 'SELECT'] }, [isEditing, saveNote]);
    
    useHotkeys('ctrl+e, cmd+e', (e) => {
        e.preventDefault();
        toggleEditMode?.();
    }, {}, [toggleEditMode]);

    // 更新hasMinHeight状态
    useEffect(() => {
        if (isPreview) return;
        
        // 只在非滚动状态下更新hasMinHeight
        if (!isScrollingRef.current) {
            setHasMinHeight((backlinks?.length ?? 0) <= 0);
        }
    }, [backlinks, isPreview]);
    
    // 添加滚动事件监听
    useEffect(() => {
        const handleScroll = () => {
            // 设置滚动标志
            isScrollingRef.current = true;
            
            // 清除之前的定时器
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            // 设置新的定时器，滚动结束后重置标志
            scrollTimeoutRef.current = setTimeout(() => {
                isScrollingRef.current = false;
            }, 150); // 滚动结束后150ms重置标志
        };
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
        };
    }, []);

    // 使用useCallback优化事件处理函数
    const handleEditorChange = useCallback((value: () => string) => {
        // 只在非滚动状态下处理编辑器内容变更
        if (!isScrollingRef.current) {
            onEditorChange(value);
        }
    }, [onEditorChange]);
    
    return (
        <>
            {showEditingIndicator && (
                <div className="editing-indicator">
                    <span>编辑模式</span>
                </div>
            )}
            {isSaving && (
                <div className="saving-indicator">
                    <span>正在保存...</span>
                </div>
            )}
            <MarkdownEditor
                readOnly={editorReadOnly}
                id={note?.id}
                ref={editorEl}
                value={mounted ? note?.content : ''}
                onChange={handleEditorChange}
                placeholder={dictionary.editorPlaceholder}
                theme={editorTheme}
                uploadImage={useCallback((file) => onUploadImage(file, note?.id), [onUploadImage, note?.id])}
                onSearchLink={onSearchLink}
                onCreateLink={onCreateLink}
                onClickLink={onClickLink}
                onHoverLink={onHoverLink}
                onShowToast={toast}
                dictionary={dictionary}
                tooltip={Tooltip}
                extensions={extensions}
                className={editorClassName}
                embeds={embeds}
            />
            <style jsx global>{`
                .ProseMirror ul {
                    list-style-type: disc;
                }

                .ProseMirror ol {
                    list-style-type: decimal;
                }

                .ProseMirror {
                    ${hasMinHeight
                        ? `min-height: calc(${
                              height ? height + 'px' : '100vh'
                          } - 14rem);`
                        : ''}
                    padding-bottom: 10rem;
                }

                .ProseMirror h1 {
                    font-size: 2.8em;
                }
                .ProseMirror h2 {
                    font-size: 1.8em;
                }
                .ProseMirror h3 {
                    font-size: 1.5em;
                }
                .ProseMirror a:not(.bookmark) {
                    text-decoration: underline;
                }

                .ProseMirror .image .ProseMirror-selectednode img {
                    pointer-events: unset;
                }
                
                /* 添加只读模式的样式 */
                .editor-readonly .ProseMirror {
                    cursor: default !important;
                    pointer-events: auto !important;
                }
                
                /* 禁用只读模式下的编辑功能 */
                .editor-readonly .ProseMirror * {
                    caret-color: transparent;
                }
                
                /* 允许只读模式下的链接点击和滚动 */
                .editor-readonly .ProseMirror a {
                    cursor: pointer !important;
                    pointer-events: auto !important;
                }
                
                /* 编辑状态指示器样式 */
                .editing-indicator {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background-color: #2ecc71;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-weight: bold;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    animation: fadeOut 2s forwards;
                    animation-delay: 1.5s;
                }
                
                /* 保存状态指示器样式 */
                .saving-indicator {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background-color: #3498db;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    font-weight: bold;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                
                /* 保存中状态的编辑器样式 */
                .editor-saving .ProseMirror {
                    opacity: 0.8;
                    transition: opacity 0.3s ease;
                }
                
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `}</style>
        </>
    );
});

// 添加显示名称以便于调试
Editor.displayName = 'Editor';

export default Editor;
