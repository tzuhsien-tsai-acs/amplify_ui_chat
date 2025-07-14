#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatAppApiStack } from '../lib/chat-app-api-stack';

const app = new cdk.App();

// Create the WebSocket API Stack
new ChatAppApiStack(app, 'ChatAppApiStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  description: 'Chat App WebSocket API Stack'
});