import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import { documentClient } from '../utils/dynamoDbClient';

const chatRoomsTable = process.env.CHAT_ROOMS_TABLE || '';

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
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
    
    // Extract query parameters for pagination
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const lastEvaluatedKey = queryParams.nextToken 
      ? JSON.parse(Buffer.from(queryParams.nextToken, 'base64').toString()) 
      : undefined;
    
    // Option to filter by rooms created by the user
    const createdByMe = queryParams.createdByMe === 'true';
    
    if (createdByMe) {
      // Query rooms created by the user using the GSI
      const params: DynamoDB.DocumentClient["QueryInput"] = {
        TableName: chatRoomsTable,
        IndexName: 'createdBy-index',
        KeyConditionExpression: 'createdBy = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        Limit: limit,
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
          chatRooms: result.Items,
          nextToken,
        }),
      };
    } else {
      // Scan for all public rooms and private rooms where the user is a member
      const params: DynamoDB.DocumentClient["ScanInput"] = {
        TableName: chatRoomsTable,
        FilterExpression: 'isPrivate = :false OR contains(members, :userId)',
        ExpressionAttributeValues: {
          ':false': false,
          ':userId': userId,
        },
        Limit: limit,
        ExclusiveStartKey: lastEvaluatedKey,
      };
      
      const result = await documentClient.scan(params).promise();
      
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
          chatRooms: result.Items,
          nextToken,
        }),
      };
    }
  } catch (error: unknown) {
    console.error('Error listing chat rooms:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error listing chat rooms',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};