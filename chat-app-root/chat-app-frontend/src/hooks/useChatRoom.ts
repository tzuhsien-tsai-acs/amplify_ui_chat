import { useState, useEffect, useCallback, useRef } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { PubSub } from 'aws-amplify';

// Type definitions for the hook
interface UseChatRoomProps {
  roomId: string | null;
  userId: string;
}

interface UseChatRoomResult {
  messages: ChatMessage[];
  users: User[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  markMessageAsRead: (messageId: string) => Promise<void>;
  unreadCount: number;
  messageReadStatus: Record<string, boolean>;
}

// GraphQL operations (these would match your actual backend schema)
const listMessagesQuery = /* GraphQL */ `
  query ListMessages($roomId: ID!, $limit: Int, $nextToken: String) {
    listMessages(roomId: $roomId, limit: $limit, nextToken: $nextToken) {
      items {
        id
        content
        sender
        roomId
        timestamp
      }
      nextToken
    }
  }
`;

const createMessageMutation = /* GraphQL */ `
  mutation CreateMessage($content: String!, $roomId: ID!, $sender: String!) {
    createMessage(content: $content, roomId: $roomId, sender: $sender) {
      id
      content
      sender
      roomId
      timestamp
    }
  }
`;

const onCreateMessageSubscription = /* GraphQL */ `
  subscription OnCreateMessage($roomId: ID!) {
    onCreateMessage(roomId: $roomId) {
      id
      content
      sender
      roomId
      timestamp
    }
  }
`;

const listUsersInRoomQuery = /* GraphQL */ `
  query ListUsersInRoom($roomId: ID!) {
    listUsersInRoom(roomId: $roomId) {
      items {
        id
        username
        email
        isOnline
      }
    }
  }
`;

const getUnreadMessagesQuery = /* GraphQL */ `
  query GetUnreadMessages($roomId: ID!, $userId: ID!) {
    getUnreadMessages(roomId: $roomId, userId: $userId) {
      count
      items {
        messageId
        isRead
      }
    }
  }
`;

const useChatRoom = ({ roomId, userId }: UseChatRoomProps): UseChatRoomResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [messageReadStatus, setMessageReadStatus] = useState<Record<string, boolean>>({});
  const webSocketRef = useRef<WebSocket | null>(null);

  // Fetch messages for the current room
  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response: any = await API.graphql(
        graphqlOperation(listMessagesQuery, {
          roomId,
          limit: 50,
          nextToken: null
        })
      );
      
      const fetchedMessages = response.data.listMessages.items;
      setMessages(fetchedMessages);
      setNextToken(response.data.listMessages.nextToken);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to fetch messages');
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  // Fetch users in the current room
  const fetchUsers = useCallback(async () => {
    if (!roomId) return;
    
    try {
      const response: any = await API.graphql(
        graphqlOperation(listUsersInRoomQuery, { roomId })
      );
      
      const fetchedUsers = response.data.listUsersInRoom.items;
      setUsers(fetchedUsers);
    } catch (err: any) {
      console.error('Error fetching users:', err);
    }
  }, [roomId]);

  // Fetch unread messages count and status
  const fetchUnreadMessages = useCallback(async () => {
    if (!roomId || !userId) return;
    
    try {
      const response: any = await API.graphql(
        graphqlOperation(getUnreadMessagesQuery, { roomId, userId })
      );
      
      const unreadData = response.data.getUnreadMessages;
      setUnreadCount(unreadData.count);
      
      // Create a map of message read status
      const readStatusMap: Record<string, boolean> = {};
      unreadData.items.forEach((item: any) => {
        readStatusMap[item.messageId] = item.isRead;
      });
      
      setMessageReadStatus(readStatusMap);
    } catch (err: any) {
      console.error('Error fetching unread messages:', err);
    }
  }, [roomId, userId]);

  // Load more messages (pagination)
  const loadMoreMessages = async () => {
    if (!roomId || !nextToken || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const response: any = await API.graphql(
        graphqlOperation(listMessagesQuery, {
          roomId,
          limit: 50,
          nextToken
        })
      );
      
      const fetchedMessages = response.data.listMessages.items;
      setMessages(prevMessages => [...prevMessages, ...fetchedMessages]);
      setNextToken(response.data.listMessages.nextToken);
    } catch (err: any) {
      console.error('Error loading more messages:', err);
      setError(err.message || 'Failed to load more messages');
    } finally {
      setIsLoading(false);
    }
  };

