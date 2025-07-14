# Chat App Backend CDK

This project contains the AWS CDK infrastructure code for the Chat App backend, providing WebSocket API for real-time messaging, REST API for data operations, and authentication services.

## Architecture

The backend uses the following AWS services:

- **Amazon Cognito** - User authentication and authorization
- **Amazon API Gateway (WebSocket API)** - Handles WebSocket connections for real-time communication
- **Amazon API Gateway (REST API)** - Provides HTTP endpoints for data operations
- **AWS Lambda** - Processes API requests and WebSocket events
- **Amazon DynamoDB** - Stores user data, connection information, and chat messages
- **Amazon S3** - Stores user files and attachments
- **AWS IAM** - Manages permissions between services

## Project Structure

```
chat-app-backend-cdk/
├── bin/
│   └── chat-app-backend.ts       # CDK application entry point
├── lib/
│   ├── chat-app-api-stack.ts     # WebSocket & REST API Stack definition
│   ├── chat-app-data-stack.ts    # DynamoDB & S3 Stack definition
│   └── chat-app-user-pool-stack.ts # Cognito User Pool Stack definition
├── lambda/                       # Lambda function code
│   ├── websocket/                # WebSocket API Lambda functions
│   │   ├── connect.ts            # $connect route handler
│   │   ├── disconnect.ts         # $disconnect route handler
│   │   └── sendMessage.ts        # sendMessage route handler
│   ├── rest/                     # REST API Lambda functions
│   │   ├── getChatHistory.ts     # Get chat history handler
│   │   ├── createChatRoom.ts     # Create chat room handler
│   │   └── ...                   # Other REST API handlers
│   ├── events/                   # Event-driven Lambda functions
│   │   └── cognitoPostConfirmation.ts # Cognito post-confirmation trigger
│   └── utils/                    # Utility Lambda functions
│       └── s3PresignedUrl.ts     # Generate S3 presigned URLs
├── lambda-layers/                # Lambda layers
│   └── common/
│       └── nodejs/
│           └── package.json      # Common Lambda layer dependencies
├── package.json                  # CDK project dependencies
├── tsconfig.json                 # TypeScript configuration
└── cdk.json                      # CDK configuration
```

## Development Environment Setup

### Prerequisites

