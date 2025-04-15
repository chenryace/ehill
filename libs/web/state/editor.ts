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

// 声明全局Window接口扩展
declare global {
    interface Window {
        __EDIT_MODE_TOGGLE__?: boolean;
    }
}

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
    // 添加当前笔记ID引用，用于跟踪笔记变化
    const currentNoteIdRef = useRef<string | undefined>(note?.id);
    // 添加内容已修改标志
    const [contentModified, setContentModified] = useState(false);

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
                
                // 重置内容修改标志
                setContentModified(false);
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
                    // 如果当前有未保存的更改，提示用户
                    if (isEditing && contentModified) {
                        const confirmLeave = window.confirm('您有未保存的更改，确定要离开吗？');
                        if (!confirmLeave) {
                            return;
                        }
                        // 用户确认离开，重置编辑状态
                        setIsEditing(false);
                        setContentModified(false);
                    }
                    
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
        [router, toast, isEditing, contentModified]
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
                // 更新当前内容，但不自动保存
                const content = value();
                setCurrentContent(content);
                
                // 检查内容是否已修改
                if (content !== note?.content) {
                    setContentModified(true);
                } else {
                    setContentModified(false);
                }
                
                // 移除自动保存逻辑，只更新内容
                console.log('内容已更新，但未自动保存');
            } catch (err) {
                console.error('处理编辑器内容变更时出错:', err);
                toast('处理内容变更失败', 'error');
            }
        },
        [note?.content, toast]
    );

    // 添加初始内容加载
    useEffect(() => {
        if (note?.content) {
            setCurrentContent(note.content);
            // 重置内容修改标志
            setContentModified(false);
        }
    }, [note?.content]);

    // 检查笔记ID是否变化，如果变化则退出编辑模式
    useEffect(() => {
        if (note?.id !== currentNoteIdRef.current) {
            // 笔记ID变化，退出编辑模式
            setIsEditing(false);
            setContentModified(false);
            // 更新当前笔记ID引用
            currentNoteIdRef.current = note?.id;
        }
    }, [note?.id]);

    // 检查是否为新建笔记，如果是则默认进入编辑模式
    useEffect(() => {
        // 创建一个标志，表示组件是否已卸载
        let isMounted = true;
        
        try {
            const isNew = has(router.query, 'new');
            
            // 只有在组件挂载状态下才更新状态
            if (isMounted) {
                if (isNew) {
                    setIsEditing(true);
                }
                // 移除自动退出编辑模式的逻辑，让编辑模式只针对当前笔记
            }
        } catch (err) {
            console.error('处理路由变化时出错:', err);
            // 出错时不改变编辑状态，保持当前状态
        }
        
        return () => {
            // 组件卸载时，更新标志
            isMounted = false;
        };
    }, [router.query]);
    
    // 添加未保存内容提示
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isEditing && contentModified) {
                const message = '您有未保存的更改，确定要离开吗？';
                e.returnValue = message;
                return message;
            }
        };
    
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isEditing, contentModified]);

    // 添加路由变化监听，处理笔记切换
    useEffect(() => {
        const handleRouteChangeStart = (_: string) => {
            // 如果当前有未保存的更改，提示用户
            if (isEditing && contentModified) {
                const confirmLeave = window.confirm('您有未保存的更改，确定要离开吗？');
                if (!confirmLeave) {
                    // 用户取消离开，阻止路由变化
                    router.events.emit('routeChangeError');
                    throw new Error('路由变化已取消');
                }
                // 用户确认离开，重置编辑状态
                setIsEditing(false);
                setContentModified(false);
            }
        };
        
        if (router.events) {
            router.events.on('routeChangeStart', handleRouteChangeStart);
        }
        
        return () => {
            if (router.events) {
                router.events.off('routeChangeStart', handleRouteChangeStart);
            }
        };
    }, [router.events, isEditing, contentModified, router]);

    // 添加手动保存方法
    const saveNote = useCallback(async () => {
        if (!currentContent) return;
        
        try {
            setIsSaving(true);
            
            await onNoteChange.callback({ content: currentContent });
            
            // 保存成功后显示通知并退出编辑模式
            toast('笔记已保存', 'success');
            setIsEditing(false);
            setContentModified(false);
        } catch (err) {
            console.error('手动保存笔记时出错:', err);
            toast('保存失败，请重试', 'error');
        } finally {
            setIsSaving(false);
        }
    }, [currentContent, onNoteChange, toast]);

    // 切换编辑模式的方法
    const toggleEditMode = useCallback(() => {
        try {
            console.log('切换编辑模式');
            
            // 切换编辑状态
            setIsEditing((prev) => !prev);
            
            // 如果从编辑模式切换到预览模式，且内容有变化，提示保存
            if (isEditing && contentModified) {
                const confirmExit = window.confirm('您有未保存的更改，确定要退出编辑模式吗？');
                if (!confirmExit) {
                    // 用户取消退出，保持编辑模式
                    setIsEditing(true);
                    return;
                }
                // 用户确认退出，重置内容修改标志
                setContentModified(false);
            }
        } catch (err) {
            console.error('切换编辑模式时出错:', err);
            toast('切换编辑模式失败', 'error');
        }
    }, [isEditing, contentModified, toast]);

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
        isSaving,
        contentModified
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
