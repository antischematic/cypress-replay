import {CyHttpMessages, StaticResponse} from "cypress/types/net-stubbing";
import createRequestKey from "./createRequestKey";
import EnvComponentManager from "./EnvComponentManager";
import IncomingRequest = CyHttpMessages.IncomingRequest;
import Logger, { LoggerInterface } from "./Logger";

interface RecordedResponse extends StaticResponse {
    insertAtIndex?: number
    hasResponse?: boolean
}

export type RequestMap = Map<string, WrappedResponse[]>;
export type RequestMapFixture = {
    [key: string]: RecordedResponse[];
};
export type ResponseMap = {
    [key: string]: RecordedResponse[];
};

export interface WrappedResponse {
    promise: Promise<RecordedResponse>
    response?: RecordedResponse
    request: any
}

function wrapPromise(promise: Promise<RecordedResponse>, request: any) {
    const wrapped: WrappedResponse = {
        promise: promise.then(value => {
            wrapped.response = value
            return value
        }),
        request,
        response: undefined,
    }
    return wrapped
}

export default class RequestCollection {
    private envComponentManager: EnvComponentManager;
    private markReplayDone!: () => void
    public requests: RequestMap;
    public responses: ResponseMap;
    public logger: LoggerInterface;
    public replayDone: Promise<void>

    constructor(envComponentManager: EnvComponentManager, logger: LoggerInterface) {
        this.envComponentManager = envComponentManager;
        this.logger = logger
        this.requests = new Map();
        this.responses = {}
        this.replayDone = new Promise<void>(resolve => {
            this.markReplayDone = resolve
        })
    }

    pushReplayedRequest(promise: Promise<void>) {
        promise.finally(() => {
            this.checkDone()
        })
    }

    isDone() {
        return Object.values(this.responses).every(responses => responses.length === 0)
    }

    checkDone() {
        if (this.isDone()) {
            this.markReplayDone()
        }
    }

    appendFromFixture(fixture: RequestMapFixture) {
        Object.keys(fixture).forEach((key) => {
            if (!(key in this.responses)) {
                this.responses[key] = [];
            }
            fixture[key].forEach((response) => {
                // Allow requests in fixture files to specify an index where they'll be inserted. This gives
                // some control over where manually authored fixtures are inserted, otherwise they'll be
                // appended in the order they are encountered.
                if (response.insertAtIndex) {
                    this.responses[key].splice(response.insertAtIndex, 0, response);
                } else {
                    this.responses[key].push(response);
                }
            });
        });
    }

    pushIncomingRequest(request: IncomingRequest, response: Promise<RecordedResponse>) {
        const key = this.envComponentManager.removeDynamicComponents(createRequestKey(request));
        if (!this.requests.has(key)) {
            this.requests.set(key, []);
        }
        this.requests.get(key)!.push(wrapPromise(response, request));
    }

    shiftRequest(request: IncomingRequest): RecordedResponse | null {
        const key = this.envComponentManager.removeDynamicComponents(createRequestKey(request));
        if (!(key in this.responses) || this.responses[key].length === 0) {
            this.logger.push("Request missing from fixture", { key });
            return null
        }
        this.logger.push("Request found in fixture", { key });
        return this.responses[key].shift()!;
    }

    resolveMap(): ResponseMap {
        const responses = {} as any
        for (const [key, requests] of this.requests) {
            responses[key] = requests.map(request => {
                return {
                    hasResponse: !!request.response,
                    ...request.response,
                    request: request.request,
                }
            })
        }
        return responses;
    }
}
