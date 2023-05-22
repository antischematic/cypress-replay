import { CyHttpMessages, StaticResponse } from "cypress/types/net-stubbing";
import {ReplayConfig} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import RequestCollection from "../utility/RequestCollection";
import sanitizeHeaders from "../utility/sanitizeHeaders";
import createFixtureFilename from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";

let stack = [] as RequestCollection[]

function getCurrentRequestCollection() {
    return stack[stack.length - 1]
}

export function startRecording(config: ReplayConfig) {
    config = mergeConfig(config)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(config.dynamicRequestEnvComponents || [], Cypress.env);
    stack.push(new RequestCollection(dynamicComponentManager))
}

export function makeFilePath(folder: string = Cypress.spec.name, components: string[] = Cypress.currentTest.titlePath) {
    return createFixtureFilename(Cypress.config().fixturesFolder as string, folder, components)
}

export function stopRecording(filePath: string) {
    const requestCollection = stack.pop()
    console.info('STOP RECORDING', requestCollection)
    if (requestCollection) {
        cy.then(() => requestCollection.resolveMap()).then((map) => {
            cy.writeFile(
                filePath,
                JSON.stringify(map, null, 4)
            );
        });
    } else {
        console.warn('You called stopRecording() but no recorders are currently active. Did you forget to call startRecording()?')
    }
}

export function interceptRequests(config: ReplayConfig) {
    config = mergeConfig(config)
    const requestCollection = getCurrentRequestCollection()
    if (requestCollection) {
        cy.intercept(new RegExp(config.interceptPattern || ".*"), (request: CyHttpMessages.IncomingHttpRequest) => {
            const startTime = Date.now();

            const promise = new Promise<StaticResponse>((resolve) => {
                request.on("after:response", (response: CyHttpMessages.IncomingResponse) => {
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
        });
    } else {
        console.warn('No active recorder found. Did you forget to call startRecording()?')
    }
}

after(() => {
    if (stack.length > 0) {
        console.warn('cypress-replay is still recording! Did you forget to call stopRecording()?')
    }
})
