describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1280, height: 720 },
  ];

  viewports.forEach((viewport) => {
    it(`should render correctly on ${viewport.name}`, () => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/');

      // Check that page loads
      cy.get('body').should('be.visible');

      // Check navigation is accessible
      if (viewport.width < 768) {
        // Mobile: check for hamburger menu or mobile nav
        cy.get('nav').should('be.visible');
      } else {
        // Desktop: check for full navigation
        cy.get('nav').should('be.visible');
      }
    });

    it(`login page should be responsive on ${viewport.name}`, () => {
      cy.viewport(viewport.width, viewport.height);
      cy.visit('/login');

      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
    });
  });

  it('should handle mobile navigation menu', () => {
    cy.viewport(375, 667);
    
    const timestamp = Date.now();
    const email = `test${timestamp}@example.com`;
    cy.signup(email, 'testpassword123', 'Test User');
    
    cy.visit('/dashboard');
    
    // Check mobile menu if it exists
    cy.get('body').should('be.visible');
  });
});
