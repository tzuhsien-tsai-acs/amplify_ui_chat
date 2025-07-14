import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class ChatAppApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create DynamoDB table to store WebSocket connections
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
    });

    // Add GSI for roomId to efficiently query connections by room
    connectionsTable.addGlobalSecondaryIndex({
      indexName: 'roomId-index',
      partitionKey: { name: 'roomId', type: dynamodb.AttributeType.STRING },
    });

    // Create DynamoDB table to store chat messages
    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      partitionKey: { name: 'roomId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
    });

    // Create Lambda layer with common dependencies
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-layers/common')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common dependencies for Lambda functions',
    });

    // Create WebSocket API
    const webSocketApi = new apigatewayv2.WebSocketApi(this, 'ChatWebSocketApi', {
      apiName: 'ChatWebSocketApi',
      routeSelectionExpression: '$request.body.action',
      description: 'WebSocket API for real-time chat application',
    });

    // Create WebSocket API Stage
    const webSocketStage = new apigatewayv2.WebSocketStage(this, 'ChatWebSocketStage', {
      webSocketApi,
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
        API_GATEWAY_ENDPOINT: `https://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
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
        `arn:aws:execute-api:${this.region}:${this.account}:${webSocketApi.apiId}/${webSocketStage.stageName}/POST/@connections/*`,
      ],
    });

    connectFunction.addToRolePolicy(apiGatewayPolicy);
    disconnectFunction.addToRolePolicy(apiGatewayPolicy);
    sendMessageFunction.addToRolePolicy(apiGatewayPolicy);

    // Create WebSocket API integrations
    const connectIntegration = new apigatewayv2_integrations.WebSocketLambdaIntegration(
      'ConnectIntegration',
      connectFunction
    );

    const disconnectIntegration = new apigatewayv2_integrations.WebSocketLambdaIntegration(
      'DisconnectIntegration',
      disconnectFunction
    );

    const sendMessageIntegration = new apigatewayv2_integrations.WebSocketLambdaIntegration(
      'SendMessageIntegration',
      sendMessageFunction
    );

    // Add routes to WebSocket API
    webSocketApi.addRoute('$connect', {
      integration: connectIntegration,
    });

    webSocketApi.addRoute('$disconnect', {
      integration: disconnectIntegration,
    });

    webSocketApi.addRoute('sendMessage', {
      integration: sendMessageIntegration,
    });

    // Output the WebSocket API URL
    new cdk.CfnOutput(this, 'WebSocketApiUrl', {
      value: `wss://${webSocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${webSocketStage.stageName}`,
      description: 'WebSocket API URL',
    });

    // Output the DynamoDB table names
    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: connectionsTable.tableName,
      description: 'DynamoDB Connections Table Name',
    });

    new cdk.CfnOutput(this, 'MessagesTableName', {
      value: messagesTable.tableName,
      description: 'DynamoDB Messages Table Name',
    });
  }
}