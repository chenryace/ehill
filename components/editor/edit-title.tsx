import { TextareaAutosize } from '@material-ui/core';
import useI18n from 'libs/web/hooks/use-i18n';
import { has } from 'lodash';
import { useRouter } from 'next/router';
import {
    FC,
    useCallback,
    KeyboardEvent,
    useRef,
    useMemo,
    ChangeEvent,
    useState,
    useEffect
} from 'react';
import EditorState from 'libs/web/state/editor';
import { useToast } from 'libs/web/hooks/use-toast';

const EditTitle: FC<{ readOnly?: boolean }> = ({ readOnly }) => {
    const { editorEl, onNoteChange, note, isEditing } = EditorState.useContainer();
    const router = useRouter();
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const toast = useToast();
    const [titleValue, setTitleValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    
    // 初始化标题值
    useEffect(() => {
        if (note?.title) {
            setTitleValue(note.title);
        }
    }, [note?.id, note?.title]);
    
    const onInputTitle = useCallback(
        (event: KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key.toLowerCase() === 'enter') {
                event.stopPropagation();
                event.preventDefault();
                editorEl.current?.focusAtEnd();
            }
        },
        [editorEl]
    );

    const onTitleChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            const title = event.target.value;
            setTitleValue(title);
            
            // 只有在编辑模式下才保存标题
            if (isEditing) {
                setIsSaving(true);
                onNoteChange.callback({ title })
                    .then(() => {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('标题已保存');
                        }
                    })
                    .catch((err) => {
                        console.error('保存标题时出错:', err);
                        toast('保存标题失败，请重试', 'error');
                    })
                    .finally(() => {
                        setIsSaving(false);
                    });
            }
        },
        [onNoteChange, isEditing, toast]
    );

    const autoFocus = useMemo(() => has(router.query, 'new'), [router.query]);
    const { t } = useI18n();

    return (
        <h1 className="text-3xl mb-8 relative">
            <TextareaAutosize
                ref={inputRef}
                dir="auto"
                readOnly={readOnly}
                className={`outline-none w-full resize-none block bg-transparent ${isSaving ? 'opacity-70' : ''}`}
                placeholder={t('New Page')}
                value={titleValue}
                onKeyPress={onInputTitle}
                onChange={onTitleChange}
                maxLength={128}
                autoFocus={autoFocus}
                disabled={readOnly || isSaving}
            />
            {isSaving && (
                <span className="absolute right-0 top-0 text-xs text-gray-500 animate-pulse">
                    {t('Saving...')}
                </span>
            )}
        </h1>
    );
};

export default EditTitle;
