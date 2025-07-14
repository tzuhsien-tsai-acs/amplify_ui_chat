import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3 } from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3();
const filesBucket = process.env.FILES_BUCKET || '';
const region = process.env.AWS_REGION || 'us-east-1';

// Set expiration time for presigned URLs (in seconds)
const URL_EXPIRATION_SECONDS = 300; // 5 minutes

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Get authenticated user ID from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub;
    
    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Unauthorized: User ID not found',
        }),
      };
    }
    
    // Parse request body
    const requestBody = JSON.parse(event.body || '{}');
    const { fileName, contentType } = requestBody;
    
    if (!fileName || !contentType) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: 'Missing required parameters: fileName and contentType are required',
        }),
      };
    }
    
    // Generate a unique file key
    const fileExtension = fileName.split('.').pop();
    const uniqueId = uuidv4();
    const key = `${userId}/${uniqueId}-${fileName}`;
    
    // Generate a presigned URL for uploading the file
    const presignedUrl = s3.getSignedUrl('putObject', {
      Bucket: filesBucket,
      Key: key,
      ContentType: contentType,
      Expires: URL_EXPIRATION_SECONDS,
    });
    
    // Generate a public URL for accessing the file after upload
    const publicUrl = `https://${filesBucket}.s3.${region}.amazonaws.com/${key}`;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        presignedUrl,
        publicUrl,
        key,
        bucket: filesBucket,
        region,
        expiresIn: URL_EXPIRATION_SECONDS,
      }),
    };
  } catch (error: unknown) {
    console.error('Error generating presigned URL:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Error generating presigned URL',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};