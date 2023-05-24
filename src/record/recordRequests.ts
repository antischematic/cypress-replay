import { CyHttpMessages, StaticResponse } from "cypress/types/net-stubbing";
import {ReplayConfig} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import RequestCollection from "../utility/RequestCollection";
import sanitizeHeaders from "../utility/sanitizeHeaders";
import createFixtureFilename from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";

export function startRecording(config: ReplayConfig) {
    config = mergeConfig(config)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(config.dynamicRequestEnvComponents || [], Cypress.env);
    return new RequestCollection(dynamicComponentManager)
}

export function makeFilePath(folder: string = Cypress.spec.name, components: string[] = Cypress.currentTest.titlePath) {
    return createFixtureFilename(Cypress.config().fixturesFolder as string, folder, components)
}

export function waitForNetwork(collection: any) {
    const { size } = collection.requests;
    cy.wait(0, { log: false }).then(() => {
        return cy.wrap(collection.resolveMap(), { log: false }).then(() => {
            if (collection.requests.size > size) {
                return waitForNetwork(collection);
            }
        });
    });
}

export function stopRecording(requestCollection: RequestCollection, filePath: string) {
    cy.then(() => requestCollection.resolveMap()).then((map) => {
        cy.writeFile(
            filePath,
            JSON.stringify(map, null, 4)
        );
    });
}

export function interceptRequests(requestCollection: RequestCollection, config: ReplayConfig) {
    config = mergeConfig(config)
    cy.intercept(new RegExp(config.interceptPattern || ".*"), (request: CyHttpMessages.IncomingHttpRequest) => {
        const startTime = Date.now();
        const promise = new Promise<StaticResponse>((resolve) => {
            request.on("response", (response: CyHttpMessages.IncomingResponse) => {
                resolve({
                    body: response.body,
                    headers: sanitizeHeaders(response.headers),
                    statusCode: response.statusCode,
                    // Including a delay that matches how long the server took to response will help make tests more
                    // deterministic.
                    delay: Date.now() - startTime,
                });
            });
        });

        requestCollection.pushIncomingRequest(request, promise);
    })
}
