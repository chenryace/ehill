import { FC, memo } from 'react';
import EditorState from 'libs/web/state/editor';

const SaveButton: FC = memo(() => {
    const { isEditing, toggleEditMode, saveNote, isSaving } = EditorState.useContainer();

    const handleClick = () => {
        if (isEditing) {
            // 在编辑模式下，点击按钮保存笔记
            saveNote();
        } else {
            // 在预览模式下，点击按钮进入编辑模式
            toggleEditMode();
        }
    };

    return (
        <div className="toggle-switch-container">
            <button
                onClick={handleClick}
                className="toggle-switch"
                title={isEditing ? "保存" : "编辑"}
                aria-label={isEditing ? "保存" : "编辑"}
                disabled={isSaving}
            >
                <div className={`toggle-switch-slider ${isEditing ? 'active' : ''} ${isSaving ? 'saving' : ''}`}>
                    <div className="toggle-switch-button"></div>
                    <div className="toggle-switch-labels">
                        <span className="toggle-switch-label-off">OFF</span>
                        <span className="toggle-switch-label-on">ON</span>
                    </div>
                </div>
            </button>
            <style jsx>{`
                .toggle-switch-container {
                    display: inline-block;
                    margin-top: 8px;
                }
                
                .toggle-switch {
                    position: relative;
                    display: inline-block;
                    width: 120px;
                    height: 40px;
                    border-radius: 20px;
                    background: transparent;
                    padding: 0;
                    border: none;
                    cursor: pointer;
                    overflow: hidden;
                }
                
                .toggle-switch:disabled {
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                
                .toggle-switch-slider {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border-radius: 20px;
                    border: 1px solid #ccc;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                }
                
                .toggle-switch-slider::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 50%;
                    height: 100%;
                    background-color: #e74c3c;
                    border-radius: 20px;
                    z-index: 1;
                    transition: all 0.3s ease;
                }
                
                .toggle-switch-slider.active::before {
                    left: 50%;
                    background-color: #2ecc71;
                }
                
                .toggle-switch-slider.saving::before {
                    background-color: #3498db;
                }
                
                .toggle-switch-button {
                    position: absolute;
                    top: 4px;
                    left: 4px;
                    width: 30px;
                    height: 30px;
                    background-color: white;
                    border-radius: 50%;
                    transition: all 0.3s ease;
                    z-index: 2;
                }
                
                .toggle-switch-slider.active .toggle-switch-button {
                    left: calc(100% - 34px);
                }
                
                .toggle-switch-slider.saving .toggle-switch-button {
                    animation: pulse 1.5s infinite;
                }
                
                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(0.9); }
                    100% { transform: scale(1); }
                }
                
                .toggle-switch-labels {
                    position: relative;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    z-index: 2;
                }
                
                .toggle-switch-label-off,
                .toggle-switch-label-on {
                    width: 50%;
                    text-align: center;
                    font-weight: bold;
                    color: white;
                    padding: 0 8px;
                }
                
                .toggle-switch-label-off {
                    padding-left: 12px;
                }
                
                .toggle-switch-label-on {
                    padding-right: 12px;
                }
            `}</style>
        </div>
    );
});

SaveButton.displayName = 'SaveButton';

export default SaveButton;
