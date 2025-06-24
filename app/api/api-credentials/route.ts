import { NextRequest, NextResponse } from 'next/server';
import { createSafeLogger } from '../../../src/lib/structured-logger';
import { db, apiCredentials, type NewApiCredentials } from "../../../src/db";
import { eq, and } from 'drizzle-orm';
import { getEncryptionService, SecureEncryptionService } from "../../../src/services/secure-encryption-service";
import {
  createSuccessResponse,
  createErrorResponse,
  
  apiResponse,
  HTTP_STATUS,
  createValidationErrorResponse
} from "../../../src/lib/api-response";
import {
  userQueryRoute,
  userBodyRoute,
  sensitiveDataRoute,
  validateRequiredFields
} from "../../../src/lib/auth-decorators";

const logger = createSafeLogger('route');

// GET /api/api-credentials?userId=xxx&provider=mexc
export const GET = sensitiveDataRoute(async (request: NextRequest, user: any) => {
  try {
    logger.info('[DEBUG] GET api-credentials endpoint called', {
      userAuthenticated: !!user,
      userId: user?.id,
      timestamp: new Date().toISOString()
    });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const provider = searchParams.get('provider') || 'mexc';

    logger.info('[DEBUG] GET request details', {
      searchParamsUserId: userId,
      authenticatedUserId: user?.id,
      provider,
      allSearchParams: Object.fromEntries(searchParams.entries())
    });

    if (!userId) {
      return apiResponse(
        createValidationErrorResponse('userId', 'userId parameter is required'),
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Ensure user can only access their own credentials
    if (user.id !== userId) {
      return apiResponse(
        createErrorResponse("Access denied", {
          message: "You can only access your own API credentials",
          code: "ACCESS_DENIED"
        }),
        HTTP_STATUS.FORBIDDEN
      );
    }

    // Check if encryption service is available
    let encryptionService;
    try {
      encryptionService = getEncryptionService();
    } catch (encryptionError) {
      logger.error('[API] Encryption service initialization failed:', { error: encryptionError instanceof Error ? encryptionError.message : String(encryptionError) });
      return apiResponse(
        createErrorResponse('Encryption service unavailable', {
          message: 'Unable to decrypt credentials. Please contact support.',
          code: 'ENCRYPTION_SERVICE_ERROR'
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const result = await db
      .select()
      .from(apiCredentials)
      .where(and(
        eq(apiCredentials.userId, userId),
        eq(apiCredentials.provider, provider)
      ))
      .limit(1);

    if (result.length === 0) {
      return apiResponse(
        createSuccessResponse(null, {
          message: 'No API credentials found for user'
        })
      );
    }

    const creds = result[0];

    // Decrypt keys securely
    let apiKey = '';
    let secretKey = '';
    let passphrase: string | null = null;

    try {
      apiKey = encryptionService.decrypt(creds.encryptedApiKey);
      secretKey = encryptionService.decrypt(creds.encryptedSecretKey);
      if (creds.encryptedPassphrase) {
        passphrase = encryptionService.decrypt(creds.encryptedPassphrase);
      }
    } catch (decryptError) {
      logger.error('[API] Failed to decrypt credentials:', { error: decryptError instanceof Error ? decryptError.message : String(decryptError) });
      // Return error but don't leak encryption details
      return apiResponse(
        createErrorResponse('Failed to retrieve credentials', {
          code: 'DECRYPT_ERROR'
        }),
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const response = {
      id: creds.id,
      userId: creds.userId,
      provider: creds.provider,
      apiKey: SecureEncryptionService.maskSensitiveData(apiKey),
      secretKey: SecureEncryptionService.maskSensitiveData(secretKey),
      passphrase: passphrase ? SecureEncryptionService.maskSensitiveData(passphrase) : null,
      isActive: creds.isActive,
      lastUsed: creds.lastUsed,
      createdAt: creds.createdAt,
      updatedAt: creds.updatedAt,
    };

    return apiResponse(
      createSuccessResponse(response)
    );
  } catch (error) {
    logger.error('[API] GET api-credentials failed:', { error });
    return apiResponse(
      createErrorResponse('Failed to retrieve credentials', {
        message: 'An unexpected error occurred while retrieving API credentials',
        code: 'GET_CREDENTIALS_ERROR'
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// POST /api/api-credentials
export const POST = userBodyRoute(async (request: NextRequest, user: any, body: any) => {
  try {
    logger.info('[DEBUG] POST api-credentials endpoint called', {
      userAuthenticated: !!user,
      userId: user?.id,
      bodyKeys: Object.keys(body || {}),
      timestamp: new Date().toISOString()
    });

    const { userId, provider = 'mexc', apiKey, secretKey, passphrase } = body;
    
    logger.info('[DEBUG] Credential save request', {
      providedUserId: userId,
      authenticatedUserId: user?.id,
      provider,
      hasApiKey: !!apiKey,
      hasSecretKey: !!secretKey,
      hasPassphrase: !!passphrase,
      apiKeyLength: apiKey?.length || 0,
      secretKeyLength: secretKey?.length || 0,
      apiKeyValue: apiKey ? 'present' : 'missing',
      secretKeyValue: secretKey ? 'present' : 'missing',
      bodyContents: Object.keys(body || {})
    });

  // Validate required fields
  const missingField = validateRequiredFields(body, ['userId', 'apiKey', 'secretKey']);
  if (missingField) {
    logger.info('[DEBUG] Missing required field:', { field: missingField, body: body });
    return apiResponse(
      createValidationErrorResponse('required_fields', missingField),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Additional validation for undefined values
  if (!apiKey || !secretKey) {
    logger.info('[DEBUG] API key or secret key is undefined:', { apiKey, secretKey });
    return apiResponse(
      createValidationErrorResponse('api_credentials', 'API key and secret key cannot be empty or undefined'),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Validate API key format (enhanced validation)
  if (apiKey.length < 10 || secretKey.length < 10) {
    return apiResponse(
      createValidationErrorResponse('api_credentials', 'API key and secret must be at least 10 characters'),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Additional security validation
  if (apiKey.includes(' ') || secretKey.includes(' ')) {
    return apiResponse(
      createValidationErrorResponse('api_credentials', 'API credentials cannot contain spaces'),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Check if encryption service is available
  let encryptionService;
  try {
    encryptionService = getEncryptionService();
  } catch (encryptionError) {
    logger.error('[API] Encryption service initialization failed:', { error: encryptionError instanceof Error ? encryptionError.message : String(encryptionError) });
    return apiResponse(
      createErrorResponse('Encryption service unavailable', {
        message: 'Unable to encrypt credentials. Please contact support.',
        code: 'ENCRYPTION_SERVICE_ERROR'
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  // Encrypt the credentials securely
  let encryptedApiKey: string;
  let encryptedSecretKey: string;
  let encryptedPassphrase: string | null = null;

  try {
    encryptedApiKey = encryptionService.encrypt(apiKey);
    encryptedSecretKey = encryptionService.encrypt(secretKey);
    if (passphrase) {
      encryptedPassphrase = encryptionService.encrypt(passphrase);
    }
  } catch (encryptError) {
    logger.error('[API] Failed to encrypt credentials:', { error: encryptError instanceof Error ? encryptError.message : String(encryptError) });
    return apiResponse(
      createErrorResponse('Failed to secure credentials', {
        code: 'ENCRYPT_ERROR'
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  const credentialsData: NewApiCredentials = {
    userId,
    provider,
    encryptedApiKey,
    encryptedSecretKey,
    encryptedPassphrase,
    isActive: true,
    updatedAt: new Date(),
  };

  // Check if credentials already exist for this user/provider
  const existing = await db
    .select()
    .from(apiCredentials)
    .where(and(
      eq(apiCredentials.userId, userId),
      eq(apiCredentials.provider, provider)
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update existing credentials
    await db
      .update(apiCredentials)
      .set(credentialsData)
      .where(eq(apiCredentials.id, existing[0].id));
  } else {
    // Insert new credentials
    await db.insert(apiCredentials).values(credentialsData);
  }

  return apiResponse(
    createSuccessResponse({
      provider,
      maskedApiKey: SecureEncryptionService.maskSensitiveData(apiKey),
      maskedSecretKey: SecureEncryptionService.maskSensitiveData(secretKey),
    }, {
      message: 'API credentials saved securely'
    }),
    HTTP_STATUS.CREATED
  );
  } catch (error) {
    logger.error('[API] POST api-credentials failed:', { error });
    return apiResponse(
      createErrorResponse('Failed to save credentials', {
        message: 'An unexpected error occurred while saving API credentials',
        code: 'SAVE_CREDENTIALS_ERROR'
      }),
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

// DELETE /api/api-credentials
export const DELETE = sensitiveDataRoute(async (request: NextRequest, user: any) => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const provider = searchParams.get('provider') || 'mexc';

  if (!userId) {
    return apiResponse(
      createValidationErrorResponse('userId', 'userId parameter is required'),
      HTTP_STATUS.BAD_REQUEST
    );
  }

  // Ensure user can only delete their own credentials
  if (user.id !== userId) {
    return apiResponse(
      createErrorResponse("Access denied", {
        message: "You can only delete your own API credentials",
        code: "ACCESS_DENIED"
      }),
      HTTP_STATUS.FORBIDDEN
    );
  }

  await db
    .delete(apiCredentials)
    .where(and(
      eq(apiCredentials.userId, userId),
      eq(apiCredentials.provider, provider)
    ));

  return apiResponse(
    createSuccessResponse(null, {
      message: 'API credentials deleted successfully'
    })
  );
});