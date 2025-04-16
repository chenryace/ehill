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

// 声明全局Window接口扩展，仅用于调试目的
declare global {
    interface Window {
        scrollTimer: NodeJS.Timeout;
    }
}

const onSearchLink = async (keyword: string) => {
    const list = await searchNote(keyword, NOTE_DELETED.NORMAL);

    return list.map((item) => ({
        title: item.title,
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
    
    // 基本状态管理
    const [isEditing, setIsEditing] = useState(false);
    const [currentContent, setCurrentContent] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [contentModified, setContentModified] = useState(false);
    
    // 防止滚动触发编辑模式的标志
    const preventScrollEditRef = useRef(false);
    
    // 笔记ID引用，用于检测笔记变化
    const currentNoteIdRef = useRef<string | undefined>(note?.id);
    
    // 初始化笔记内容
    useEffect(() => {
        if (note?.content) {
            setCurrentContent(note.content);
            setContentModified(false);
        }
    }, [note?.content]);
    
    // 检测笔记ID变化，重置编辑状态
    useEffect(() => {
        if (note?.id !== currentNoteIdRef.current) {
            console.log('笔记ID变化，重置编辑状态:', currentNoteIdRef.current, '->', note?.id);
            
            // 笔记ID变化，重置编辑状态
            setIsEditing(false);
            setContentModified(false);
            
            // 设置防滚动标志，防止滚动触发编辑模式
            preventScrollEditRef.current = true;
            setTimeout(() => {
                preventScrollEditRef.current = false;
            }, 300);
            
            // 更新当前笔记ID引用
            currentNoteIdRef.current = note?.id;
        }
    }, [note?.id]);
    
    // 检查是否为新建笔记，如果是则默认进入编辑模式
    useEffect(() => {
        const isNew = has(router.query, 'new');
        if (isNew) {
            setIsEditing(true);
        }
    }, [router.query]);

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
                    
                    toast('笔记创建成功', 'success');
                } else {
                    await updateNote(data);
                    toast('笔记保存成功', 'success');
                }
                
                // 重置内容修改标志
                setContentModified(false);
            } catch (err) {
                console.error('保存笔记时出错:', err);
                toast('保存失败，请重试', 'error');
                
                // 提供更具体的错误提示
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
            setBackLinks([]);
        }
    }, [note?.id]);

    const onEditorChange = useCallback(
        (value: () => string, readOnly?: boolean): void => {
            try {
                // 防止滚动触发的状态更新
                if (preventScrollEditRef.current) {
                    return;
                }
                
                // 检查是否为只读模式，如果是则不允许编辑
                if (readOnly) {
                    console.log('编辑器处于只读模式，忽略内容变更');
                    return;
                }
                
                // 只在编辑模式下更新内容
                if (isEditing) {
                    // 更新当前内容，但不自动保存
                    const content = value();
                    setCurrentContent(content);
                    
                    // 检查内容是否已修改
                    if (content !== note?.content) {
                        setContentModified(true);
                    } else {
                        setContentModified(false);
                    }
                    
                    console.log('内容已更新，但未自动保存');
                }
            } catch (err) {
                console.error('处理编辑器内容变更时出错:', err);
                toast('处理内容变更失败', 'error');
            }
        },
        [note?.content, toast, isEditing]
    );

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

    // 添加滚动事件监听，防止滚动触发编辑模式
    useEffect(() => {
        const handleScroll = () => {
            // 设置防滚动标志
            preventScrollEditRef.current = true;
            
            // 清除之前的定时器
            clearTimeout(window.scrollTimer);
            
            // 设置新的定时器，滚动结束后重置标志
            window.scrollTimer = setTimeout(() => {
                preventScrollEditRef.current = false;
            }, 300); // 滚动结束后300ms重置标志
        };
        
        // 添加滚动事件监听
        window.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            clearTimeout(window.scrollTimer);
        };
    }, []);

    // 进入编辑模式 - 将toggleEditMode拆分为两个独立函数
    const enterEditMode = useCallback(() => {
        try {
            console.log('进入编辑模式');
            
            // 防止滚动触发的状态更新
            if (preventScrollEditRef.current) {
                console.log('滚动中，忽略编辑模式操作');
                return;
            }
            
            // 只有在非编辑模式下才能进入编辑模式
            if (!isEditing) {
                setIsEditing(true);
                console.log('已进入编辑模式');
            }
        } catch (err) {
            console.error('进入编辑模式时出错:', err);
            toast('无法进入编辑模式', 'error');
        }
    }, [isEditing, toast]);

    // 保存并退出编辑模式 - 将toggleEditMode拆分为两个独立函数
    const saveAndExitEditMode = useCallback(async () => {
        try {
            console.log('保存并退出编辑模式');
            
            // 防止滚动触发的状态更新
            if (preventScrollEditRef.current) {
                console.log('滚动中，忽略保存操作');
                return;
            }
            
            // 只有在编辑模式下才能保存并退出
            if (isEditing) {
                if (!currentContent) {
                    toast('笔记内容不能为空', 'error');
                    return;
                }
                
                setIsSaving(true);
                
                try {
                    await onNoteChange.callback({ content: currentContent });
                    
                    // 保存成功后显示通知并退出编辑模式
                    toast('笔记已保存', 'success');
                    setIsEditing(false);
                    setContentModified(false);
                    console.log('已退出编辑模式');
                } catch (err) {
                    console.error('保存笔记时出错:', err);
                    toast('保存失败，请重试', 'error');
                    // 保存失败时不退出编辑模式
                } finally {
                    setIsSaving(false);
                }
            }
        } catch (err) {
            console.error('保存并退出编辑模式时出错:', err);
            toast('操作失败', 'error');
            setIsSaving(false);
        }
    }, [currentContent, isEditing, onNoteChange, toast]);

    // 取消编辑 - 新增函数，用于不保存直接退出编辑模式
    const cancelEdit = useCallback(() => {
        try {
            console.log('取消编辑');
            
            // 防止滚动触发的状态更新
            if (preventScrollEditRef.current) {
                console.log('滚动中，忽略取消编辑操作');
                return;
            }
            
            // 只有在编辑模式下才能取消编辑
            if (isEditing) {
                // 如果内容已修改，提示确认
                if (contentModified) {
                    const confirmCancel = window.confirm('您有未保存的更改，确定要放弃这些更改吗？');
                    if (!confirmCancel) {
                        return;
                    }
                }
                
                // 重置为原始内容
                if (note?.content) {
                    setCurrentContent(note.content);
                }
                
                // 退出编辑模式
                setIsEditing(false);
                setContentModified(false);
                console.log('已取消编辑并退出编辑模式');
                toast('已取消编辑', 'info');
            }
        } catch (err) {
            console.error('取消编辑时出错:', err);
            toast('操作失败', 'error');
         }
     }, [isEditing, contentModified, note?.content, toast]);
 
     // 保留toggleEditMode函数以保持向后兼容，但内部使用新函数
     const toggleEditMode = useCallback(() => {
         if (isEditing) {
             // 如果当前是编辑模式，则保存并退出
             if (contentModified) {
                 saveAndExitEditMode();
             } else {
                 // 如果内容未修改，直接退出编辑模式
                 setIsEditing(false);
             }
         } else {
             // 如果当前是预览模式，则进入编辑模式
             enterEditMode();
         }
     }, [isEditing, contentModified, saveAndExitEditMode, enterEditMode]);
 
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
         // 保留原有函数以保持兼容性
         saveNote: saveAndExitEditMode,
         toggleEditMode,
         // 新增的独立功能函数
         enterEditMode,
         saveAndExitEditMode,
         cancelEdit,
         // 状态变量
         isEditing,
         setIsEditing,
         currentContent,
         isSaving,
         contentModified
     };
 };
 
 // 使用原始方式创建容器
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
