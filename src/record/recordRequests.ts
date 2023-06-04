import { CyHttpMessages, StaticResponse } from "cypress/types/net-stubbing";
import {ReplayConfig} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import RequestCollection from "../utility/RequestCollection";
import sanitizeHeaders from "../utility/sanitizeHeaders";
import createFixtureFilename from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";

export function startRecording(config: ReplayConfig = {}) {
    Cypress.config('cypressReplayRecordMode' as any, true)
    config = mergeConfig(config)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(config.dynamicRequestEnvComponents || [], Cypress.env);
    return new RequestCollection(dynamicComponentManager)
}

export function makeFilePath(folder: string = Cypress.spec.name, components: string[] = Cypress.currentTest.titlePath) {
    return createFixtureFilename(Cypress.config().fixturesFolder as string, folder, components)
}

export function waitForNetwork(collection: RequestCollection): any {
    return cy
        .window({ log: false })
        .then(({ fetch }) => {
            let size = collection.requests.size
            return cy
                .wrap(fetch('//flush/'), { log: false })
                .then(() => Promise.all(collection.pending))
                .then(() => {
                    if (collection.requests.size > size) {
                        return waitForNetwork(collection)
                    }
                })
        })
}

export function stopRecording(requestCollection: RequestCollection, filePath: string) {
    Cypress.config('cypressReplayRecordMode' as any, false)
    cy.then(() => {
        cy.writeFile(
            filePath,
            JSON.stringify(requestCollection.resolveMap(), null, 4)
        );
    });
}

export function interceptRequests(requestCollection: RequestCollection, config: ReplayConfig = {}) {
    config = mergeConfig(config)
    requestCollection.pending = []
    cy.intercept(/https?:\/\/flush\//, { statusCode: 200, delay: 16, log: false })
    cy.intercept(new RegExp(config.interceptPattern || ".*"), (request: CyHttpMessages.IncomingHttpRequest) => {
        if (request.url.match(/https?:\/\/flush\//)) return
        const startTime = Date.now();
        requestCollection.pending.push(new Promise<void>((resolve) => {
            request.on('response', (response) => {
                requestCollection.pushIncomingRequest(request, {
                    body: response.body,
                    headers: sanitizeHeaders(response.headers),
                    statusCode: response.statusCode,
                    // Including a delay that matches how long the server took to response will help make tests more
                    // deterministic.
                    delay: Date.now() - startTime,
                })
                resolve()
            });
        }));
    }).as('cypress-replay')
}
