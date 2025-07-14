/// <reference types="react-scripts" />

// Chat message type definition
interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  roomId: string;
}

// Chat room type definition
interface ChatRoom {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  lastMessage?: ChatMessage;
}

// User type definition
interface User {
  id: string;
  username: string;
  email: string;
  isOnline?: boolean;
}

// API response types
interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface ListMessagesResponse {
  messages: ChatMessage[];
  nextToken?: string;
}

interface ListRoomsResponse {
  rooms: ChatRoom[];
  nextToken?: string;
}

interface ListUsersResponse {
  users: User[];
  nextToken?: string;
}