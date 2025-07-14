import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDB = new DynamoDB.DocumentClient();
const connectionsTable = process.env.CONNECTIONS_TABLE || '';

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
    await dynamoDB.put({
      TableName: connectionsTable,
      Item: {
        connectionId,
        userId,
        roomId,
        username,
        connectedAt: new Date().toISOString(),
      },
    }).promise();
    
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Connected successfully',
      }),
    };
  } catch (error) {
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