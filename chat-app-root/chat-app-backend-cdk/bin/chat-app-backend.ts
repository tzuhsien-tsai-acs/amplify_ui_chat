#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatAppUserPoolStack } from '../lib/chat-app-user-pool-stack';
import { ChatAppDataStack } from '../lib/chat-app-data-stack';
import { ChatAppApiStack } from '../lib/chat-app-api-stack';

const app = new cdk.App();

const env = { 
  account: process.env.CDK_DEFAULT_ACCOUNT, 
  region: process.env.CDK_DEFAULT_REGION 
};

// Create the User Pool Stack
const userPoolStack = new ChatAppUserPoolStack(app, 'ChatAppUserPoolStack', {
  env,
  description: 'Chat App User Pool Stack'
});

// Create the Data Stack
const dataStack = new ChatAppDataStack(app, 'ChatAppDataStack', {
  env,
  description: 'Chat App Data Stack'
});

// Create the API Stack
new ChatAppApiStack(app, 'ChatAppApiStack', {
  env,
  description: 'Chat App API Stack',
  userPool: userPoolStack.userPool,
  connectionsTable: dataStack.connectionsTable,
  messagesTable: dataStack.messagesTable,
  usersTable: dataStack.usersTable,
  chatRoomsTable: dataStack.chatRoomsTable,
  filesBucket: dataStack.filesBucket
});