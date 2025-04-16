import { FC, memo } from 'react';
import EditorState from 'libs/web/state/editor';

const SaveButton: FC = memo(() => {
    const { 
        isEditing, 
        enterEditMode, 
        saveAndExitEditMode, 
        isSaving 
    } = EditorState.useContainer();

    const handleClick = () => {
        if (isEditing) {
            // 在编辑模式下，点击按钮保存笔记并退出编辑模式
            saveAndExitEditMode();
        } else {
            // 在预览模式下，点击按钮进入编辑模式
            enterEditMode();
        }
    };

    return (
        <div className="edit-save-button-container">
            <button
                onClick={handleClick}
                className={buttonClass}
                title={buttonTitle}
                aria-label={buttonText}
                disabled={isSaving}
            >
                <span className="button-icon">{buttonIcon}</span>
                <span className="button-text">{buttonText}</span>
                {isEditing && contentModified && (
                    <span className="modified-indicator" title="有未保存的更改">•</span>
                )}
                {isSaving && <span className="saving-spinner"></span>}
            </button>
            <style jsx>{`
                .edit-save-button-container {
                    display: inline-block;
                    margin-top: 8px;
                }
                
                .edit-save-button {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 100px;
                    height: 40px;
                    border-radius: 20px;
                    padding: 0 16px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: none;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                    position: relative;
                    overflow: hidden;
                }
                
                .edit-save-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
                }
                
                .edit-save-button:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.1);
                }
                
                .edit-save-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.7;
                    transform: none;
                    box-shadow: none;
                }
                
                .edit-mode {
                    background-color: #3498db;
                    color: white;
                }
                
                .save-mode {
                    background-color: #2ecc71;
                    color: white;
                }
                
                .saving {
                    background-color: #f39c12;
                }
                
                .modified {
                    box-shadow: 0 0 0 2px rgba(241, 196, 15, 0.5);
                }
                
                .modified-indicator {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #f1c40f;
                    color: transparent;
                    font-size: 0;
                    animation: pulse 2s infinite;
                }
                
                @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }
                
                .button-icon {
                    margin-right: 8px;
                    font-size: 18px;
                }
                
                .button-text {
                    white-space: nowrap;
                }
                
                .saving-spinner {
                    position: absolute;
                    top: 50%;
                    right: 10px;
                    transform: translateY(-50%);
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    to { transform: translateY(-50%) rotate(360deg); }
                }
                
                @media (max-width: 640px) {
                    .edit-save-button {
                        min-width: 80px;
                        padding: 0 12px;
                        font-size: 14px;
                    }
                    
                    .button-icon {
                        font-size: 16px;
                    }
                }
            `}</style>
        </div>
    );
});

SaveButton.displayName = 'SaveButton';

export default SaveButton;
