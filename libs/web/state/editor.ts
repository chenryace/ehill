import NoteState from 'libs/web/state/note';
import { useRouter } from 'next/router';
import {
    useCallback,
    MouseEvent as ReactMouseEvent,
    useState,
    useRef,
    useEffect, 
} from 'react';
import { searchNote, searchRangeText } from 'libs/web/utils/search';
import useFetcher from 'libs/web/api/fetcher';
import { NOTE_DELETED } from 'libs/shared/meta';
import { isNoteLink, NoteModel } from 'libs/shared/note';
import { useToast } from 'libs/web/hooks/use-toast';
import PortalState from 'libs/web/state/portal';
import { NoteCacheItem } from 'libs/web/cache';
import noteCache from 'libs/web/cache/note';
import { createContainer } from 'unstated-next';
import MarkdownEditor from '@notea/rich-markdown-editor';
import { useDebouncedCallback } from 'use-debounce';
import { ROOT_ID } from 'libs/shared/tree';
import { has } from 'lodash';
import UIState from './ui';

const onSearchLink = async (keyword: string) => {
    const list = await searchNote(keyword, NOTE_DELETED.NORMAL);

    return list.map((item) => ({
        title: item.title,
        // todo 路径
        subtitle: searchRangeText({
            text: item.rawContent || '',
            keyword,
            maxLen: 40,
        }).match,
        url: `/${item.id}`,
    }));
};

