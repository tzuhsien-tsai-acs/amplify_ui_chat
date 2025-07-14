import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { documentClient } from '../utils/dynamoDbClient';

// Import AWS SDK types
import ApiGatewayManagementApi = require('aws-sdk/clients/apigatewaymanagementapi');

const connectionsTable = process.env.CONNECTIONS_TABLE || '';
const messagesTable = process.env.MESSAGES_TABLE || '';
const apiGatewayEndpoint = process.env.API_GATEWAY_ENDPOINT || '';

// Define interfaces for type safety
interface ConnectionItem {
  connectionId: string;
  userId: string;
  roomId: string;
  username?: string;
}

interface MessageItem {
  id: string;
  roomId: string;
  content: string;
  sender: string;
  senderName: string;
  timestamp: string;
  connectionId: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  // Parse the request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Invalid request body',
      }),
    };
  }
  
  // Validate required fields
  if (!body.roomId || !body.content) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Missing required fields: roomId and content are required',
      }),
    };
  }
  
  const { roomId, content } = body;
  
  try {
    // Get sender information from the connections table
    const connectionData = await documentClient.get({
      TableName: connectionsTable,
      Key: { connectionId },
    }).promise();
    
    if (!connectionData.Item) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Connection not found',
        }),
      };
    }
    
    const sender = connectionData.Item as ConnectionItem;
    
    // Create a new message
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const message: MessageItem = {
      id: messageId,
      roomId,
      content,
      sender: sender.userId,
      senderName: sender.username || 'Anonymous',
      timestamp,
      connectionId: connectionId as string,
    };
    
    // Store the message in DynamoDB
    await documentClient.put({
      TableName: messagesTable,
      Item: message,
    }).promise();
    
    // Get all connections for the room
    const connectionsResponse = await documentClient.query({
      TableName: connectionsTable,
      IndexName: 'roomId-index',
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }).promise();
    
    const connections = connectionsResponse.Items as ConnectionItem[] || [];
    
    // Create API Gateway Management API client
    const domain = apiGatewayEndpoint.replace('https://', '').replace('wss://', '');
    const apiGateway = new ApiGatewayManagementApi({
      endpoint: domain,
    });
    
    // Prepare the message payload to broadcast
    const messagePayload = JSON.stringify({
      action: 'messageReceived',
      message,
    });
    
    // Send the message to all connected clients in the room
    const sendPromises = connections.map(async (connection: ConnectionItem) => {
      try {
        await apiGateway.postToConnection({
          ConnectionId: connection.connectionId,
          Data: messagePayload,
        }).promise();
      } catch (error: any) {
        // If the connection is stale, delete it
        if (error.statusCode === 410) {
          console.log(`Stale connection: ${connection.connectionId}`);
          await documentClient.delete({
            TableName: connectionsTable,
            Key: { connectionId: connection.connectionId },
          }).promise();
        } else {
          console.error(`Error sending message to ${connection.connectionId}:`, error);
        }
      }
    });
    
    await Promise.all(sendPromises);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Message sent successfully',
        messageId,
      }),
    };
  } catch (error: unknown) {
    console.error('Error sending message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to send message',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};