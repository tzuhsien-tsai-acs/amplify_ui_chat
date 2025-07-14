import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB, ApiGatewayManagementApi } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const dynamoDB = new DynamoDB.DocumentClient();
const connectionsTable = process.env.CONNECTIONS_TABLE || '';
const messagesTable = process.env.MESSAGES_TABLE || '';
const messageReadStatusTable = process.env.MESSAGE_READ_STATUS_TABLE || '';
const apiGatewayEndpoint = process.env.API_GATEWAY_ENDPOINT || '';

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
    const connectionData = await dynamoDB.get({
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
    
    const sender = connectionData.Item;
    
    // Create a new message
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    const message = {
      id: messageId,
      roomId,
      content,
      sender: sender.userId,
      senderName: sender.username || 'Anonymous',
      timestamp,
      connectionId,
    };
    
    // Store the message in DynamoDB
    await dynamoDB.put({
      TableName: messagesTable,
      Item: message,
    }).promise();
    
    // Get all connections for the room
    const connectionsResponse = await dynamoDB.query({
      TableName: connectionsTable,
      IndexName: 'roomId-index',
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
    }).promise();
    
    const connections = connectionsResponse.Items || [];
    
    // Create read status entries for all users in the room
    // The sender automatically has read status set to true
    const readStatusPromises = connections.map(async (connection) => {
      await dynamoDB.put({
        TableName: messageReadStatusTable,
        Item: {
          userId: connection.userId,
          messageId: messageId,
          roomId: roomId,
          isRead: connection.connectionId === connectionId, // true for sender, false for others
          readAt: connection.connectionId === connectionId ? new Date().toISOString() : null,
        },
      }).promise();
    });
    
    await Promise.all(readStatusPromises);
    
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
    const sendPromises = connections.map(async (connection) => {
      try {
        await apiGateway.postToConnection({
          ConnectionId: connection.connectionId,
          Data: messagePayload,
        }).promise();
      } catch (error: any) {
        // If the connection is stale, delete it
        if (error.statusCode === 410) {
          console.log(`Stale connection: ${connection.connectionId}`);
          await dynamoDB.delete({
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
  } catch (error) {
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