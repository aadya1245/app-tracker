process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/taskmanager_test';
process.env.JWT_SECRET = 'testsecret12345678';
process.env.JWT_EXPIRES_IN = '1d';
process.env.CORS_ORIGIN = 'http://localhost:3000';
