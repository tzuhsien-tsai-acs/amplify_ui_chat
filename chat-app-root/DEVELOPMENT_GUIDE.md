# Chat App Development and Deployment Guide

This guide provides detailed instructions for setting up the development environment, deploying the backend infrastructure, and running the frontend application for the Chat App project.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Backend Deployment](#backend-deployment)
3. [Frontend Configuration and Running](#frontend-configuration-and-running)
4. [Lambda Layers Management](#lambda-layers-management)
5. [Environment Variables and Configuration](#environment-variables-and-configuration)
6. [Troubleshooting](#troubleshooting)

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
   - Example configuration:
     ```
     AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
     AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
     Default region name [None]: us-east-1
     Default output format [None]: json
     ```

3. **AWS CDK**:
   - Install AWS CDK globally:
     ```bash
     npm install -g aws-cdk
     ```
   - Verify installation:
     ```bash
     cdk --version
     ```

### Project Setup

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

3. **Install frontend dependencies**:
   ```bash
   cd ../chat-app-frontend
   npm install
   ```

## Backend Deployment

### Bootstrap CDK (First-time setup)

Before deploying for the first time in a new AWS account/region, you need to bootstrap CDK:

```bash
cd chat-app-backend-cdk
npm run bootstrap
```

This creates the necessary resources in your AWS account for CDK deployments.

### Build and Deploy

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

### Deployment Outputs

After successful deployment, note the following outputs from the CDK deployment:

- WebSocket API URL
- REST API URL
- Cognito User Pool ID
- Cognito User Pool Client ID
- Identity Pool ID

These values will be needed to configure the frontend application.

## Frontend Configuration and Running

### Configure aws-exports.js

Create or update `chat-app-frontend/src/aws-exports.js` with the outputs from the CDK deployment:

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

### Run the Frontend Application

1. **Start the development server**:
   ```bash
   cd chat-app-frontend
   npm start
   ```

2. **Access the application**:
   Open your browser and navigate to http://localhost:3000

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

1. Edit `lambda-layers/common/nodejs/package.json` to add new dependencies:
   ```json
   {
     "name": "chat-app-lambda-layer",
     "version": "1.0.0",
     "description": "Common dependencies for Chat App Lambda functions",
     "dependencies": {
       "aws-sdk": "^2.1413.0",
       "uuid": "^9.0.0",
       "jsonwebtoken": "^9.0.0",
       "axios": "^1.4.0",
       "your-new-dependency": "^1.0.0"
     }
   }
   ```

2. Run `npm run build:layer` to install the dependencies
3. Deploy the updated layer with `npm run deploy`

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

## Troubleshooting

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

6. **Frontend Connection Issues**:
   - **Issue**: Frontend can't connect to backend services
   - **Solution**:
     - Verify `aws-exports.js` contains correct endpoint URLs and IDs
     - Check browser console for CORS errors
     - Ensure Cognito authentication is properly configured

### Debugging Tips

1. **CloudWatch Logs**:
   - All Lambda functions log to CloudWatch
   - Check logs for errors and debugging information

2. **CDK Diff**:
   - Before deploying, run `npm run diff` to see what changes will be made

3. **Local Testing**:
   - Use AWS SAM to test Lambda functions locally before deployment

4. **Browser Developer Tools**:
   - Use browser developer tools to debug frontend issues
   - Check network requests and console errors

## Cleanup

To remove all resources created by this project:

1. **Delete CDK stacks**:
   ```bash
   cd chat-app-backend-cdk
   npm run destroy
   ```

2. **Verify resource deletion**:
   - Check the AWS Management Console to ensure all resources have been deleted
   - Some resources like S3 buckets with objects may require manual deletion