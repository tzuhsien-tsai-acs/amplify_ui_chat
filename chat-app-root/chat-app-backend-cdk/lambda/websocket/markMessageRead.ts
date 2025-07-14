import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

const dynamoDB = new DynamoDB.DocumentClient();
const messageReadStatusTable = process.env.MESSAGE_READ_STATUS_TABLE || '';

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
  if (!body.messageId || !body.roomId) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Missing required fields: messageId and roomId are required',
      }),
    };
  }
  
  const { messageId, roomId } = body;
  
  try {
    // Get user information from the connections table
    const connectionsTable = process.env.CONNECTIONS_TABLE || '';
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
    
    const userId = connectionData.Item.userId;
    
    // Mark the message as read
    const timestamp = new Date().toISOString();
    await dynamoDB.put({
      TableName: messageReadStatusTable,
      Item: {
        userId,
        messageId,
        roomId,
        isRead: true,
        readAt: timestamp,
      },
    }).promise();
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Message marked as read',
        messageId,
        userId,
        readAt: timestamp,
      }),
    };
  } catch (error) {
    console.error('Error marking message as read:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to mark message as read',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};