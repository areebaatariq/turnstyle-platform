# Automated Testing Guide

This directory contains automated tests for the Turnstyle MVP application.

## Structure

```
tests/
├── postman/                          # Postman API test collection
│   ├── Turnstyle_API_Tests.postman_collection.json
│   └── environment.json
├── cypress/                          # Cypress E2E tests
│   ├── e2e/                          # Test specs
│   │   ├── auth.cy.ts               # Authentication tests
│   │   ├── dashboard.cy.ts          # Dashboard tests
│   │   └── responsive.cy.ts         # Responsive design tests
│   ├── support/                      # Support files
│   │   ├── commands.ts              # Custom Cypress commands
│   │   └── e2e.ts                   # E2E support file
│   └── screenshots/                  # Test screenshots (generated)
│   └── videos/                       # Test videos (generated)
└── README.md                         # This file
```

## Prerequisites

### Backend API Tests (Postman/Newman)

1. Install Newman globally:
```bash
npm install -g newman
```

2. Ensure backend server is running:
```bash
cd backend
npm run dev
```

### Frontend E2E Tests (Cypress)

1. Install Cypress (included in devDependencies):
```bash
cd frontend
npm install
```

2. Ensure frontend server is running:
```bash
cd frontend
npm run dev
```

## Running Tests

### Backend API Tests

Run Postman collection with Newman:

```bash
cd backend
npm run test:api
```

Or manually:
```bash
newman run tests/postman/Turnstyle_API_Tests.postman_collection.json \
  -e tests/postman/environment.json
```

### Frontend E2E Tests

Run Cypress in headless mode:

```bash
cd frontend
npm run test:e2e
```

Run Cypress in interactive mode (recommended for development):

```bash
cd frontend
npm run test:e2e:open
```

### Run All Tests

From project root:

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev

# Terminal 3: Run API tests
cd backend && npm run test:api

# Terminal 4: Run E2E tests
cd frontend && npm run test:e2e
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

GitHub Actions workflow: `.github/workflows/ci.yml`

## Test Coverage

### Backend API Tests (Postman)
- ✅ Health check
- ✅ Authentication (signup, login)
- ✅ User profile (GET/PUT /me)
- ✅ Clients (CRUD operations)
- ✅ LookItems (CRUD + bulk operations)
- ✅ Receipts (CRUD operations)

### Frontend E2E Tests (Cypress)
- ✅ Authentication flow (login, signup)
- ✅ Dashboard navigation
- ✅ Responsive design (mobile, tablet, desktop)
- ⏳ Closet management (coming soon)
- ⏳ Look creation (coming soon)
- ⏳ Receipt management (coming soon)

## Adding New Tests

### Adding API Tests

1. Open Postman
2. Import collection: `tests/postman/Turnstyle_API_Tests.postman_collection.json`
3. Add new requests to appropriate folder
4. Add test assertions in the "Tests" tab
5. Export collection and replace the file

### Adding E2E Tests

1. Create new test file in `tests/cypress/e2e/`
2. Follow existing test patterns
3. Use custom commands from `tests/cypress/support/commands.ts`

Example:
```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password');
    cy.visit('/feature');
  });

  it('should do something', () => {
    // Test implementation
  });
});
```

## Troubleshooting

### API Tests Failing

- Ensure backend server is running on port 3000
- Check that test data doesn't conflict (use unique emails with timestamps)
- Verify environment variables are set correctly

### E2E Tests Failing

- Ensure frontend server is running on port 5137
- Check that backend is accessible from Cypress
- Clear localStorage before tests if needed
- Check Cypress console for detailed error messages

### CI/CD Tests Failing

- Check GitHub Actions logs for specific failures
- Verify environment setup in workflow file
- Ensure test data cleanup is working correctly

## Best Practices

1. **Use unique test data**: Always use timestamps or UUIDs for emails/usernames
2. **Clean up after tests**: Delete test data created during tests
3. **Test isolation**: Each test should be independent
4. **Meaningful assertions**: Test actual functionality, not just status codes
5. **Responsive testing**: Test on multiple viewport sizes

## Resources

- [Newman Documentation](https://learning.postman.com/docs/running-collections/using-newman-cli/command-line-integration-with-newman/)
- [Cypress Documentation](https://docs.cypress.io/)
- [Postman Collection Format](https://schema.getpostman.com/json/collection/v2.1.0/docs/index.html)
