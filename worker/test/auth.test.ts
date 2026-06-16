import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthError,
  authenticateFirebaseRequest,
  extractBearerToken,
  type AuthenticatedUser,
  type FirebaseTokenVerifier
} from '../src/auth';

test('extractBearerToken rejects missing authorization header', () => {
  assert.throws(
    () => extractBearerToken(new Headers()),
    (error: unknown) => error instanceof AuthError && error.message === 'Login is required'
  );
});

test('extractBearerToken rejects non bearer authorization header', () => {
  assert.throws(
    () => extractBearerToken(new Headers({ Authorization: 'Basic abc' })),
    (error: unknown) => error instanceof AuthError && error.message === 'Authorization header must use Bearer token'
  );
});

test('extractBearerToken rejects blank bearer token', () => {
  assert.throws(
    () => extractBearerToken(new Headers({ Authorization: 'Bearer   ' })),
    (error: unknown) => error instanceof AuthError && error.message === 'Firebase token is required'
  );
});

test('extractBearerToken returns trimmed bearer token', () => {
  const token = extractBearerToken(new Headers({ Authorization: 'Bearer test-token  ' }));

  assert.equal(token, 'test-token');
});

test('authenticateFirebaseRequest rejects missing Firebase project id', async () => {
  const request = new Request('https://example.test/api/auth/me', {
    headers: {
      Authorization: 'Bearer test-token'
    }
  });

  await assert.rejects(
    () => authenticateFirebaseRequest(request, {}),
    (error: unknown) => error instanceof AuthError && error.message === 'Firebase project id is not configured'
  );
});

test('authenticateFirebaseRequest passes token and project id to verifier', async () => {
  const request = new Request('https://example.test/api/auth/me', {
    headers: {
      Authorization: 'Bearer test-token'
    }
  });
  const expectedUser: AuthenticatedUser = {
    userId: 'firebase-user-1',
    email: 'user@example.test'
  };
  const verifier: FirebaseTokenVerifier = async (idToken, projectId) => {
    assert.equal(idToken, 'test-token');
    assert.equal(projectId, 'demo-project');
    return expectedUser;
  };

  const user = await authenticateFirebaseRequest(request, { FIREBASE_PROJECT_ID: 'demo-project' }, verifier);

  assert.deepEqual(user, expectedUser);
});

test('authenticateFirebaseRequest falls back to Vite Firebase project id', async () => {
  const request = new Request('https://example.test/api/auth/me', {
    headers: {
      Authorization: 'Bearer test-token'
    }
  });
  const expectedUser: AuthenticatedUser = {
    userId: 'firebase-user-1',
    email: 'user@example.test'
  };
  const verifier: FirebaseTokenVerifier = async (idToken, projectId) => {
    assert.equal(idToken, 'test-token');
    assert.equal(projectId, 'demo-project');
    return expectedUser;
  };

  const user = await authenticateFirebaseRequest(request, { VITE_FIREBASE_PROJECT_ID: 'demo-project' }, verifier);

  assert.deepEqual(user, expectedUser);
});
