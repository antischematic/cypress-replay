import {
    interceptRequests,
    makeFilePath,
    startRecording,
    stopRecording,
} from "./record/recordRequests";
import {interceptReplay, startReplay, stopReplay, waitForReplay} from "./replay/replayRequests";
import {ReplayConfig, ReplayMode} from "./types";

export default function enableCypressReplay(mode: ReplayMode | null = null, config: ReplayConfig = {}) {
    const replayMode = mode !== null ? mode : Cypress.env("REPLAY_RECORD_REQUESTS") ? ReplayMode.Recording : ReplayMode.Replaying;

    if (replayMode === ReplayMode.Recording) {
        beforeEach(function () {
            this.__requestCollection = startRecording(config)
            interceptRequests(this.__requestCollection, config);
        })

        afterEach(function () {
            stopRecording(this.__requestCollection, makeFilePath())
        })
    }

    if (replayMode === ReplayMode.Replaying) {
        beforeEach(function () {
            this.__requestCollection = startReplay(makeFilePath(), config)
            interceptReplay(this.__requestCollection, config)
        })

        afterEach(function () {
            if (config.waitForReplay) {
                waitForReplay(this.__requestCollection)
            }
            stopReplay(this.__requestCollection)
        })
    }
}

export {makeFilePath, interceptRequests, startRecording, stopRecording, isRecording} from "./record/recordRequests";
export { startReplay, interceptReplay, stopReplay, waitForReplay, isReplaying} from "./replay/replayRequests";
export { ReplayMode, ReplayConfig } from "./types"
