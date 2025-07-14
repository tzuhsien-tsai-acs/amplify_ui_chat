import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Heading, 
  Button, 
  Card, 
  Collection, 
  Flex, 
  Divider,
  Text,
  TextField,
  Modal
} from '@aws-amplify/ui-react';
import { API, graphqlOperation } from 'aws-amplify';
import AmplifyAuth from './auth/AmplifyAuth';
import ChatMessage from './components/ChatMessage';
import MessageInput from './components/MessageInput';
import UserList from './components/UserList';
import useChatRoom from './hooks/useChatRoom';
import './App.css';

// GraphQL operations for rooms
const listRoomsQuery = /* GraphQL */ `
  query ListRooms {
    listRooms {
      items {
        id
        name
        description
        createdAt
      }
    }
  }
`;

const createRoomMutation = /* GraphQL */ `
  mutation CreateRoom($name: String!, $description: String) {
    createRoom(name: $name, description: $description) {
      id
      name
      description
      createdAt
    }
  }
`;

function App() {
  const [user, setUser] = useState<any>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCreateRoomModalOpen, setIsCreateRoomModalOpen] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomDescription, setNewRoomDescription] = useState<string>('');
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);
  
  const messageListRef = useRef<HTMLDivElement>(null);
  
  // Use our custom hook for chat functionality
  const { 
    messages, 
    users, 
    isLoading, 
    error, 
    sendMessage, 
    loadMoreMessages,
    markMessageAsRead,
    unreadCount,
    messageReadStatus
  } = useChatRoom({
    roomId: selectedRoomId,
    userId: user?.username || user?.attributes?.sub || ''
  });

  // Fetch available chat rooms
  const fetchRooms = async () => {
    try {
      const response: any = await API.graphql(graphqlOperation(listRoomsQuery));
      const fetchedRooms = response.data.listRooms.items;
      setRooms(fetchedRooms);
      
      // Select the first room by default if none is selected
      if (fetchedRooms.length > 0 && !selectedRoomId) {
        setSelectedRoomId(fetchedRooms[0].id);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  // Create a new chat room
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    
    setIsCreatingRoom(true);
    
    try {
      const response: any = await API.graphql(
        graphqlOperation(createRoomMutation, {
          name: newRoomName.trim(),
          description: newRoomDescription.trim() || null
        })
      );
      
      const newRoom = response.data.createRoom;
      setRooms(prevRooms => [...prevRooms, newRoom]);
      setSelectedRoomId(newRoom.id);
      setIsCreateRoomModalOpen(false);
      setNewRoomName('');
      setNewRoomDescription('');
    } catch (err) {
      console.error('Error creating room:', err);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Handle user authentication
  const handleSignIn = (user: any) => {
    setUser(user);
    setIsAuthenticated(true);
  };

  // Scroll to bottom of message list when new messages arrive
  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when they appear in the viewport
  useEffect(() => {
    if (!messages.length || !selectedRoomId) return;
    
    // Use Intersection Observer to detect when messages are visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId) {
              markMessageAsRead(messageId);
            }
          }
        });
      },
      { threshold: 0.5 } // Message is considered visible when 50% is in viewport
    );
    
    // Observe all message elements
    const messageElements = document.querySelectorAll('.message-container');
    messageElements.forEach(element => {
      observer.observe(element);
    });
    
    return () => {
      observer.disconnect();
    };
  }, [messages, selectedRoomId, markMessageAsRead]);

  // Fetch rooms when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchRooms();
    }
  }, [isAuthenticated]);

  // If not authenticated, show the auth component
  if (!isAuthenticated) {
    return <AmplifyAuth onSignIn={handleSignIn} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <Heading level={3}>AWS Amplify Chat</Heading>
        <Flex alignItems="center">
          <Text>Welcome, {user.username || user.attributes?.email}</Text>
          <Button variation="link" onClick={() => setIsAuthenticated(false)}>Sign Out</Button>
        </Flex>
      </header>
      
      <div className="chat-container">
        {/* Sidebar with room list */}
        <div className="sidebar">
          <Flex justifyContent="space-between" alignItems="center" padding="1rem">
            <Heading level={5}>Chat Rooms</Heading>
            <Button size="small" onClick={() => setIsCreateRoomModalOpen(true)}>+ New</Button>
          </Flex>
          
          <Collection
            items={rooms}
            type="list"
            direction="column"
            gap="0"
          >
            {(room) => (
              <div 
                key={room.id} 
                className={`room-item ${selectedRoomId === room.id ? 'active' : ''}`}
                onClick={() => setSelectedRoomId(room.id)}
              >
                <Text fontWeight={selectedRoomId === room.id ? 'bold' : 'normal'}>
                  {room.name}
                </Text>
                {room.description && (
                  <Text fontSize="0.8rem" color="var(--amplify-colors-neutral-80)">
                    {room.description}
                  </Text>
                )}
              </div>
            )}
          </Collection>
          
          {/* User list */}
          {users.length > 0 && (
            <>
              <Divider />
              <UserList users={users} />
            </>
          )}
        </div>
        
        {/* Chat room */}
        <div className="chat-room">
          {selectedRoomId ? (
            <>
              {/* Room header */}
              <div className="room-header">
                <Heading level={5}>
                  {rooms.find(room => room.id === selectedRoomId)?.name || 'Chat Room'}
                </Heading>
                <Text fontSize="0.9rem">
                  {users.filter(user => user.isOnline).length} online
                </Text>
              </div>
              
              {/* Message list */}
              <div className="message-list" ref={messageListRef}>
                {isLoading && messages.length === 0 ? (
                  <div className="loading-messages">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="no-messages">No messages yet. Start the conversation!</div>
                ) : (
                  <>
                    {nextToken && (
                      <Button 
                        onClick={loadMoreMessages} 
                        isLoading={isLoading}
                        variation="link"
                        className="load-more-button"
                      >
                        Load more messages
                      </Button>
                    )}
                    
                    {messages.map(message => (
                      <ChatMessage 
                        key={message.id} 
                        message={message} 
                        isCurrentUser={message.sender === (user.username || user.attributes?.sub)}
                        isRead={messageReadStatus[message.id] || false}
                      />
                    ))}
                  </>
                )}
                
                {error && (
                  <div className="error-message">
                    Error: {error}
                  </div>
                )}
              </div>
              
              {/* Message input */}
              <div className="message-input-container">
                <MessageInput 
                  onSendMessage={sendMessage} 
                  isLoading={isLoading}
                />
              </div>
            </>
          ) : (
            <div className="no-room-selected">
              <Card variation="elevated">
                <Heading level={4}>Welcome to AWS Amplify Chat</Heading>
                <Text>Select a chat room from the sidebar or create a new one to start chatting.</Text>
                <Button onClick={() => setIsCreateRoomModalOpen(true)}>Create New Room</Button>
              </Card>
            </div>
          )}
        </div>
      </div>
      
      {/* Create Room Modal */}
      <Modal
        isOpen={isCreateRoomModalOpen}
        onClose={() => setIsCreateRoomModalOpen(false)}
        size="small"
        heading="Create New Chat Room"
      >
        <Flex direction="column" gap="1rem">
          <TextField
            label="Room Name"
            placeholder="Enter room name"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            required
          />
          
          <TextField
            label="Description (optional)"
            placeholder="Enter room description"
            value={newRoomDescription}
            onChange={(e) => setNewRoomDescription(e.target.value)}
          />
          
          <Flex justifyContent="flex-end" gap="0.5rem">
            <Button
              onClick={() => setIsCreateRoomModalOpen(false)}
              variation="link"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRoom}
              isLoading={isCreatingRoom}
              loadingText="Creating..."
              isDisabled={!newRoomName.trim() || isCreatingRoom}
            >
              Create Room
            </Button>
          </Flex>
        </Flex>
      </Modal>
    </div>
  );
}

export default App;