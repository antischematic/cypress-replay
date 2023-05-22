import { CyHttpMessages } from "cypress/types/net-stubbing";
import {ReplayConfig} from "../types";
import {mergeConfig} from "../utility/loadConfiguration";
import RequestCollection from "../utility/RequestCollection";
import { createMergedFixtureFilename } from "../utility/createFixtureFilename";
import EnvComponentManager from "../utility/EnvComponentManager";
import Logger from "../utility/Logger";

const stack = [] as [RequestCollection, Logger][]

function getCurrent() {
    return stack[stack.length - 1] || []
}

export function startReplay(filePath: string, configuration: Partial<ReplayConfig> = {}) {
    configuration = mergeConfig(configuration)
    const dynamicComponentManager = EnvComponentManager.fromEnvironment(configuration.dynamicRequestEnvComponents || [], Cypress.env);
    const logger = new Logger();
    const collection = new RequestCollection(dynamicComponentManager, logger);

    stack.push([collection, logger])

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
}

export function interceptReplay(configuration: Partial<ReplayConfig> = {}) {
    const [requestCollection] = getCurrent()
    if (requestCollection) {
        cy.intercept(new RegExp(configuration.interceptPattern || ".*"), async (req: CyHttpMessages.IncomingHttpRequest) => {
            const fixtureResponse = await requestCollection.shiftRequest(req);
            if (fixtureResponse) {
                req.reply({
                    ...fixtureResponse,
                    delay:
                        configuration.responseDelayOverride !== undefined
                            ? configuration.responseDelayOverride
                            : fixtureResponse.delay,
                });
            }
        });
    } else {
        console.warn('No active replay found. Did you forget to call startReplay()?')
    }
}

export function stopReplay() {
    const [_, logger] = stack.pop() || []
    if (logger) {
        return logger.getAll().map((log) => cy.log(`cypress-replay: ${log.message}\n\n${JSON.stringify(log.context)}`));
    } else {
        console.warn('You called stopReplay() but replay is not currently active. Did you forget to call startRecording()?')
    }
}

after(() => {
    if (stack.length > 0) {
        console.warn('cypress-replay is still replaying! Did you forget to call stopReplay()?')
    }
})
