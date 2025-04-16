import NoteState from 'libs/web/state/note';
import { has } from 'lodash';
import router, { useRouter } from 'next/router';
import { useCallback, useEffect, useRef } from 'react';
import NoteTreeState from 'libs/web/state/tree';
import NoteNav from 'components/note-nav';
import UIState from 'libs/web/state/ui';
import noteCache from 'libs/web/cache/note';
import useSettingsAPI from 'libs/web/api/settings';
import dynamic from 'next/dynamic';
import { useToast } from 'libs/web/hooks/use-toast';
import DeleteAlert from 'components/editor/delete-alert';
import RouteErrorHandler from 'components/route-error-handler';

const MainEditor = dynamic(() => import('components/editor/main-editor'));

export const EditContainer = () => {
    const {
        title: { updateTitle },
        settings: { settings },
    } = UIState.useContainer();
    const { genNewId } = NoteTreeState.useContainer();
    const { fetchNote, abortFindNote, findOrCreateNote, initNote, note } =
        NoteState.useContainer();
    const { query } = useRouter();
    const pid = query.pid as string;
    const id = query.id as string;
    const isNew = has(query, 'new');
    const { mutate: mutateSettings } = useSettingsAPI();
    const toast = useToast();

    // 添加路由操作状态标志，防止并发路由操作
    const isRoutingRef = useRef(false);
    
    const loadNoteById = useCallback(
        async (id: string) => {
            // 如果已经在进行路由操作，则跳过
            if (isRoutingRef.current) {
                console.log('已有路由操作正在进行，跳过当前操作');
                return;
            }
            
            try {
                // 设置路由操作标志
                isRoutingRef.current = true;
                
                // daily notes
                if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(id)) {
                    await findOrCreateNote(id, {
                        id,
                        title: id,
                        content: '\n',
                        pid: settings.daily_root_id,
                    });
                } else if (id === 'new') {
                    const url = `/${genNewId()}?new` + (pid ? `&pid=${pid}` : '');
                    
                    try {
                        await router.replace(url, undefined, { shallow: true });
                    } catch (err) {
                        // 忽略路由取消错误
                        if (!(err instanceof Error) || !err.message.includes('cancelled')) {
                            throw err;
                        }
                    }
                } else if (id && !isNew) {
                    try {
                        const result = await fetchNote(id);
                        if (!result) {
                            try {
                                await router.replace({ query: { ...router.query, new: 1 } });
                            } catch (err) {
                                // 忽略路由取消错误
                                if (!(err instanceof Error) || !err.message.includes('cancelled')) {
                                    throw err;
                                }
                            }
                            return;
                        }
                    } catch (msg) {
                        const err = msg as Error;
                        if (err.name !== 'AbortError') {
                            toast(err.message, 'error');
                            try {
                                await router.push('/', undefined, { shallow: true });
                            } catch (routeErr) {
                                // 忽略路由取消错误
                                if (!(routeErr instanceof Error) || !routeErr.message.includes('cancelled')) {
                                    throw routeErr;
                                }
                            }
                        }
                    }
                } else {
                    if (await noteCache.getItem(id)) {
                        try {
                            await router.push(`/${id}`, undefined, { shallow: true });
                        } catch (err) {
                            // 忽略路由取消错误
                            if (!(err instanceof Error) || !err.message.includes('cancelled')) {
                                throw err;
                            }
                        }
                        return;
                    }

                    initNote({
                        id,
                        content: '\n',
                    });
                }

                if (!isNew && id !== 'new') {
                    await mutateSettings({
                        last_visit: `/${id}`,
                    });
                }
            } finally {
                // 重置路由操作标志
                isRoutingRef.current = false;
            }
        },
        [
            isNew,
            findOrCreateNote,
            settings.daily_root_id,
            genNewId,
            pid,
            fetchNote,
            toast,
            initNote,
            mutateSettings,
        ]
    );

    useEffect(() => {
        abortFindNote();
        loadNoteById(id)
            ?.catch((v) => console.error('Could not load note: %O', v));
    }, [loadNoteById, abortFindNote, id]);

    useEffect(() => {
        updateTitle(note?.title);
    }, [note?.title, updateTitle]);

    return (
        <>
            <RouteErrorHandler />
            <NoteNav />
            <DeleteAlert />
            <section className="h-full">
                <MainEditor note={note} />
            </section>
        </>
    );
};
