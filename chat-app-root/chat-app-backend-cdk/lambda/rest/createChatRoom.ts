import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDB = new DynamoDB.DocumentClient();
const chatRoomsTable = process.env.CHAT_ROOMS_TABLE || '';

// Define the chat room interface
interface ChatRoom {
  roomId: string;
  name: string;
  description: string;
  isPrivate: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members: string[];
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { name, description, isPrivate = false, members = [] } = requestBody;
    
    // Validate required fields
    if (!name) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Chat room name is required',
        }),
      };
    }
    
    // Get user ID from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub;
    
    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Unauthorized: User ID not found',
        }),
      };
    }
    
    // Create a new chat room
    const roomId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Ensure creator is included in members list
    const uniqueMembers = Array.from(new Set([userId, ...members]));
    
    const chatRoom: ChatRoom = {
      roomId,
      name,
      description: description || '',
      isPrivate,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      members: uniqueMembers,
    };
    
    await dynamoDB.put({
      TableName: chatRoomsTable,
      Item: chatRoom,
    }).promise();
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(chatRoom),
    };
  } catch (error: unknown) {
    console.error('Error creating chat room:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error creating chat room',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};