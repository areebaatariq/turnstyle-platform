describe('Dashboard', () => {
  beforeEach(() => {
    // Login before each test
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    cy.signup(email, 'testpassword123', 'Test User');
    cy.visit('/dashboard');
  });

  it('should display dashboard page', () => {
    cy.contains('Dashboard').should('be.visible');
  });

  it('should navigate to closets page', () => {
    cy.contains('Closets').click();
    cy.url().should('include', '/closets');
  });

  it('should navigate to looks page', () => {
    cy.contains('Looks').click();
    cy.url().should('include', '/looks');
  });

  it('should navigate to messages page', () => {
    cy.contains('Messages').click();
    cy.url().should('include', '/messages');
  });

  it('should navigate to receipts page', () => {
    cy.contains('Receipts').click();
    cy.url().should('include', '/receipts');
  });
});