const useEditor = (initNote?: NoteModel) => {
    const {
        createNoteWithTitle,
        updateNote,
        createNote,
        note: noteProp,
    } = NoteState.useContainer();
    const note = initNote ?? noteProp;
    const {
        ua: { isBrowser },
    } = UIState.useContainer();
    const router = useRouter();
    const { request, error } = useFetcher();
    const toast = useToast();
    const editorEl = useRef<MarkdownEditor>(null);
    
    // 添加编辑模式状态
    const [isEditing, setIsEditing] = useState(false);
    // 添加当前内容状态
    const [currentContent, setCurrentContent] = useState<string>('');
    // 添加保存状态
    const [isSaving, setIsSaving] = useState(false);

    const onNoteChange = useDebouncedCallback(
        async (data: Partial<NoteModel>) => {
            try {
                setIsSaving(true);
                const isNew = has(router.query, 'new');

                if (isNew) {
                    data.pid = (router.query.pid as string) || ROOT_ID;
                    const item = await createNote({ ...note, ...data });
                    const noteUrl = `/${item?.id}`;

                    if (router.asPath !== noteUrl) {
                        await router.replace(noteUrl, undefined, { shallow: true });
                    }
                    
                    // 成功创建笔记后显示提示
                    toast('笔记创建成功', 'success');
                } else {
                    await updateNote(data);
                    // 成功更新笔记后显示提示
                    toast('笔记保存成功', 'success');
                }
            } catch (err) {
                console.error('保存笔记时出错:', err);
                toast('保存失败，请重试', 'error');
                
                // 如果是网络错误，提供更具体的提示
                if (err instanceof Error) {
                    if (err.message.includes('network') || err.message.includes('fetch')) {
                        toast('网络连接错误，请检查您的网络连接', 'error');
                    } else if (err.message.includes('timeout')) {
                        toast('请求超时，服务器可能繁忙', 'error');
                    }
                }
            } finally {
                setIsSaving(false);
            }
        },
        500
    );

    const onCreateLink = useCallback(
        async (title: string) => {
            try {
                const result = await createNoteWithTitle(title);

                if (!result) {
                    toast('创建链接失败', 'error');
                    throw new Error('创建链接失败');
                }

                return `/${result.id}`;
            } catch (err) {
                console.error('创建链接时出错:', err);
                toast('创建链接失败，请重试', 'error');
                throw err;
            }
        },
        [createNoteWithTitle, toast]
    );

    const onClickLink = useCallback(
        (href: string) => {
            try {
                if (isNoteLink(href.replace(location.origin, ''))) {
                    router.push(href, undefined, { shallow: true })
                        .catch((err) => {
                            console.error('导航到链接时出错:', err);
                            toast('导航失败，请重试', 'error');
                        });
                } else {
                    window.open(href, '_blank');
                }
            } catch (err) {
                console.error('处理链接点击时出错:', err);
                toast('无法打开链接', 'error');
            }
        },
        [router, toast]
    );

    const onUploadImage = useCallback(
        async (file: File, id?: string) => {
            try {
                const data = new FormData();
                data.append('file', file);
                
                // 显示上传中提示
                toast('正在上传图片...', 'info');
                
                const result = await request<FormData, { url: string }>(
                    {
                        method: 'POST',
                        url: `/api/upload?id=${id}`,
                    },
                    data
                );
                
                if (!result) {
                    toast(error || '上传图片失败', 'error');
                    throw Error(error || '上传图片失败');
                }
                
                // 上传成功提示
                toast('图片上传成功', 'success');
                return result.url;
            } catch (err) {
                console.error('上传图片时出错:', err);
                toast('上传图片失败，请重试', 'error');
                throw err;
            }
        },
        [error, request, toast]
    );

    const { preview, linkToolbar } = PortalState.useContainer();

    const onHoverLink = useCallback(
        (event: MouseEvent | ReactMouseEvent) => {
            try {
                if (!isBrowser || editorEl.current?.props.readOnly) {
                    return true;
                }
                const link = event.target as HTMLLinkElement;
                const href = link.getAttribute('href');
                if (link.classList.contains('bookmark')) {
                    return true;
                }
                if (href) {
                    if (isNoteLink(href)) {
                        preview.close();
                        preview.setData({ id: href.slice(1) });
                        preview.setAnchor(link);
                    } else {
                        linkToolbar.setData({ href, view: editorEl.current?.view });
                        linkToolbar.setAnchor(link);
                    }
                } else {
                    preview.setData({ id: undefined });
                }
                return true;
            } catch (err) {
                console.error('处理链接悬停时出错:', err);
                return true; // 即使出错也返回true以允许默认行为
            }
        },
        [isBrowser, preview, linkToolbar]
    );

    const [backlinks, setBackLinks] = useState<NoteCacheItem[]>();

    const getBackLinks = useCallback(async () => {
        try {
            if (!note?.id) {
                setBackLinks([]);
                return;
            }
            
            setBackLinks([]);
            const linkNotes: NoteCacheItem[] = [];
            
            await noteCache.iterate<NoteCacheItem, void>((value) => {
                if (value.linkIds?.includes(note.id)) {
                    linkNotes.push(value);
                }
            });
            
            setBackLinks(linkNotes);
        } catch (err) {
            console.error('获取反向链接时出错:', err);
            // 即使出错也设置为空数组，避免UI显示问题
            setBackLinks([]);
        }
    }, [note?.id]);

    const onEditorChange = useCallback(
        (value: () => string): void => {
            try {
                // 更新当前内容
                const content = value();
                setCurrentContent(content);
                
                // 只有在编辑模式下才更新内容
                if (isEditing) {
                    // 添加日志以便调试
                    console.log('保存内容:', content.substring(0, 50) + '...');
                    
                    onNoteChange.callback({ content })
                        .catch((err) => {
                            console.error('保存笔记时出错:', err);
                            toast('保存失败，请重试', 'error');
                        });
                }
            } catch (err) {
                console.error('处理编辑器内容变更时出错:', err);
                toast('处理内容变更失败', 'error');
            }
        },
        [onNoteChange, isEditing, toast]
    );

    // 添加初始内容加载
    useEffect(() => {
        if (note?.content) {
            setCurrentContent(note.content);
        }
    }, [note?.content]);

    // 检查是否为新建笔记，如果是则默认进入编辑模式
    useEffect(() => {
        const isNew = has(router.query, 'new');
        if (isNew) {
            setIsEditing(true);
        }
    }, [router.query]);
    
    // 添加未保存内容提示
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isEditing && currentContent !== note?.content) {
                const message = '您有未保存的更改，确定要离开吗？';
                e.returnValue = message;
                return message;
            }
        };
    
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isEditing, currentContent, note?.content]);

    // 添加手动保存方法
    const saveNote = useCallback(async () => {
        if (!currentContent) return;
        
        try {
            setIsSaving(true);
            toast('正在保存...', 'info');
            
            await onNoteChange.callback({ content: currentContent });
            
            toast('笔记已保存', 'success');
            setIsEditing(false);
        } catch (err) {
            console.error('手动保存笔记时出错:', err);
            toast('保存失败，请重试', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [currentContent, onNoteChange, toast]);

    // 切换编辑模式的方法
    const toggleEditMode = useCallback(() => {
        setIsEditing((prev) => !prev);
    }, []);

    return {
        onCreateLink,
        onSearchLink,
        onClickLink,
        onUploadImage,
        onHoverLink,
        getBackLinks,
        onEditorChange,
        onNoteChange,
        backlinks,
        editorEl,
        note,
        saveNote,
        toggleEditMode,
        isEditing,
        setIsEditing,
        currentContent,
        isSaving
    };
};

// 使用原始方式创建容器，不显式指定类型参数
const EditorState = createContainer(useEditor);

// 为了解决TypeScript类型错误，扩展EditorState的类型
declare module 'unstated-next' {
    interface ContainerType<State, Initializers extends unknown[]> {
        Provider: React.FC<{
            initialState?: Initializers[0];
            children: React.ReactNode;
        }>;
        useContainer: () => State;
    }
}

export default EditorState;
