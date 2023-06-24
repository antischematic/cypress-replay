export type ReplayConfig = {
    interceptPattern?: string;
    dynamicRequestEnvComponents?: Array<string>;
    responseDelayOverride?: number;
    waitForReplay?: boolean
};

export enum ReplayMode {
    Recording,
    Replaying,
}
