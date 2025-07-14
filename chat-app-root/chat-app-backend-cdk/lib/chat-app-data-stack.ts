import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ChatAppDataStack extends cdk.Stack {
  public readonly connectionsTable: dynamodb.Table;
  public readonly messagesTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly chatRoomsTable: dynamodb.Table;
  public readonly filesBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ===== DynamoDB Tables =====

    // 1. Users Table
    // Stores user profiles and information
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'ChatAppUsersTable',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      pointInTimeRecovery: true,
    });

    // Add GSI for email to query users by email
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 2. Chat Rooms Table
    // Stores information about chat rooms/channels
    this.chatRoomsTable = new dynamodb.Table(this, 'ChatRoomsTable', {
      tableName: 'ChatAppChatRoomsTable',
      partitionKey: { name: 'roomId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      pointInTimeRecovery: true,
    });

    // Add GSI for createdBy to query rooms by creator
    this.chatRoomsTable.addGlobalSecondaryIndex({
      indexName: 'createdBy-index',
      partitionKey: { name: 'createdBy', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 3. Messages Table
    // Stores chat messages with efficient querying by room
    this.messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      tableName: 'ChatAppMessagesTable',
      partitionKey: { name: 'roomId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl', // Optional: for message expiration if needed
    });

    // Add GSI for userId to query messages by sender
    this.messagesTable.addGlobalSecondaryIndex({
      indexName: 'userId-timestamp-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for messageId to query specific messages
    this.messagesTable.addGlobalSecondaryIndex({
      indexName: 'messageId-index',
      partitionKey: { name: 'messageId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 4. WebSocket Connections Table
    // Stores active WebSocket connections for real-time messaging
    this.connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      tableName: 'ChatAppConnectionsTable',
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      timeToLiveAttribute: 'ttl', // For automatic cleanup of stale connections
    });

    // Add GSI for roomId to efficiently query connections by room
    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'roomId-index',
      partitionKey: { name: 'roomId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for userId to efficiently query connections by user
    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ===== S3 Bucket for File Storage =====
    this.filesBucket = new s3.Bucket(this, 'FilesBucket', {
      bucketName: `chat-app-files-${this.account}-${this.region}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      autoDeleteObjects: true, // For development only
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'], // In production, restrict to your domain
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(365), // Set appropriate retention period
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
    });

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'DynamoDB Users Table Name',
    });

    new cdk.CfnOutput(this, 'ChatRoomsTableName', {
      value: this.chatRoomsTable.tableName,
      description: 'DynamoDB Chat Rooms Table Name',
    });

    new cdk.CfnOutput(this, 'MessagesTableName', {
      value: this.messagesTable.tableName,
      description: 'DynamoDB Messages Table Name',
    });

    new cdk.CfnOutput(this, 'ConnectionsTableName', {
      value: this.connectionsTable.tableName,
      description: 'DynamoDB WebSocket Connections Table Name',
    });

    new cdk.CfnOutput(this, 'FilesBucketName', {
      value: this.filesBucket.bucketName,
      description: 'S3 Files Bucket Name',
    });
  }
}