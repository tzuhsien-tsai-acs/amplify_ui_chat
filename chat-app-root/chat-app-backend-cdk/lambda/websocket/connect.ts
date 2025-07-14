import { APIGatewayProxyHandler } from 'aws-lambda';
import { documentClient } from '../utils/dynamoDbClient';

const connectionsTable = process.env.CONNECTIONS_TABLE || '';

// Define the connection item interface
interface ConnectionItem {
  connectionId: string;
  userId: string;
  roomId: string;
  username: string;
  connectedAt: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  
  // Extract query parameters if available
  const queryParams = event.queryStringParameters || {};
  const userId = queryParams.userId || 'anonymous';
  const roomId = queryParams.roomId || 'default';
  const username = queryParams.username || 'Anonymous User';
  
  console.log(`WebSocket Connect: ConnectionId: ${connectionId}, UserId: ${userId}, RoomId: ${roomId}`);
  
  try {
    // Store connection information in DynamoDB
    const connectionItem: ConnectionItem = {
      connectionId: connectionId as string,
      userId,
      roomId,
      username,
      connectedAt: new Date().toISOString(),
    };
    
    await dynamoDB.put({
      TableName: connectionsTable,
      Item: connectionItem,
    }).promise();
    
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Connected successfully',
      }),
    };
  } catch (error: unknown) {
    console.error('Error connecting:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to connect',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};