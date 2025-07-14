# Chat App Backend CDK

This project contains the AWS CDK infrastructure code for the Chat App backend, focusing on WebSocket API for real-time messaging.

## Architecture

The backend uses the following AWS services:

- **Amazon API Gateway (WebSocket API)** - Handles WebSocket connections for real-time communication
- **AWS Lambda** - Processes WebSocket events and messages
- **Amazon DynamoDB** - Stores connection information and chat messages
- **AWS IAM** - Manages permissions between services

## Project Structure

```
chat-app-backend-cdk/
├── bin/
│   └── chat-app-backend.ts       # CDK application entry point
├── lib/
│   └── chat-app-api-stack.ts     # WebSocket API & Lambda Stack definition
├── lambda/                       # Lambda function code
│   └── websocket/                # WebSocket API Lambda functions
│       ├── connect.ts            # $connect route handler
│       ├── disconnect.ts         # $disconnect route handler
│       └── sendMessage.ts        # sendMessage route handler
├── lambda-layers/                # Lambda layers
│   └── common/
│       └── nodejs/
│           └── package.json      # Common Lambda layer dependencies
├── package.json                  # CDK project dependencies
├── tsconfig.json                 # TypeScript configuration
└── cdk.json                      # CDK configuration
```

## Quick Start Guide

### Prerequisites

- Node.js (v14 or later)
- AWS CLI configured with appropriate credentials
- AWS CDK installed globally (`npm install -g aws-cdk`)

### Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Bootstrap CDK** (if not already done in your AWS account):
   ```bash
   cdk bootstrap
   ```

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Deploy the stack**:
   ```bash
   cdk deploy
   ```

5. **Note the outputs**:
   After deployment, CDK will output important information like the WebSocket API URL. You'll need this URL to connect from the frontend.

### WebSocket API Usage

The WebSocket API supports the following routes:

- **$connect** - Establishes a WebSocket connection
  - Query parameters:
    - `userId`: User identifier
    - `roomId`: Chat room identifier
    - `username`: Display name for the user

- **$disconnect** - Handles connection termination

- **sendMessage** - Sends a message to a chat room
  - Message format:
    ```json
    {
      "action": "sendMessage",
      "roomId": "room-id",
      "content": "Hello, world!"
    }
    ```

## Cleanup

To remove all resources created by this CDK stack:

```bash
cdk destroy
```