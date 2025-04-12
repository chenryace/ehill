import { FC } from 'react';
import { Save, Edit } from 'react-feather';
import EditorState from 'libs/web/state/editor';

const SaveButton: FC = () => {
    const { isEditing, toggleEditMode } = EditorState.useContainer();

    return (
        <button
            onClick={toggleEditMode}
            className="flex items-center justify-center gap-1 px-3 py-1 text-sm font-medium text-white bg-green-500 rounded hover:bg-green-600 transition-colors"
            title={isEditing ? "保存" : "编辑"}
        >
            {isEditing ? (
                <>
                    <Save size={16} />
                    <span>保存</span>
                </>
            ) : (
                <>
                    <Edit size={16} />
                    <span>编辑</span>
                </>
            )}
        </button>
    );
};

export default SaveButton;
