import {CyHttpMessages, StaticResponse} from "cypress/types/net-stubbing";
import {ReplayConfig} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import RequestCollection from "../utility/RequestCollection";
import { createMergedFixtureFilename } from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";
import Logger from "../utility/Logger";

export function startReplay(filePath: string, configuration: Partial<ReplayConfig> = {}) {
    configuration = mergeConfig(configuration)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(configuration.dynamicRequestEnvComponents || [], Cypress.env);
    const logger = new Logger();
    const collection = new RequestCollection(dynamicComponentManager, logger);

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
    return cy.then(() => {
        const size = collection.replayedRequests.size
        cy.then(() => collection.replayedRequests)
            .wait(16, { log: false })
            .then(() => {
                if (collection.replayedRequests.size > size) {
                    return waitForReplay(collection)
                }
            })
    })
}

export function interceptReplay(requestCollection: RequestCollection, configuration: Partial<ReplayConfig> = {}) {
    configuration = mergeConfig(configuration)
    cy.intercept(/https?:\/\/flush\//, { statusCode: 200, delay: 1, log: false })
    cy.intercept(new RegExp(configuration.interceptPattern || ".*"), async (req: CyHttpMessages.IncomingHttpRequest) => {
        const fixtureResponse = await requestCollection.shiftRequest(req);
        if (fixtureResponse) {
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
        }
    });
}

export function stopReplay({ logger }: RequestCollection) {
    return logger.getAll().map((log) => cy.log(`cypress-replay: ${log.message}\n\n${JSON.stringify(log.context)}`));
}
