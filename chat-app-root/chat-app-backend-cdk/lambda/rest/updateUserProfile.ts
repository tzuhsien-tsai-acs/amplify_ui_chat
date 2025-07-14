import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';
import * as AWS from 'aws-sdk';
import { documentClient } from '../utils/dynamoDbClient';

const cognito = new AWS.CognitoIdentityServiceProvider();
const usersTable = process.env.USERS_TABLE || '';

// Define the update parameters interface
interface UpdateParams {
  TableName: string;
  Key: {
    userId: string;
  };
  UpdateExpression: string;
  ExpressionAttributeValues: {
    ':updatedAt': string;
    ':displayName'?: string;
    ':bio'?: string;
    ':avatarUrl'?: string;
  };
  ReturnValues: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract userId from path parameters
    const userId = event.pathParameters?.userId;
    
    // Get authenticated user ID from Cognito authorizer
    const authenticatedUserId = event.requestContext.authorizer?.claims?.sub;
    
    // Check if the user is trying to update their own profile
    if (userId !== authenticatedUserId) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Forbidden: You can only update your own profile',
        }),
      };
    }
    
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { displayName, avatarUrl, bio } = requestBody;
    
    // Check if user exists
    const getParams: DynamoDB.DocumentClient['GetItemInput'] = {
      TableName: usersTable,
      Key: {
        userId,
      },
    };
    
    const userResult = await documentClient.get(getParams).promise();
    
    if (!userResult.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'User not found',
        }),
      };
    }
    
    // Update user profile in DynamoDB
    const timestamp = new Date().toISOString();
    
    // Ensure userId is not undefined
    if (!userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Missing userId parameter',
        }),
      };
    }
    
    const updateParams: UpdateParams = {
      TableName: usersTable,
      Key: {
        userId: userId,
      },
      UpdateExpression: 'set updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': timestamp,
      },
      ReturnValues: 'ALL_NEW',
    };
    
    // Add optional fields to update expression if provided
    if (displayName) {
      updateParams.UpdateExpression += ', displayName = :displayName';
      updateParams.ExpressionAttributeValues[':displayName'] = displayName;
    }
    
    if (bio) {
      updateParams.UpdateExpression += ', bio = :bio';
      updateParams.ExpressionAttributeValues[':bio'] = bio;
    }
    
    if (avatarUrl) {
      updateParams.UpdateExpression += ', avatarUrl = :avatarUrl';
      updateParams.ExpressionAttributeValues[':avatarUrl'] = avatarUrl;
      
      // Also update the custom attribute in Cognito
      try {
        // Get user pool ID from the id token
        const userPoolId = event.requestContext.authorizer?.claims?.iss.split('/').pop();
        
        if (userPoolId) {
          await cognito.adminUpdateUserAttributes({
            UserPoolId: userPoolId,
            Username: userId,
            UserAttributes: [
              {
                Name: 'custom:avatarUrl',
                Value: avatarUrl,
              },
            ],
          }).promise();
        }
      } catch (cognitoError) {
        console.error('Error updating Cognito attributes:', cognitoError);
        // Continue with DynamoDB update even if Cognito update fails
      }
    }
    
    const result = await documentClient.update(updateParams).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result.Attributes),
    };
  } catch (error: unknown) {
    console.error('Error updating user profile:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error updating user profile',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};