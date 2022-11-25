import {describe, expect, test} from '@jest/globals';
import RequestCollection from "./RequestCollection";
import EnvComponentManager from "./EnvComponentManager";

test('requests can be pushed and popped from the collection', () => {
    const collection = new RequestCollection(new EnvComponentManager({}));

    const requestA = {
        body: "",
        headers: {a: "b"},
        method: "GET",
        url: "https://example.com/api",
        query: {},
        httpVersion: "1.1",
    };
    const requestB = {
        body: "",
        headers: {a: "b"},
        method: "GET",
        url: "https://example.com/api/different-endpoint",
        query: {},
        httpVersion: "1.1",
    };

    collection.pushRequest(requestA, {
        body: "Request A first response"
    });
    collection.pushRequest(requestB, {
        body: "Request B response"
    });
    collection.pushRequest(requestA, {
        body: "Request A second response"
    });

    expect(collection.shiftRequest(requestB)?.body).toEqual("Request B response");
    expect(collection.shiftRequest(requestB)).toEqual(null);
    expect(collection.shiftRequest(requestA)?.body).toEqual("Request A first response");
    expect(collection.shiftRequest(requestA)?.body).toEqual("Request A second response");
    expect(collection.shiftRequest(requestA)).toEqual(null);
});
