import {makeFilePath, interceptRequests, startRecording, stopRecording} from "./record/recordRequests";
import { startReplay, interceptReplay, stopReplay} from "./replay/replayRequests";
import {ReplayConfig} from "./types";

export enum ReplayMode {
    Recording,
    Replaying,
}

export default function enableCypressReplay(mode: ReplayMode | null = null, config: ReplayConfig = {}) {
    const replayMode = mode !== null ? mode : Cypress.env("REPLAY_RECORD_REQUESTS") ? ReplayMode.Recording : ReplayMode.Replaying;

    if (replayMode === ReplayMode.Recording) {
        beforeEach(() => {
            startRecording(config)
            interceptRequests(config);
        })

        afterEach(() => {
            stopRecording(makeFilePath())
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

export {makeFilePath, interceptRequests, startRecording, stopRecording} from "./record/recordRequests";
export { startReplay, interceptReplay, stopReplay} from "./replay/replayRequests";
