describe('Authentication', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    cy.clearLocalStorage();
    cy.visit('/');
  });

  it('should display login page', () => {
    cy.visit('/login');
    cy.contains('Sign in').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });

  it('should display signup page', () => {
    cy.visit('/signup');
    cy.contains('Sign up').should('be.visible');
    cy.get('input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('be.visible');
  });

  it('should sign up a new user', () => {
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    const password = 'testpassword123';
    const name = 'Test User';

    cy.visit('/signup');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').first().type(password);
    cy.get('input[name="name"]').type(name);
    cy.get('button[type="submit"]').click();

    // Should redirect to dashboard or profile setup
    cy.url().should('include', '/dashboard').or('include', '/profile-setup');
  });

  it('should log in an existing user', () => {
    // First sign up
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    const password = 'testpassword123';
    const name = 'Test User';

    cy.signup(email, password, name);

    // Then login
    cy.visit('/login');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type(password);
    cy.get('button[type="submit"]').click();

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
  });

  it('should show error for invalid credentials', () => {
    cy.visit('/login');
    cy.get('input[type="email"]').type('invalid@example.com');
    cy.get('input[type="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    // Should show error message
    cy.contains('Invalid', { timeout: 5000 }).should('be.visible');
  });
});
