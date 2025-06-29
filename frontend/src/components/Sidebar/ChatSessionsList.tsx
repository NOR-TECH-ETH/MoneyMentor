import React from 'react';
import { ChatSession } from '../../types';
import { 
  groupSessionsByDate, 
  sortSessionsByTimestamp, 
  formatSessionTimestamp 
} from '../../utils/sessions';

interface ChatSessionsListProps {
  sessions: ChatSession[];
  selectedSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  isCollapsed: boolean;
}

export const ChatSessionsList: React.FC<ChatSessionsListProps> = ({
  sessions,
  selectedSessionId,
  onSessionSelect,
  isCollapsed
}) => {
  // Sort sessions by timestamp and group by date
  const sortedSessions = sortSessionsByTimestamp(sessions);
  const groupedSessions = groupSessionsByDate(sortedSessions);

  const handleSessionDelete = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    // TODO: Implement session deletion
    console.log('Delete session:', sessionId);
  };

  return (
    <div className="chat-sessions">
      {Object.entries(groupedSessions).map(([groupTitle, groupSessions]) => (
        <div key={groupTitle} className="session-group">
          {!isCollapsed && (
            <div className="session-group-title">{groupTitle}</div>
          )}
          
          {groupSessions.map((session) => (
            <div key={session.id} className="session-item">
              <div
                className={`session-link ${session.id === selectedSessionId ? 'active' : ''}`}
                onClick={() => onSessionSelect(session.id)}
              >
                <div className="session-icon">
                  {session.isActive ? '💬' : '📝'}
                </div>
                
                {!isCollapsed && (
                  <div className="session-content">
                    <div className="session-title">{session.title}</div>
                    <div className="session-preview">{session.preview}</div>
                    <div className="session-meta">
                      <span className="session-timestamp">
                        {formatSessionTimestamp(session.timestamp)}
                      </span>
                      <span className="session-message-count">
                        {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              {!isCollapsed && (
                <div className="session-actions">
                  <button
                    className="session-action-btn"
                    onClick={(e) => handleSessionDelete(session.id, e)}
                    title="Delete session"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      
      {sessions.length === 0 && (
        <div className="empty-sessions">
          {!isCollapsed && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 20px', 
              color: '#64748b',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💭</div>
              <div>No chat sessions yet</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Start a new conversation to begin
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 