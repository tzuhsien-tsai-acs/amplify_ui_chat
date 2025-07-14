#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatAppUserPoolStack } from '../lib/chat-app-user-pool-stack';
import { ChatAppDataStack } from '../lib/chat-app-data-stack';
import { ChatAppApiStack } from '../lib/chat-app-api-stack';

/**
 * Main entry point for the Chat App CDK application.
 * This file coordinates the deployment of all stacks in the correct order,
 * ensuring dependencies between stacks are properly managed.
 */
const app = new cdk.App();

// Define environment - uses the default account and region from AWS CLI configuration
// Can be overridden using CDK_DEFAULT_ACCOUNT and CDK_DEFAULT_REGION environment variables
const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

// Create tags that will be applied to all resources
cdk.Tags.of(app).add('Project', 'ChatApp');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'dev');

// Create the User Pool Stack - Authentication resources
const userPoolStack = new ChatAppUserPoolStack(app, 'ChatAppUserPoolStack', {
  env,
  description: 'Chat App User Pool Stack - Cognito resources for user authentication'
});

// Create the Data Stack - Database and storage resources
const dataStack = new ChatAppDataStack(app, 'ChatAppDataStack', {
  env,
  description: 'Chat App Data Stack - DynamoDB tables and S3 bucket for data storage'
});

// Create the API Stack - API Gateway, Lambda functions, and integrations
// This stack depends on both the User Pool Stack and Data Stack
const apiStack = new ChatAppApiStack(app, 'ChatAppApiStack', {
  env,
  description: 'Chat App API Stack - WebSocket and REST APIs with Lambda integrations',
  userPool: userPoolStack.userPool,
  connectionsTable: dataStack.connectionsTable,
  messagesTable: dataStack.messagesTable,
  usersTable: dataStack.usersTable,
  chatRoomsTable: dataStack.chatRoomsTable,
  filesBucket: dataStack.filesBucket
});

// Add explicit dependencies
apiStack.addDependency(userPoolStack);
apiStack.addDependency(dataStack);

// Update the Lambda function in the User Pool Stack to use the Users table from the Data Stack
// This creates a circular dependency, so we need to handle it carefully
userPoolStack.node.addDependency(dataStack);

// Output the API endpoints and other important information
new cdk.CfnOutput(app, 'WebSocketApiEndpoint', {
  value: apiStack.node.findChild('WebSocketApiUrl').toString(),
  description: 'WebSocket API Endpoint for real-time messaging',
  exportName: 'ChatAppWebSocketApiEndpoint'
});

new cdk.CfnOutput(app, 'RestApiEndpoint', {
  value: apiStack.node.findChild('RestApiUrl').toString(),
  description: 'REST API Endpoint for chat application',
  exportName: 'ChatAppRestApiEndpoint'
});

new cdk.CfnOutput(app, 'UserPoolId', {
  value: userPoolStack.userPool.userPoolId,
  description: 'Cognito User Pool ID',
  exportName: 'ChatAppUserPoolId'
});

new cdk.CfnOutput(app, 'UserPoolClientId', {
  value: userPoolStack.userPoolClient.userPoolClientId,
  description: 'Cognito User Pool Client ID',
  exportName: 'ChatAppUserPoolClientId'
});

new cdk.CfnOutput(app, 'IdentityPoolId', {
  value: userPoolStack.identityPool.ref,
  description: 'Cognito Identity Pool ID',
  exportName: 'ChatAppIdentityPoolId'
});