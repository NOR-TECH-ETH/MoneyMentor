import React, { useRef } from 'react';
import { Send, Upload } from 'lucide-react';
import '../../styles/ChatWidget.css';
import { UploadProgress } from '../../utils/chatWidget';
import { MessageButtons } from './MessageButtons';

interface ChatInputProps {
  inputValue: string;
  isLoading: boolean;
  uploadProgress: UploadProgress;
  showCommandSuggestions: boolean;
  commandSuggestions: string[];
  showCommandMenu: boolean;
  availableCommands: { command: string; description: string; }[];
  activeMode: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendMessage: (message?: string) => void;
  onFileUpload: (files: FileList) => void;
  onCommandSelect: (command: string) => void;
  onToggleCommandMenu: () => void;
  onCloseCommandMenu: () => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  isLoading,
  uploadProgress,
  showCommandSuggestions,
  commandSuggestions,
  showCommandMenu,
  availableCommands,
  activeMode,
  onInputChange,
  onSendMessage,
  onFileUpload,
  onCommandSelect,
  onToggleCommandMenu,
  onCloseCommandMenu,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const commandButtons = availableCommands.map(cmd => ({
    label: cmd.command,
    action: () => onCommandSelect(cmd.command),
    isActive: cmd.command === activeMode
  }));

  return (
    <div className="chat-input">
      <button 
        className="upload-btn"
        onClick={handleTriggerFileUpload}
        title="Upload file (PDF, TXT, PPT, PPTX)"
        disabled={uploadProgress.isUploading || disabled}
      >
        <Upload size={18} />
      </button>
      
      <div className="input-container">
        <input
          type="text"
          value={inputValue}
          onChange={onInputChange}
          onKeyPress={(e) => e.key === 'Enter' && onSendMessage()}
          placeholder="Ask about budgeting, investing, or financial calculations..."
          disabled={isLoading || disabled}
        />
        
        {/* Command Menu Button */}
        <button 
          className="command-menu-btn"
          onClick={onToggleCommandMenu}
          title="Show available commands"
          disabled={disabled}
        >
          <span className="command-slash">/</span>
        </button>
        
        {/* Command Autocomplete Dropdown */}
        {showCommandSuggestions && commandSuggestions.length > 0 && (
          <div className="command-suggestions">
            {commandSuggestions.map((command, index) => {
              const commandInfo = availableCommands.find(cmd => cmd.command === command);
              return (
                <div
                  key={index}
                  className="command-suggestion"
                  onClick={() => onCommandSelect(command)}
                >
                  <span className="command-text">{command}</span>
                  {commandInfo && (
                    <span className="command-description">{commandInfo.description}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Command Menu as MessageButtons */}
        {showCommandMenu && (
          <div className="message-buttons command-menu">
            {availableCommands.map((cmd, index) => (
              <button
                key={index}
                onClick={() => onCommandSelect(cmd.command)}
                className={`message-button ${cmd.command === activeMode ? 'active' : ''}`}
              >
                {cmd.command}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className="send-btn"
        onClick={() => onSendMessage()}
        disabled={isLoading || !inputValue.trim() || disabled}
      >
        <Send size={18} />
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files && onFileUpload(e.target.files)}
        accept=".pdf,.txt,.ppt,.pptx"
        style={{ display: 'none' }}
      />
    </div>
  );
}; 