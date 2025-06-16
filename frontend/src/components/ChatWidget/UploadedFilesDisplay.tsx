import React from 'react';
import { FileText, X } from 'lucide-react';
import '../../styles/ChatWidget.css';
import { formatFileSize } from '../../utils/chatWidget';

interface UploadedFilesDisplayProps {
  uploadedFiles: File[];
  onRemoveFile: (fileIndex: number) => void;
}

export const UploadedFilesDisplay: React.FC<UploadedFilesDisplayProps> = ({
  uploadedFiles,
  onRemoveFile
}) => {
  if (uploadedFiles.length === 0) {
    return null;
  }

  return (
    <div className="uploaded-files">
      <div className="files-header">
        <FileText size={16} />
        <span>Your Content ({uploadedFiles.length})</span>
      </div>
      <div className="files-list">
        {uploadedFiles.map((file, index) => (
          <div key={index} className="file-item">
            <div className="file-info">
              <FileText size={14} />
              <span className="file-name">{file.name}</span>
              <span className="file-size">
                {formatFileSize(file.size)}
              </span>
            </div>
            <button 
              onClick={() => onRemoveFile(index)}
              className="remove-file-btn"
              title="Remove file"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}; 