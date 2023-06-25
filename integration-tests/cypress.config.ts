import { defineConfig } from "cypress";

export default defineConfig({
  // @ts-ignore
  cypressReplay: {
    interceptPattern: "(jsonplaceholder.cypress.io)",
    dynamicRequestEnvComponents: ["API_URL"],
    responseDelayOverride: 0
  },

  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
      testIsolation: true
  },
});
