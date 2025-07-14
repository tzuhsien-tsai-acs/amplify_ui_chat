import { useState, useEffect, useCallback } from 'react';
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

const useChatRoom = ({ roomId, userId }: UseChatRoomProps): UseChatRoomResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<any>(null);

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
    
    // Cleanup subscription on unmount or room change
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      PubSub.unsubscribe(`chat/${roomId}`);
    };
  }, [roomId, fetchMessages, fetchUsers]);

  return {
    messages,
    users,
    isLoading,
    error,
    sendMessage,
    loadMoreMessages
  };
};

export default useChatRoom;