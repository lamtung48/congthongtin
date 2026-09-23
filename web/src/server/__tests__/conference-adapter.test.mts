import { test, describe, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { conferenceAdapter, describeConferences } from "@/server/integrations/platformAdapters/conferenceAdapter";

/**
 * The Hội nghị card's figure: "Tham gia ngay N hội nghị", N = NOT_STARTED +
 * ONGOING conferences from hoinghi's public `/public/conferences` list. Pure
 * function + the adapter against a stubbed `fetch` — no network, no DB.
 */

describe("describeConferences", () => {
  test("counts not-yet-started + in-progress, ignores ended", () => {
    assert.deepEqual(describeConferences(["ONGOING", "NOT_STARTED", "NOT_STARTED", "ENDED", "ENDED"]), {
      currentActivity: "Tham gia ngay 3 hội nghị",
      live: true,
    });
  });

  test("upcoming only → not live", () => {
    assert.deepEqual(describeConferences(["NOT_STARTED", "ENDED"]), { currentActivity: "Tham gia ngay 1 hội nghị", live: false });
  });

  test("nothing joinable → no misleading zero", () => {
    assert.deepEqual(describeConferences(["ENDED"]), { currentActivity: "Chưa có hội nghị sắp diễn ra", live: false });
    assert.deepEqual(describeConferences([]), { currentActivity: "Chưa có hội nghị sắp diễn ra", live: false });
  });
});

describe("conferenceAdapter.fetchActivity", () => {
  afterEach(() => mock.restoreAll());

  function stubFetch(body: unknown, status = 200) {
    return mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  }

  test("reads {apiBaseUrl}/public/conferences and reports LIVE when one is ongoing", async () => {
    const fetchMock = stubFetch({ conferences: [{ status: "ONGOING", name: "A" }, { status: "NOT_STARTED", name: "B" }, { status: "ENDED", name: "C" }] });
    const result = await conferenceAdapter.fetchActivity({ apiBaseUrl: "https://hoinghi.example/api/" });
    assert.equal(String(fetchMock.mock.calls[0].arguments[0]), "https://hoinghi.example/api/public/conferences");
    assert.deepEqual(result, { ok: true, status: "LIVE", currentActivity: "Tham gia ngay 2 hội nghị" });
  });

  test("ACTIVE when nothing is ongoing", async () => {
    stubFetch({ conferences: [{ status: "NOT_STARTED" }] });
    assert.deepEqual(await conferenceAdapter.fetchActivity({ apiBaseUrl: "https://hoinghi.example/api" }), {
      ok: true,
      status: "ACTIVE",
      currentActivity: "Tham gia ngay 1 hội nghị",
    });
  });

  test("unexpected payload / HTTP error / no base URL → failure, never a guess", async () => {
    stubFetch({ liveSessionTitle: null });
    assert.equal((await conferenceAdapter.fetchActivity({ apiBaseUrl: "https://x/api" })).ok, false);
    mock.restoreAll();
    stubFetch({ error: "nope" }, 500);
    assert.equal((await conferenceAdapter.fetchActivity({ apiBaseUrl: "https://x/api" })).ok, false);
    assert.deepEqual(await conferenceAdapter.fetchActivity({ apiBaseUrl: null }), {
      ok: false,
      reason: "not_configured",
      message: "Chưa cấu hình apiBaseUrl cho nền tảng Hội nghị.",
    });
  });
});
