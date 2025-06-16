import React, { useRef } from 'react';
import { Send, Upload } from 'lucide-react';
import '../../styles/ChatWidget.css';
import { UploadProgress } from '../../utils/chatWidget';

interface ChatInputProps {
  inputValue: string;
  isLoading: boolean;
  uploadProgress: UploadProgress;
  showCommandSuggestions: boolean;
  commandSuggestions: string[];
  showCommandMenu: boolean;
  availableCommands: Array<{ command: string; description: string }>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSendMessage: () => void;
  onFileUpload: (files: FileList) => void;
  onCommandSelect: (command: string) => void;
  onToggleCommandMenu: () => void;
  onCloseCommandMenu: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputValue,
  isLoading,
  uploadProgress,
  showCommandSuggestions,
  commandSuggestions,
  showCommandMenu,
  availableCommands,
  onInputChange,
  onSendMessage,
  onFileUpload,
  onCommandSelect,
  onToggleCommandMenu,
  onCloseCommandMenu
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="chat-input">
      <button 
        className="upload-btn"
        onClick={handleTriggerFileUpload}
        title="Upload file (PDF, TXT, PPT, PPTX)"
        disabled={uploadProgress.isUploading}
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
          disabled={isLoading}
        />
        
        {/* Command Menu Button */}
        <button 
          className="command-menu-btn"
          onClick={onToggleCommandMenu}
          title="Show available commands"
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
        
        {/* Command Menu Dropdown */}
        {showCommandMenu && (
          <div className="command-menu">
            <div className="command-menu-header">
              <span>Available Commands</span>
              <button 
                className="close-menu-btn"
                onClick={onCloseCommandMenu}
              >
                ×
              </button>
            </div>
            {availableCommands.map((cmd, index) => (
              <div
                key={index}
                className="command-menu-item"
                onClick={() => onCommandSelect(cmd.command)}
              >
                <span className="command-text">{cmd.command}</span>
                <span className="command-description">{cmd.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <button 
        className="send-btn"
        onClick={onSendMessage}
        disabled={isLoading || !inputValue.trim()}
      >
        <Send size={20} />
      </button>
      
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.ppt,.pptx"
        onChange={(e) => e.target.files && onFileUpload(e.target.files)}
        style={{ display: 'none' }}
      />
    </div>
  );
}; 