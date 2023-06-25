import { CyHttpMessages, StaticResponse } from "cypress/types/net-stubbing";
import {ReplayConfig, ReplayMode} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import Logger from "../utility/Logger";
import {newTestId, patchWindow} from "../utility/patchWindow";
import RequestCollection from "../utility/RequestCollection";
import sanitizeHeaders from "../utility/sanitizeHeaders";
import createFixtureFilename from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";

export function startRecording(config: ReplayConfig = {}) {
    Cypress.config('cypressReplayRecordMode' as any, ReplayMode.Recording)
    Cypress.on('window:before:load', patchWindow)
    config = mergeConfig(config)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(config.dynamicRequestEnvComponents || [], Cypress.env);
    cy.window().then(patchWindow)
    return new RequestCollection(dynamicComponentManager, new Logger)
}

export function makeFilePath(folder: string = Cypress.spec.name, components: string[] = Cypress.currentTest.titlePath) {
    return createFixtureFilename(Cypress.config().fixturesFolder as string, folder, components)
}

export function stopRecording(requestCollection: RequestCollection, filePath: string, config: ReplayConfig = {}) {
    config = mergeConfig(config)
    Cypress.config('cypressReplayRecordMode' as any, null)
    Cypress.off('window:before:load', patchWindow)
    if (config.waitForRecord) {
        cy.wait(config.waitForRecord)
    }
    cy.writeFile(
        filePath,
        JSON.stringify(requestCollection.resolveMap(), null, 4)
    );
    for (const resolve of suspendedRequests) {
        resolve()
    }
}

export function isRecording() {
    return Cypress.config('cypressReplayRecordMode' as any) === ReplayMode.Recording
}

const suspendedRequests = new Set<() => void>()

export function interceptRequests(requestCollection: RequestCollection, config: ReplayConfig = {}) {
    config = mergeConfig(config)
    const testId = newTestId()
    cy.intercept(new RegExp(config.interceptPattern || ".*"), async (request: CyHttpMessages.IncomingHttpRequest) => {
        const startTime = Date.now();
        if (request.headers['x-cypress-test-id'] !== testId) {
            await new Promise<void>(resolve => suspendedRequests.add(resolve))
            return request.destroy()
        }

        requestCollection.pushIncomingRequest(request, new Promise<StaticResponse>((resolve) => {
            request.continue((response) => {
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
