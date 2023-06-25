import {CyHttpMessages} from "cypress/types/net-stubbing";
import {ReplayConfig, ReplayMode} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import RequestCollection from "../utility/RequestCollection";
import { createMergedFixtureFilename } from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";
import Logger from "../utility/Logger";
import Chainable = Cypress.Chainable;

export function startReplay(filePath: string, configuration: Partial<ReplayConfig> = {}) {
    configuration = mergeConfig(configuration)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(configuration.dynamicRequestEnvComponents || [], Cypress.env);
    const logger = new Logger();
    const collection = new RequestCollection(dynamicComponentManager, logger);

    Cypress.config('cypressReplayRecordMode' as any, ReplayMode.Replaying)

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

export function waitForReplay(collection: RequestCollection): any {
    return cy.then(() => collection.isDone() || collection.replayDone)
}

export function interceptReplay(requestCollection: RequestCollection, configuration: Partial<ReplayConfig> = {}) {
    cy.then(() => {
        configuration = mergeConfig(configuration)
        cy.intercept(new RegExp(configuration.interceptPattern || ".*"), async (req: CyHttpMessages.IncomingHttpRequest) => {
            const fixtureResponse = requestCollection.shiftRequest(req);
            if (fixtureResponse && fixtureResponse.didRespond !== false) {
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
                req.reply({
                    statusCode: 408,
                    delay: 1000 * 60 * 60 * 24 * 7
                })
                requestCollection.checkDone()
            }
        }).as('cypress-replay');
    })
}

export function isReplaying() {
    return Cypress.config('cypressReplayRecordMode' as any) === ReplayMode.Replaying
}

export function stopReplay(collection: RequestCollection) {
    Cypress.config('cypressReplayRecordMode' as any, null)
    cy.then(() => {
        collection.logger.getAll().map((log) => cy.log(`cypress-replay: ${log.message}\n\n${JSON.stringify(log.context)}`));
    })
}
