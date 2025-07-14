import * as AWS from 'aws-sdk';
import { DynamoDB } from 'aws-sdk';

// Create a properly typed DynamoDB DocumentClient that supports promises
export const dynamoDB = new DynamoDB.DocumentClient();

// Define the input/output types directly since they're not accessible via DocumentClient
export interface GetItemInput extends AWS.DynamoDB.DocumentClient.GetItemInput {}
export interface GetItemOutput extends AWS.DynamoDB.DocumentClient.GetItemOutput {}
export interface PutItemInput extends AWS.DynamoDB.DocumentClient.PutItemInput {}
export interface PutItemOutput extends AWS.DynamoDB.DocumentClient.PutItemOutput {}
export interface UpdateItemInput extends AWS.DynamoDB.DocumentClient.UpdateItemInput {}
export interface UpdateItemOutput extends AWS.DynamoDB.DocumentClient.UpdateItemOutput {}
export interface DeleteItemInput extends AWS.DynamoDB.DocumentClient.DeleteItemInput {}
export interface DeleteItemOutput extends AWS.DynamoDB.DocumentClient.DeleteItemOutput {}
export interface QueryInput extends AWS.DynamoDB.DocumentClient.QueryInput {}
export interface QueryOutput extends AWS.DynamoDB.DocumentClient.QueryOutput {}
export interface ScanInput extends AWS.DynamoDB.DocumentClient.ScanInput {}
export interface ScanOutput extends AWS.DynamoDB.DocumentClient.ScanOutput {}

// Type definitions for the promise-based methods
export interface DocumentClientWithPromise extends DynamoDB.DocumentClient {
  get(params: GetItemInput): Promise<GetItemOutput> & { promise(): Promise<GetItemOutput> };
  put(params: PutItemInput): Promise<PutItemOutput> & { promise(): Promise<PutItemOutput> };
  update(params: UpdateItemInput): Promise<UpdateItemOutput> & { promise(): Promise<UpdateItemOutput> };
  delete(params: DeleteItemInput): Promise<DeleteItemOutput> & { promise(): Promise<DeleteItemOutput> };
  query(params: QueryInput): Promise<QueryOutput> & { promise(): Promise<QueryOutput> };
  scan(params: ScanInput): Promise<ScanOutput> & { promise(): Promise<ScanOutput> };
}

// Cast the DynamoDB DocumentClient to our extended interface
export const documentClient = dynamoDB as unknown as DocumentClientWithPromise;