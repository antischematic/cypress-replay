import {ReplayConfig} from "../types";

export default function loadConfiguration(): ReplayConfig {
    return (
        Cypress.config() as any as Cypress.ConfigOptions & {
            cypressReplay: ReplayConfig;
        }
    ).cypressReplay;
}

export function mergeConfig(config: Partial<ReplayConfig>) {
    // Allow the configuration to be defined globally and then to be overridden on a test by test basis.
    return {
        ...loadConfiguration(),
        ...config,
    };
}
