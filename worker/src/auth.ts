import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';

export interface WorkerEnv {
  FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  APP_CORS_ALLOWED_ORIGINS?: string;
  AI_CATEGORY_SERVICE_URL?: string;
  AI_CATEGORY_SERVICE_TOKEN?: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export type FirebaseTokenVerifier = (idToken: string, projectId: string) => Promise<AuthenticatedUser>;

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const BEARER_PREFIX = 'Bearer ';
const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const firebaseJwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

/**
 * 驗證目前 request 的 Firebase 使用者。
 *
 * 輸入：HTTP request、Worker env 與可替換的 token verifier。
 * 輸出：已驗證使用者 ID 與 email。
 * 可能錯誤：缺少設定、缺少 Bearer token 或 token 無效時拋出 AuthError。
 */
export async function authenticateFirebaseRequest(
  request: Request,
  env: WorkerEnv,
  verifier: FirebaseTokenVerifier = verifyFirebaseToken
): Promise<AuthenticatedUser> {
  const projectId = getRequiredFirebaseProjectId(env);
  const idToken = extractBearerToken(request.headers);
  return verifier(idToken, projectId);
}

/**
 * 從 Authorization header 取出 Bearer token。
 *
 * 輸入：HTTP request headers。
 * 輸出：Bearer token 字串。
 * 可能錯誤：header 缺失、格式錯誤或 token 空白時拋出 AuthError。
 */
export function extractBearerToken(headers: Headers): string {
  const authorizationHeader = headers.get('Authorization');
  if (authorizationHeader === null || authorizationHeader.trim() === '') {
    throw new AuthError('Login is required');
  }
  if (authorizationHeader === 'Bearer') {
    throw new AuthError('Firebase token is required');
  }
  if (!authorizationHeader.startsWith(BEARER_PREFIX)) {
    throw new AuthError('Authorization header must use Bearer token');
  }

  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  if (token === '') {
    throw new AuthError('Firebase token is required');
  }
  return token;
}

/**
 * 使用 Firebase public keys 驗證 ID token。
 *
 * 輸入：Firebase ID token 與 Firebase project id。
 * 輸出：已驗證使用者 ID 與 email。
 * 可能錯誤：JWT 簽章、issuer、audience、有效期限或必要欄位無效時拋出 AuthError。
 */
export async function verifyFirebaseToken(idToken: string, projectId: string): Promise<AuthenticatedUser> {
  try {
    const { payload } = await jwtVerify(idToken, firebaseJwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId
    });
    return buildAuthenticatedUser(payload);
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('Firebase token is invalid');
  }
}

/**
 * 讀取必要的 Firebase project id 設定。
 *
 * 輸入：Worker env。
 * 輸出：Firebase project id。
 * 可能錯誤：未設定時拋出 AuthError。
 */
function getRequiredFirebaseProjectId(env: WorkerEnv): string {
  const projectId = env.FIREBASE_PROJECT_ID?.trim() || env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new AuthError('Firebase project id is not configured');
  }
  return projectId;
}

/**
 * 從已驗證 JWT payload 建立系統使用者。
 *
 * 輸入：已通過簽章與 claims 驗證的 JWT payload。
 * 輸出：系統使用者。
 * 可能錯誤：缺少 Firebase uid 或 email 時拋出 AuthError。
 */
function buildAuthenticatedUser(payload: JWTPayload): AuthenticatedUser {
  if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    throw new AuthError('Firebase token user id is required');
  }

  const email = payload.email;
  if (typeof email !== 'string' || email.trim() === '') {
    throw new AuthError('Firebase token email is required');
  }

  return {
    userId: payload.sub,
    email
  };
}
