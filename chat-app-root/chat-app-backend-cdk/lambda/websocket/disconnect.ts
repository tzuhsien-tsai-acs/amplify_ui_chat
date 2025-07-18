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
  console.log(`WebSocket Disconnect: ConnectionId: ${connectionId}`);
  
  try {
    // Get connection details before deleting
    const connectionData = await documentClient.get({
      TableName: connectionsTable,
      Key: { connectionId },
    }).promise();
    
    const connection = connectionData.Item as ConnectionItem | undefined;
    
    // Delete the connection from DynamoDB
    await documentClient.delete({
      TableName: connectionsTable,
      Key: { connectionId },
    }).promise();
    
    // If we have connection details, we could notify other users in the same room
    // that this user has disconnected (not implemented in this example)
    if (connection) {
      console.log(`User ${connection.userId} disconnected from room ${connection.roomId}`);
      
      // Here you could implement logic to notify other users in the same room
      // that this user has disconnected
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Disconnected successfully',
      }),
    };
  } catch (error: unknown) {
    console.error('Error disconnecting:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to disconnect',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};