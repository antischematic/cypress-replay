import {
    makeFilePath,
    interceptRequests,
    startRecording,
    stopRecording,
    waitForNetwork
} from "./record/recordRequests";
import { startReplay, interceptReplay, stopReplay} from "./replay/replayRequests";
import {ReplayConfig} from "./types";

export enum ReplayMode {
    Recording,
    Replaying,
}

export default function enableCypressReplay(mode: ReplayMode | null = null, config: ReplayConfig = {}) {
    const replayMode = mode !== null ? mode : Cypress.env("REPLAY_RECORD_REQUESTS") ? ReplayMode.Recording : ReplayMode.Replaying;

    if (replayMode === ReplayMode.Recording) {
        beforeEach(function () {
            this.__requestCollection = startRecording(config)
            interceptRequests(this.__requestCollection, config);
        })

        afterEach(function () {
            waitForNetwork(this.__requestCollection)
            stopRecording(this.__requestCollection, makeFilePath())
        })
    }

    if (replayMode === ReplayMode.Replaying) {
        beforeEach(() => {
            startReplay(makeFilePath(), config)
            interceptReplay(config)
        })

        afterEach(() => {
            stopReplay()
        })
    }
}

export {makeFilePath, interceptRequests, startRecording, stopRecording, waitForNetwork} from "./record/recordRequests";
export { startReplay, interceptReplay, stopReplay} from "./replay/replayRequests";
