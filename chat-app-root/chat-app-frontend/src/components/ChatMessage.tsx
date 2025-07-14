import React from 'react';

interface ChatMessageProps {
  message: ChatMessage;
  isCurrentUser: boolean;
  isRead?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isCurrentUser, isRead = false }) => {
  // Format timestamp to a readable format
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`message-container ${isCurrentUser ? 'current-user' : 'other-user'}`}>
      <div className="message-header">
        <span className="message-sender">{isCurrentUser ? 'You' : message.sender}</span>
        <span className="message-time">{formatTimestamp(message.timestamp)}</span>
      </div>
      <div className="message-content">
        {message.content}
      </div>
      {isCurrentUser && (
        <div className="message-status">
          {isRead ? (
            <span className="read-status">Read</span>
          ) : (
            <span className="unread-status">Delivered</span>
          )}
        </div>
      )}
      <style jsx>{`
        .message-container {
          margin-bottom: 16px;
          max-width: 70%;
          padding: 10px 15px;
          border-radius: 8px;
        }
        
        .current-user {
          align-self: flex-end;
          background-color: #dcf8c6;
          margin-left: auto;
        }
        
        .other-user {
          align-self: flex-start;
          background-color: #f1f0f0;
          margin-right: auto;
        }
        
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 0.8rem;
        }
        
        .message-sender {
          font-weight: bold;
          color: #555;
        }
        
        .message-time {
          color: #999;
        }
        
        .message-content {
          word-break: break-word;
        }

        .message-status {
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
          font-size: 0.7rem;
        }

        .read-status {
          color: #4caf50;
        }

        .unread-status {
          color: #9e9e9e;
        }
      `}</style>
    </div>
  );
};

export default ChatMessage;