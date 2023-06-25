import { CyHttpMessages, StaticResponse } from "cypress/types/net-stubbing";
import {ReplayConfig, ReplayMode} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import Logger from "../utility/Logger";
import RequestCollection from "../utility/RequestCollection";
import sanitizeHeaders from "../utility/sanitizeHeaders";
import createFixtureFilename from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";

export function startRecording(config: ReplayConfig = {}) {
    Cypress.config('cypressReplayRecordMode' as any, ReplayMode.Recording)
    config = mergeConfig(config)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(config.dynamicRequestEnvComponents || [], Cypress.env);
    return new RequestCollection(dynamicComponentManager, new Logger)
}

export function makeFilePath(folder: string = Cypress.spec.name, components: string[] = Cypress.currentTest.titlePath) {
    return createFixtureFilename(Cypress.config().fixturesFolder as string, folder, components)
}

export function stopRecording(requestCollection: RequestCollection, filePath: string) {
    Cypress.config('cypressReplayRecordMode' as any, null)
    cy.writeFile(
        filePath,
        JSON.stringify(requestCollection.resolveMap(), null, 4)
    );
}

export function isRecording() {
    return Cypress.config('cypressReplayRecordMode' as any) === ReplayMode.Recording
}

export function interceptRequests(requestCollection: RequestCollection, config: ReplayConfig = {}) {
    config = mergeConfig(config)
    cy.intercept(new RegExp(config.interceptPattern || ".*"), (request: CyHttpMessages.IncomingHttpRequest) => {
        const startTime = Date.now();
        requestCollection.pushIncomingRequest(request, new Promise<StaticResponse>(resolve => {
            request.on('response', (response) => {
                resolve({
                    body: response.body,
                    headers: sanitizeHeaders(response.headers),
                    statusCode: response.statusCode,
                    // Including a delay that matches how long the server took to response will help make tests more
                    // deterministic.
                    delay: Date.now() - startTime,
                })
            })
        }))
    }).as('cypress-replay')
}
