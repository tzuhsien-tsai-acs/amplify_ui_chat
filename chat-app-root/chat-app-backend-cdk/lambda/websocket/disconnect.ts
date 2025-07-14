import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDB = new DynamoDB.DocumentClient();
const connectionsTable = process.env.CONNECTIONS_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  console.log(`WebSocket Disconnect: ConnectionId: ${connectionId}`);
  
  try {
    // Get connection details before deleting
    const connectionData = await dynamoDB.get({
      TableName: connectionsTable,
      Key: { connectionId },
    }).promise();
    
    const connection = connectionData.Item;
    
    // Delete the connection from DynamoDB
    await dynamoDB.delete({
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
  } catch (error) {
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