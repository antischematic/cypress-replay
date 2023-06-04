import enableCypressReplay, {
    interceptReplay,
    interceptRequests,
    makeFilePath,
    startRecording, startReplay,
    stopRecording, stopReplay,
    waitForNetwork, waitForReplay
} from "../../../lib";
import {ReplayMode} from "../../../src";

function runTests() {
    let timeouts = [Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000, Math.random() * 1000]

    function setupSuiteLevelHooks(mode: ReplayMode) {
        let collection: any
        if (mode === ReplayMode.Recording) {
            before(() => {
                collection = startRecording()
            })

            beforeEach(() => {
                interceptRequests(collection)
            })

            afterEach(() => {
                waitForNetwork(collection)
            })

            after(() => {
                stopRecording(collection, makeFilePath(Cypress.spec.name, ['Scenario']))
            })
        } else {
            before(() => {
                collection = startReplay(makeFilePath(Cypress.spec.name, ['Scenario']), {responseDelayOverride: 0})
            })

            beforeEach(() => {
                interceptReplay(collection)
            })

            afterEach(() => {
                waitForReplay(collection)
            })

            after(() => {
                stopReplay(collection)
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
                cy.window().then(({fetch}) => {
                    fetch('https://jsonplaceholder.typicode.com/todos/1').catch(() => {})
                    fetch('https://jsonplaceholder.typicode.com/todos/2').catch(() => {})
                    fetch('https://jsonplaceholder.typicode.com/todos/3').catch(() => {})

                    setTimeout(() => {
                        fetch('https://jsonplaceholder.typicode.com/todos/4').catch(() => {})
                    }, timeouts[0])

                    setTimeout(() => {
                        fetch('https://jsonplaceholder.typicode.com/todos/5').catch(() => {})
                    }, timeouts[1])

                    setTimeout(() => {
                        fetch('https://jsonplaceholder.typicode.com/todos/6').then(() => {
                            setTimeout(() => {
                                fetch('https://jsonplaceholder.typicode.com/todos/7').then(() => {
                                    setTimeout(() => {
                                        fetch('https://jsonplaceholder.typicode.com/todos/8').catch(() => {})
                                        fetch('https://jsonplaceholder.typicode.com/todos/9').catch(() => {})
                                        fetch('https://jsonplaceholder.typicode.com/todos/10').catch(() => {})
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

    // runTest(ReplayMode.Recording)
    // runTest(ReplayMode.Replaying)
    runTest(ReplayMode.Recording, true)
    runTest(ReplayMode.Replaying, true)
}

for (let i = 0; i < 10; i++) {
    runTests()
}
