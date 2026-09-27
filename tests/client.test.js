import assert from "node:assert/strict";
import test from "node:test";

import { fetchConversation, parseSSEStream, uploadFile } from "../src/api/client.js";


test("fetchConversation follows every pagination page", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });

  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(url);
    const page = requestedUrls.length;
    return new Response(JSON.stringify({
      success: true,
      data: [{ id: String(page), title: `Page ${page}`, created_at: "now" }],
      meta: { page, page_size: 100, total_count: 2, total_pages: 2 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const conversations = await fetchConversation();
  assert.deepEqual(conversations.map((conversation) => conversation.id), ["1", "2"]);
  assert.match(requestedUrls[1], /page=2/);
});


test("parseSSEStream handles chunked event data", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"token":"Hel'));
      controller.enqueue(encoder.encode('lo"}\n\ndata: {"done":true}\n\n'));
      controller.close();
    },
  });

  const events = [];
  for await (const event of parseSSEStream(new Response(body))) events.push(event);
  assert.deepEqual(events, [{ token: "Hello" }, { done: true }]);
});


test("uploadFile propagates backend failures", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(
    JSON.stringify({ success: false, error: { message: "Unsupported file" } }),
    { status: 415, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    uploadFile(new Blob(["bad"]), undefined),
    /Unsupported file/,
  );
});
