import React, { useState } from 'react';
import { Button, TextField } from '@aws-amplify/ui-react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isLoading = false }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-form">
      <div className="message-input-container">
        <TextField
          label="Message"
          labelHidden
          placeholder="Type your message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isLoading}
          autoComplete="off"
          className="message-input"
        />
        <Button
          type="submit"
          variation="primary"
          isLoading={isLoading}
          loadingText="Sending..."
          disabled={!message.trim() || isLoading}
          className="send-button"
        >
          Send
        </Button>
      </div>
      <style jsx>{`
        .message-input-form {
          width: 100%;
        }
        
        .message-input-container {
          display: flex;
          gap: 10px;
        }
        
        .message-input {
          flex: 1;
        }
        
        .send-button {
          align-self: flex-end;
        }
      `}</style>
    </form>
  );
};

export default MessageInput;