  // Send a new message
  const sendMessage = async (content: string) => {
    if (!roomId || !content.trim()) return;
    
    try {
      await API.graphql(
        graphqlOperation(createMessageMutation, {
          content,
          roomId,
          sender: userId
        })
      );
      
      // The new message will be added via the subscription
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
    }
  };

  // Mark a message as read
  const markMessageAsRead = async (messageId: string) => {
    if (!roomId || !userId || !messageId) return;
    
    // If the message is already marked as read, don't do anything
    if (messageReadStatus[messageId]) return;
    
    try {
      // Send a WebSocket message to mark the message as read
      if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        webSocketRef.current.send(JSON.stringify({
          action: 'markMessageRead',
          messageId,
          roomId
        }));
        
        // Update the local state optimistically
        setMessageReadStatus(prev => ({
          ...prev,
          [messageId]: true
        }));
        
        // If this was an unread message, decrement the unread count
        if (!messageReadStatus[messageId]) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err: any) {
      console.error('Error marking message as read:', err);
    }
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (!roomId || !userId) return;
    
    // Get the WebSocket URL from aws-exports.js
    const awsExports = require('../aws-exports').default;
    const websocketUrl = awsExports.websocket_url;
    
    if (!websocketUrl) {
      console.error('WebSocket URL not found in aws-exports.js');
      return;
    }
    
    // Create WebSocket connection with query parameters
    const ws = new WebSocket(`${websocketUrl}?userId=${userId}&roomId=${roomId}`);
    
    ws.onopen = () => {
      console.log('WebSocket connection established');
      webSocketRef.current = ws;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.action === 'messageReceived') {
          const newMessage = data.message;
          setMessages(prevMessages => [newMessage, ...prevMessages]);
          
          // If the message is from someone else, mark it as unread
          if (newMessage.sender !== userId) {
            setUnreadCount(prev => prev + 1);
            setMessageReadStatus(prev => ({
              ...prev,
              [newMessage.id]: false
            }));
          } else {
            // If it's our own message, mark it as read
            setMessageReadStatus(prev => ({
              ...prev,
              [newMessage.id]: true
            }));
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };
    
    // Cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [roomId, userId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!roomId) return;
    
    const setupSubscription = async () => {
      try {
        const sub: any = API.graphql(
          graphqlOperation(onCreateMessageSubscription, { roomId })
        );
        
        if ('subscribe' in sub) {
          const subscription = sub.subscribe({
            next: (messageData: any) => {
              const newMessage = messageData.value.data.onCreateMessage;
              setMessages(prevMessages => [newMessage, ...prevMessages]);
              
              // If the message is from someone else, mark it as unread
              if (newMessage.sender !== userId) {
                setUnreadCount(prev => prev + 1);
                setMessageReadStatus(prev => ({
                  ...prev,
                  [newMessage.id]: false
                }));
              } else {
                // If it's our own message, mark it as read
                setMessageReadStatus(prev => ({
                  ...prev,
                  [newMessage.id]: true
                }));
              }
            },
            error: (err: any) => {
              console.error('Subscription error:', err);
            }
          });
          
          setSubscription(subscription);
        } else {
          // For WebSocket/AppSync subscriptions
          PubSub.subscribe(`chat/${roomId}`).subscribe({
            next: (data: any) => {
              const newMessage = data.value.data.onCreateMessage;
              setMessages(prevMessages => [newMessage, ...prevMessages]);
              
              // If the message is from someone else, mark it as unread
              if (newMessage.sender !== userId) {
                setUnreadCount(prev => prev + 1);
                setMessageReadStatus(prev => ({
                  ...prev,
                  [newMessage.id]: false
                }));
              } else {
                // If it's our own message, mark it as read
                setMessageReadStatus(prev => ({
                  ...prev,
                  [newMessage.id]: true
                }));
              }
            },
            error: (err: any) => console.error('PubSub error:', err)
          });
        }
      } catch (err) {
        console.error('Error setting up subscription:', err);
      }
    };
    
    setupSubscription();
    
    // Fetch initial data
    fetchMessages();
    fetchUsers();
    fetchUnreadMessages();
    
    // Cleanup subscription on unmount or room change
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      PubSub.unsubscribe(`chat/${roomId}`);
    };
  }, [roomId, userId, fetchMessages, fetchUsers, fetchUnreadMessages]);

  return {
    messages,
    users,
    isLoading,
    error,
    sendMessage,
    loadMoreMessages,
    markMessageAsRead,
    unreadCount,
    messageReadStatus
  };
};

export default useChatRoom;