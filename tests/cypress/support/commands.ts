/// <reference types="cypress" />

// Custom commands for common actions

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:3000/api/auth/login',
    body: {
      email,
      password,
    },
  }).then((response) => {
    expect(response.status).to.eq(200);
    expect(response.body.token).to.exist;
    
    // Store token and user in localStorage
    window.localStorage.setItem('auth_token', response.body.token);
    window.localStorage.setItem(
      'turnstyle_current_user',
      JSON.stringify(response.body.user)
    );
  });
});

Cypress.Commands.add('signup', (email: string, password: string, name: string) => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:3000/api/auth/signup',
    body: {
      email,
      password,
      name,
      userType: 'stylist',
    },
  }).then((response) => {
    expect(response.status).to.eq(201);
    expect(response.body.token).to.exist;
    
    // Store token and user in localStorage
    window.localStorage.setItem('auth_token', response.body.token);
    window.localStorage.setItem(
      'turnstyle_current_user',
      JSON.stringify(response.body.user)
    );
  });
});