1. **Node.js and npm**:
   - Install Node.js (v14 or later) and npm from [nodejs.org](https://nodejs.org/)
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **AWS CLI**:
   - Install AWS CLI from [aws.amazon.com/cli](https://aws.amazon.com/cli/)
   - Configure with your AWS credentials:
     ```bash
     aws configure
     ```
   - Enter your AWS Access Key ID, Secret Access Key, default region, and output format

3. **AWS CDK**:
   - Install AWS CDK globally:
     ```bash
     npm install -g aws-cdk
     ```
   - Verify installation:
     ```bash
     cdk --version
     ```

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd chat-app-root
   ```

2. **Install backend dependencies**:
   ```bash
   cd chat-app-backend-cdk
   npm install
   ```
   This will also install the Lambda layer dependencies due to the postinstall script.

3. **Build the project**:
   ```bash
   npm run build
   ```

4. **Install frontend dependencies**:
   ```bash
   cd ../chat-app-frontend
   npm install
   ```

## Lambda Layers Management

Lambda layers are used to share common dependencies across Lambda functions. The project includes a common layer with shared utilities and dependencies.

### Building Lambda Layers

1. **Install layer dependencies**:
   ```bash
   cd chat-app-backend-cdk
   npm run build:layer
   ```
   This runs `npm install --production` in the lambda-layers/common/nodejs directory.

2. **Layer structure**:
   - The layer is structured according to AWS Lambda requirements
   - Node.js modules are placed in the `nodejs` directory
   - When deployed, these modules will be available at `/opt/nodejs` in the Lambda runtime

### Adding Dependencies to Lambda Layers

1. Edit `lambda-layers/common/nodejs/package.json` to add new dependencies
2. Run `npm run build:layer` to install the dependencies
3. Deploy the updated layer with `npm run deploy`

## Deployment Process

### Bootstrap CDK (First-time setup)

Before deploying for the first time in a new AWS account/region, you need to bootstrap CDK:

```bash
cd chat-app-backend-cdk
npm run bootstrap
```

This creates the necessary resources in your AWS account for CDK deployments.

### Deploy the Backend

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy all stacks**:
   ```bash
   npm run deploy
   ```
   This deploys all stacks (UserPool, Data, and API) in the correct order.

3. **For faster iterations during development**:
   ```bash
   npm run deploy:hotswap
   ```
   This uses CDK's hotswap deployment for faster updates when only code changes.

4. **After deployment, note the outputs**:
   - WebSocket API URL
   - REST API URL
   - Cognito User Pool ID
   - Cognito User Pool Client ID
   - Identity Pool ID

### Configure Frontend with Backend Resources

After deploying the backend, you need to configure the frontend to use the deployed resources:

1. Create or update `chat-app-frontend/src/aws-exports.js`:
   ```javascript
   const awsmobile = {
     "aws_project_region": "<YOUR_REGION>",
     "aws_cognito_region": "<YOUR_REGION>",
     "aws_user_pools_id": "<USER_POOL_ID>",
     "aws_user_pools_web_client_id": "<USER_POOL_CLIENT_ID>",
     "aws_cognito_identity_pool_id": "<IDENTITY_POOL_ID>",
     "aws_appsync_graphqlEndpoint": "<REST_API_URL>",
     "aws_appsync_region": "<YOUR_REGION>",
     "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
     "aws_cloud_logic_custom": [
       {
         "name": "ChatAPI",
         "endpoint": "<REST_API_URL>",
         "region": "<YOUR_REGION>"
       }
     ],
     "websocket_url": "<WEBSOCKET_API_URL>"
   };
   
   export default awsmobile;
   ```

2. Start the frontend development server:
   ```bash
   cd ../chat-app-frontend
   npm start
   ```

## Environment Variables and Configuration

### Backend Environment Variables

Lambda functions use environment variables for configuration, which are set in the CDK stacks:

- **WebSocket Lambda Functions**:
  - `CONNECTIONS_TABLE`: DynamoDB table for WebSocket connections
  - `MESSAGES_TABLE`: DynamoDB table for chat messages
  - `API_GATEWAY_ENDPOINT`: WebSocket API endpoint for sending messages

- **REST API Lambda Functions**:
  - `USERS_TABLE`: DynamoDB table for user profiles
  - `CHAT_ROOMS_TABLE`: DynamoDB table for chat rooms
  - `MESSAGES_TABLE`: DynamoDB table for chat messages
  - `FILES_BUCKET`: S3 bucket for file storage

### Frontend Configuration

The frontend uses `aws-exports.js` for configuration, which includes:

- Cognito User Pool and Identity Pool IDs
- API endpoints (REST and WebSocket)
- AWS region information

## Troubleshooting Guide

### Common Issues and Solutions

1. **CDK Bootstrap Error**:
   - **Issue**: `The CDK CLI requires bootstrap resources to be created`
   - **Solution**: Run `cdk bootstrap aws://<account>/<region>`

2. **Lambda Layer Deployment Issues**:
   - **Issue**: Lambda functions can't find modules in the layer
   - **Solution**: 
     - Ensure layer dependencies are installed with `npm run build:layer`
     - Check that the layer structure follows `/nodejs/node_modules/`
     - Verify Lambda functions reference the layer correctly

3. **Permission Issues**:
   - **Issue**: `AccessDenied` errors during deployment
   - **Solution**: 
     - Verify AWS CLI is configured with credentials that have sufficient permissions
     - Check IAM policies for the deployment role

4. **WebSocket Connection Issues**:
   - **Issue**: Can't connect to WebSocket API
   - **Solution**:
     - Verify the WebSocket URL is correct
     - Check CORS settings if connecting from a browser
     - Ensure authentication parameters are correctly provided

5. **Build Failures**:
   - **Issue**: `npm run build` fails with TypeScript errors
   - **Solution**:
     - Fix TypeScript errors in the codebase
     - Ensure `tsconfig.json` is correctly configured
     - Run `npm install` to ensure all dependencies are installed

### Debugging Tips

1. **CloudWatch Logs**:
   - All Lambda functions log to CloudWatch
   - Check logs for errors and debugging information

2. **CDK Diff**:
   - Before deploying, run `npm run diff` to see what changes will be made

3. **Local Testing**:
   - Use AWS SAM to test Lambda functions locally before deployment

## Cleanup

To remove all resources created by this CDK project:

```bash
cd chat-app-backend-cdk
npm run destroy
```

This will destroy all stacks in the reverse order of their dependencies.

## Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [AWS Lambda Layers Documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-layers.html)
- [Amazon API Gateway WebSocket API Documentation](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html)
- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html)