import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { CfnWebSocketApi, CfnStage } from 'aws-cdk-lib/aws-apigatewayv2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as path from 'path';
import { WebSocketLambdaIntegration } from './websocket-integrations';

interface ChatAppApiStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
  connectionsTable: dynamodb.Table;
  messagesTable: dynamodb.Table;
  usersTable: dynamodb.Table;
  chatRoomsTable: dynamodb.Table;
  filesBucket: s3.Bucket;
}

export class ChatAppApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChatAppApiStackProps) {
    super(scope, id, props);

    // Extract resources from props
    const { userPool, connectionsTable, messagesTable, usersTable, chatRoomsTable, filesBucket } = props;

    // Create Lambda layer with common dependencies
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-layers/common')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common dependencies for Lambda functions',
    });

    // ===== WebSocket API =====
    // Create WebSocket API
    const webSocketApi = new CfnWebSocketApi(this, 'ChatWebSocketApi', {
      name: 'ChatWebSocketApi',
      routeSelectionExpression: '$request.body.action',
      description: 'WebSocket API for real-time chat application',
    });

    // Create WebSocket API Stage
    const webSocketStage = new CfnStage(this, 'ChatWebSocketStage', {
      apiId: webSocketApi.ref,
      stageName: 'prod',
      autoDeploy: true,
    });

    // Create Lambda functions for WebSocket routes
    const connectFunction = new lambda.Function(this, 'ConnectFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'connect.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/websocket')),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
      layers: [commonLayer],
    });

    const disconnectFunction = new lambda.Function(this, 'DisconnectFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'disconnect.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/websocket')),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
      },
      layers: [commonLayer],
    });

    const sendMessageFunction = new lambda.Function(this, 'SendMessageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'sendMessage.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/websocket')),
      environment: {
        CONNECTIONS_TABLE: connectionsTable.tableName,
        MESSAGES_TABLE: messagesTable.tableName,
        API_GATEWAY_ENDPOINT: `https://${webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
      },
      layers: [commonLayer],
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions to Lambda functions
    connectionsTable.grantReadWriteData(connectFunction);
    connectionsTable.grantReadWriteData(disconnectFunction);
    connectionsTable.grantReadWriteData(sendMessageFunction);
    messagesTable.grantReadWriteData(sendMessageFunction);

    // Allow Lambda functions to manage WebSocket connections
    const apiGatewayPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/${webSocketStage.stageName}/POST/@connections/*`,
      ],
    });

    connectFunction.addToRolePolicy(apiGatewayPolicy);
    disconnectFunction.addToRolePolicy(apiGatewayPolicy);
    sendMessageFunction.addToRolePolicy(apiGatewayPolicy);

    // Create WebSocket API integrations
    const connectIntegrationUri = `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${connectFunction.functionArn}/invocations`;
    const disconnectIntegrationUri = `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${disconnectFunction.functionArn}/invocations`;
    const sendMessageIntegrationUri = `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${sendMessageFunction.functionArn}/invocations`;

    // Create WebSocket API integrations
    const connectIntegration = new apigatewayv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: connectIntegrationUri,
    });

    const disconnectIntegration = new apigatewayv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: disconnectIntegrationUri,
    });

    const sendMessageIntegration = new apigatewayv2.CfnIntegration(this, 'SendMessageIntegration', {
      apiId: webSocketApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: sendMessageIntegrationUri,
    });

    // Add routes to WebSocket API
    new apigatewayv2.CfnRoute(this, 'ConnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      target: `integrations/${connectIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: webSocketApi.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      target: `integrations/${disconnectIntegration.ref}`,
    });

    new apigatewayv2.CfnRoute(this, 'SendMessageRoute', {
      apiId: webSocketApi.ref,
      routeKey: 'sendMessage',
      authorizationType: 'NONE',
      target: `integrations/${sendMessageIntegration.ref}`,
    });

    // Grant permissions for Lambda functions to be invoked by API Gateway
    connectFunction.addPermission('InvokeByApiGateway', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/$connect`,
    });

    disconnectFunction.addPermission('InvokeByApiGateway', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/$disconnect`,
    });

    sendMessageFunction.addPermission('InvokeByApiGateway', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.ref}/*/sendMessage`,
    });

    // ===== REST API =====
    // Create REST API
    const restApi = new apigateway.RestApi(this, 'ChatRestApi', {
      restApiName: 'ChatRestApi',
      description: 'REST API for chat application',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ChatApiAuthorizer', {
      cognitoUserPools: [userPool],
    });

    const authorizerProps = {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // Create Lambda functions for REST API routes
    const getChatHistoryFunction = new lambda.Function(this, 'GetChatHistoryFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getChatHistory.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/rest')),
      environment: {
        MESSAGES_TABLE: messagesTable.tableName,
      },
      layers: [commonLayer],
    });

    const createChatRoomFunction = new lambda.Function(this, 'CreateChatRoomFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'createChatRoom.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/rest')),
      environment: {
        CHAT_ROOMS_TABLE: chatRoomsTable.tableName,
      },
      layers: [commonLayer],
    });

    const listChatRoomsFunction = new lambda.Function(this, 'ListChatRoomsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'listChatRooms.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/rest')),
      environment: {
        CHAT_ROOMS_TABLE: chatRoomsTable.tableName,
      },
      layers: [commonLayer],
    });

    const getUserProfileFunction = new lambda.Function(this, 'GetUserProfileFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getUserProfile.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/rest')),
      environment: {
        USERS_TABLE: usersTable.tableName,
      },
      layers: [commonLayer],
    });

    const updateUserProfileFunction = new lambda.Function(this, 'UpdateUserProfileFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateUserProfile.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/rest')),
      environment: {
        USERS_TABLE: usersTable.tableName,
      },
      layers: [commonLayer],
    });

    const s3PresignedUrlFunction = new lambda.Function(this, 'S3PresignedUrlFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 's3PresignedUrl.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/utils')),
      environment: {
        FILES_BUCKET: filesBucket.bucketName,
      },
      layers: [commonLayer],
    });

    // Grant permissions to Lambda functions
    messagesTable.grantReadData(getChatHistoryFunction);
    chatRoomsTable.grantReadWriteData(createChatRoomFunction);
    chatRoomsTable.grantReadData(listChatRoomsFunction);
    usersTable.grantReadData(getUserProfileFunction);
    usersTable.grantReadWriteData(updateUserProfileFunction);
    filesBucket.grantReadWrite(s3PresignedUrlFunction);

    // Create REST API resources and methods
    const chatRoomsResource = restApi.root.addResource('chat-rooms');
    const chatRoomResource = chatRoomsResource.addResource('{roomId}');
    const messagesResource = chatRoomResource.addResource('messages');
    const usersResource = restApi.root.addResource('users');
    const userResource = usersResource.addResource('{userId}');
    const filesResource = restApi.root.addResource('files');
    const presignedUrlResource = filesResource.addResource('presigned-url');

    // Add methods to resources
    chatRoomsResource.addMethod('POST', new apigateway.LambdaIntegration(createChatRoomFunction), authorizerProps);
    chatRoomsResource.addMethod('GET', new apigateway.LambdaIntegration(listChatRoomsFunction), authorizerProps);
    messagesResource.addMethod('GET', new apigateway.LambdaIntegration(getChatHistoryFunction), authorizerProps);
    userResource.addMethod('GET', new apigateway.LambdaIntegration(getUserProfileFunction), authorizerProps);
    userResource.addMethod('PUT', new apigateway.LambdaIntegration(updateUserProfileFunction), authorizerProps);
    presignedUrlResource.addMethod('POST', new apigateway.LambdaIntegration(s3PresignedUrlFunction), authorizerProps);

    // Output the WebSocket API URL
    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${webSocketApi.ref}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
      description: 'WebSocket API URL',
    });

    // Output the REST API URL
    new cdk.CfnOutput(this, 'RestApiUrl', {
      value: restApi.url,
      description: 'REST API URL',
    });
  }
}