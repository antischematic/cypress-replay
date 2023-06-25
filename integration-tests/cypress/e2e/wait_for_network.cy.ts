import enableCypressReplay, {
    interceptReplay,
    interceptRequests,
    makeFilePath,
    startRecording, startReplay,
    stopRecording, stopReplay,
} from "../../../lib";
import {ReplayMode} from "../../../src/types";

function runTests() {
    let timeouts = [Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000]

    function setupSuiteLevelHooks(mode: ReplayMode) {
        let collection: any
        if (mode === ReplayMode.Recording) {
            beforeEach(() => {
                collection = startRecording()
                interceptRequests(collection)
            })

            afterEach(() => {
                stopRecording(collection, makeFilePath(Cypress.spec.name, ['Scenario']))
            })
        } else {
            beforeEach(() => {
                collection = startReplay(makeFilePath(Cypress.spec.name, ['Scenario']), {responseDelayOverride: 0})
                interceptReplay(collection)
            })

            afterEach(() => {
                stopReplay(collection, { waitForReplay: true })
            })
        }
    }

    function runTest(mode: ReplayMode, suiteMode = false) {
        describe('Wait for network', () => {
            if (suiteMode) {
                setupSuiteLevelHooks(mode)
            } else {
                enableCypressReplay(mode, {responseDelayOverride: 0});
            }

            it('Should fetch and replay everything here', () => {
                cy.window().then(({fetch, XMLHttpRequest }) => {
                    fetch('https://jsonplaceholder.cypress.io/todos/1').catch(() => {})
                    fetch('https://jsonplaceholder.cypress.io/todos/2').catch(() => {})

                    const req = new XMLHttpRequest();
                    req.addEventListener("load", () => {
                        console.log('XMLHttpRequest loaded')
                    });
                    req.open("GET", "https://jsonplaceholder.cypress.io/todos/3");
                    req.send();

                    setTimeout(() => {
                        fetch('https://jsonplaceholder.cypress.io/todos/4').catch(() => {})
                    }, timeouts[0])

                    setTimeout(() => {
                        fetch('https://jsonplaceholder.cypress.io/todos/5').catch(() => {})
                    }, timeouts[1])

                    setTimeout(() => {
                        fetch('https://jsonplaceholder.cypress.io/todos/6').then(() => {
                            setTimeout(() => {
                                fetch('https://jsonplaceholder.cypress.io/todos/7').then(() => {
                                    setTimeout(() => {
                                        fetch('https://jsonplaceholder.cypress.io/todos/8').catch(() => {})
                                        fetch('https://jsonplaceholder.cypress.io/todos/9').catch(() => {})
                                        fetch('https://jsonplaceholder.cypress.io/todos/10').catch(() => {})
                                    }, timeouts[2])
                                }).catch(() => {})
                            }, timeouts[3])
                        }).catch(() => {})
                    }, timeouts[4])
                })

                // @ts-ignore
                cy.waitOnRecord(timeouts[5])
            })

            it('Should not fetch or replay anything here', () => {
                // @ts-ignore
                cy.waitOnRecord(timeouts[6])
            })
        })
    }

    runTest(ReplayMode.Recording)
    runTest(ReplayMode.Replaying)
    // runTest(ReplayMode.Recording, true)
    // runTest(ReplayMode.Replaying, true)
}

for (let i = 0; i < 10; i++) {
    runTests()
}
