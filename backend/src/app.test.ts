import { once } from "node:events";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./app.js";

test("allows local CORS origins and denies external browser origins", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}/api/settings`;

    const localResponse = await fetch(url, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(localResponse.status, 200);
    assert.equal(
      localResponse.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );

    const externalResponse = await fetch(url, {
      headers: { Origin: "https://example.invalid" },
    });
    assert.equal(externalResponse.status, 200);
    assert.equal(externalResponse.headers.get("access-control-allow-origin"), null);

    const directResponse = await fetch(url);
    assert.equal(directResponse.status, 200);
  } finally {
    server.close();
    await once(server, "close");
  }
});
