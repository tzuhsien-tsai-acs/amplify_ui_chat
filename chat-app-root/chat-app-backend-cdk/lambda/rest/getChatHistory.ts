import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { documentClient, QueryInput } from '../utils/dynamoDbClient';

const messagesTable = process.env.MESSAGES_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract roomId from path parameters
    const roomId = event.pathParameters?.roomId;
    
    if (!roomId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Missing roomId parameter',
        }),
      };
    }
    
    // Extract query parameters for pagination
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const lastEvaluatedKey = queryParams.nextToken 
      ? JSON.parse(Buffer.from(queryParams.nextToken, 'base64').toString()) 
      : undefined;
    
    // Query messages for the specified room
    const params: QueryInput = {
      TableName: messagesTable,
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
      Limit: limit,
      ScanIndexForward: false, // Sort in descending order (newest first)
      ExclusiveStartKey: lastEvaluatedKey,
    };
    
    const result = await documentClient.query(params).promise();
    
    // Prepare pagination token if there are more results
    let nextToken;
    if (result.LastEvaluatedKey) {
      nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        messages: result.Items,
        nextToken,
      }),
    };
  } catch (error: unknown) {
    console.error('Error retrieving chat history:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error retrieving chat history',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};