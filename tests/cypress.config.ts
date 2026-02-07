import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5137',
    supportFile: 'tests/cypress/support/e2e.ts',
    specPattern: 'tests/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    videosFolder: 'tests/cypress/videos',
    screenshotsFolder: 'tests/cypress/screenshots',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
