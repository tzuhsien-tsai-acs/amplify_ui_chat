import { CognitoUserPoolTriggerHandler } from 'aws-lambda';
import { documentClient } from '../utils/dynamoDbClient';

const usersTable = process.env.USERS_TABLE || '';

// Define the user interface to fix type issues
interface User {
  userId: string | undefined;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  avatarUrl?: string;
}

export const handler: CognitoUserPoolTriggerHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Only process post confirmation events
    if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') {
      return event;
    }
    
    const { userName, request } = event;
    const { userAttributes } = request;
    
    // Extract user information from the event
    const userId = userName;
    const email = userAttributes.email;
    const timestamp = new Date().toISOString();
    
    // Generate a default display name from the email
    const displayName = email.split('@')[0];
    
    // Create a new user record in DynamoDB
    const user: User = {
      userId,
      email,
      displayName,
      createdAt: timestamp,
      updatedAt: timestamp,
      isActive: true,
    };
    
    // Add optional attributes if present
    if (userAttributes['custom:avatarUrl']) {
      user.avatarUrl = userAttributes['custom:avatarUrl'];
    }
    
    if (userAttributes.nickname) {
      user.displayName = userAttributes.nickname;
    }
    
    // Save the user to DynamoDB
    await documentClient.put({
      TableName: usersTable,
      Item: user,
      // Ensure we don't overwrite an existing user with the same ID
      ConditionExpression: 'attribute_not_exists(userId)',
    }).promise();
    
    console.log(`User ${userId} successfully added to DynamoDB`);
    
    return event;
  } catch (error: unknown) {
    console.error('Error in post confirmation handler:', error);
    
    // If this is a conditional check failure, the user already exists
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ConditionalCheckFailedException') {
      console.log('User already exists in DynamoDB, skipping creation');
      return event;
    }
    
    // For other errors, we still return the event to avoid blocking user confirmation
    // but log the error for investigation
    return event;
  }
};