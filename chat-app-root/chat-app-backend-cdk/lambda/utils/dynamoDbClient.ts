import { DynamoDB } from 'aws-sdk';

// Create a properly typed DynamoDB DocumentClient that supports promises
export const dynamoDB = new DynamoDB.DocumentClient();

// Type definitions for the promise-based methods
export interface DocumentClientWithPromise extends DynamoDB.DocumentClient {
  get(params: DynamoDB.DocumentClient.GetItemInput): Promise<DynamoDB.DocumentClient.GetItemOutput> & { promise(): Promise<DynamoDB.DocumentClient.GetItemOutput> };
  put(params: DynamoDB.DocumentClient.PutItemInput): Promise<DynamoDB.DocumentClient.PutItemOutput> & { promise(): Promise<DynamoDB.DocumentClient.PutItemOutput> };
  update(params: DynamoDB.DocumentClient.UpdateItemInput): Promise<DynamoDB.DocumentClient.UpdateItemOutput> & { promise(): Promise<DynamoDB.DocumentClient.UpdateItemOutput> };
  delete(params: DynamoDB.DocumentClient.DeleteItemInput): Promise<DynamoDB.DocumentClient.DeleteItemOutput> & { promise(): Promise<DynamoDB.DocumentClient.DeleteItemOutput> };
  query(params: DynamoDB.DocumentClient.QueryInput): Promise<DynamoDB.DocumentClient.QueryOutput> & { promise(): Promise<DynamoDB.DocumentClient.QueryOutput> };
  scan(params: DynamoDB.DocumentClient.ScanInput): Promise<DynamoDB.DocumentClient.ScanOutput> & { promise(): Promise<DynamoDB.DocumentClient.ScanOutput> };
}

// Cast the DynamoDB DocumentClient to our extended interface
export const documentClient = dynamoDB as unknown as DocumentClientWithPromise;