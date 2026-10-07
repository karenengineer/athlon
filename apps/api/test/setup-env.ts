process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://athlon:athlon@localhost:5432/athlon_test";
process.env.ACCESS_TOKEN_SECRET =
  "test-access-secret-with-at-least-32-characters";
process.env.REFRESH_TOKEN_SECRET =
  "test-refresh-secret-with-at-least-32-characters";
process.env.CORS_ORIGINS = "http://localhost:4200";
// Match the production Caddy -> API single trusted-proxy hop in E2E tests.
process.env.TRUST_PROXY_HOPS = "1";
