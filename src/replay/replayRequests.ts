import {CyHttpMessages} from "cypress/types/net-stubbing";
import {ReplayConfig, ReplayMode} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import {newTestId, patchWindow} from "../utility/patchWindow";
import RequestCollection from "../utility/RequestCollection";
import { createMergedFixtureFilename } from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";
import Logger from "../utility/Logger";

export function startReplay(filePath: string, configuration: Partial<ReplayConfig> = {}) {
    configuration = mergeConfig(configuration)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(configuration.dynamicRequestEnvComponents || [], Cypress.env);
    const logger = new Logger();
    const collection = new RequestCollection(dynamicComponentManager, logger);

    Cypress.config('cypressReplayRecordMode' as any, ReplayMode.Replaying)
    Cypress.on('window:before:load', patchWindow)

    cy.window().then(patchWindow)
    cy.readFile(filePath)
        .then((fileContents) => {
            collection.appendFromFixture(fileContents);
            return collection;
        })
        // Optionally append an additional hand-crafted fixture file to merge into the request collection,
        // for cases where tests are non-deterministic or may otherwise require additional fixed requests in the
        // same collection format.
        .then((requestCollection) =>
            cy.wrap<Promise<RequestCollection>, RequestCollection>(
                new Promise<RequestCollection>((resolve) => {
                    cy.readFile(
                        createMergedFixtureFilename(
                            Cypress.config().fixturesFolder as string,
                            Cypress.spec.name,
                            Cypress.currentTest.titlePath
                        )
                    ).should((mergeFixture) => {
                        if (mergeFixture) {
                            requestCollection.appendFromFixture(mergeFixture);
                        }
                        resolve(requestCollection);
                    });
                }),
                {log: false}
            )
        )
    return collection
}

let suspendedRequests = new Set<() => void>()

export function interceptReplay(requestCollection: RequestCollection, configuration: Partial<ReplayConfig> = {}) {
    configuration = mergeConfig(configuration)
    const testId = newTestId()
    cy.intercept(new RegExp(configuration.interceptPattern || ".*"), async (req: CyHttpMessages.IncomingHttpRequest) => {
        if (req.headers['x-cypress-test-id'] !== testId) {
            await new Promise<void>(resolve => suspendedRequests.add(resolve))
            return req.destroy()
        }
        const fixtureResponse = requestCollection.shiftRequest(req);
        if (fixtureResponse && fixtureResponse.hasResponse !== false) {
            const promise = new Promise<void>((resolve) => {
                req.on("response", () => {
                    resolve()
                })
            })

            requestCollection.pushReplayedRequest(promise)

            req.reply({
                ...fixtureResponse,
                delay:
                    configuration.responseDelayOverride !== undefined
                        ? configuration.responseDelayOverride
                        : fixtureResponse.delay,
            });
        } else {
            requestCollection.checkDone()
            await new Promise<void>((resolve) => {
                suspendedRequests.add(resolve)
            })
            req.destroy()
        }
    })
}

export function isReplaying() {
    return Cypress.config('cypressReplayRecordMode' as any) === ReplayMode.Replaying
}

export function stopReplay(collection: RequestCollection, config: Partial<ReplayConfig> = {}) {
    Cypress.config('cypressReplayRecordMode' as any, null)
    Cypress.off('window:before:load', patchWindow)
    if (config.waitForReplay) {
        cy.then(() => collection.isDone() || collection.replayDone)
    }
    cy.then(() => {
        collection.logger.getAll().map((log) => cy.log(`cypress-replay: ${log.message}\n\n${JSON.stringify(log.context)}`));
        for (const resolve of suspendedRequests) {
            resolve()
        }
        suspendedRequests.clear()
    })
}
