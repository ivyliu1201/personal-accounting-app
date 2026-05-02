const baseUrl = (process.env.WORKER_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

interface SmokeCase {
  name: string;
  path: string;
  expectedStatus: number;
}

const smokeCases: SmokeCase[] = [
  {
    name: 'health endpoint',
    path: '/api/health',
    expectedStatus: 200
  },
  {
    name: 'protected auth endpoint without token',
    path: '/api/auth/me',
    expectedStatus: 401
  },
  {
    name: 'protected categories endpoint without token',
    path: '/api/transactions/categories?type=EXPENSE',
    expectedStatus: 401
  }
];

for (const smokeCase of smokeCases) {
  const response = await fetch(`${baseUrl}${smokeCase.path}`);
  if (response.status !== smokeCase.expectedStatus) {
    const body = await response.text();
    throw new Error(
      `${smokeCase.name} expected ${smokeCase.expectedStatus}, got ${response.status}: ${body}`
    );
  }
  console.log(`ok ${smokeCase.name} ${response.status}`);
}
