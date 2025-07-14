import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { Construct } from 'constructs';

/**
 * WebSocketLambdaIntegration creates an integration between a WebSocket API and a Lambda function.
 */
export class WebSocketLambdaIntegration implements apigatewayv2.IWebSocketRouteIntegration {
  private readonly handler: lambda.IFunction;
  private readonly integrationUri: string;

  constructor(id: string, handler: lambda.IFunction) {
    this.handler = handler;
    this.integrationUri = `arn:aws:apigateway:${handler.env.region}:lambda:path/2015-03-31/functions/${handler.functionArn}/invocations`;
  }

  bind(route: apigatewayv2.IWebSocketRoute): apigatewayv2.WebSocketRouteIntegrationConfig {
    this.handler.grantInvoke({
      grantPrincipal: route.webSocketApi.grantPrincipal,
    });

    return {
      type: apigatewayv2.WebSocketIntegrationType.AWS_PROXY,
      uri: this.integrationUri,
    };
  }
}