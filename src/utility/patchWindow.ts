export let currentTestId = 0

export function newTestId() {
    return (++currentTestId).toString()
}

export function patchWindow(window: any) {
    if (!window.__cypressWindowPatchApplied) {
        window.__cypressWindowPatchApplied = true
        const testId = currentTestId.toString()
        const origOpen = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function (...args: any[]) {
            origOpen.apply(this, args as any);
            this.setRequestHeader('x-cypress-test-id', testId);
        };
        const originalFetch = window.fetch;
        window.fetch = function (input: any, init: any) {
            if (!init) {
                init = {};
            }
            if (!init.headers) {
                init.headers = new Headers();
            }
            if (init.headers instanceof Headers) {
                init.headers.append('x-cypress-test-id', testId);
            } else if (init.headers instanceof Array) {
                init.headers.push(['x-cypress-test-id', testId]);
            } else {
                init.headers['x-cypress-test-id'] = testId;
            }
            return originalFetch(input, init);
        };
    }
}
