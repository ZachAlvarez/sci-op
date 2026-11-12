import { test, expect } from "@playwright/test";

async function openApp(page) {
  await page.goto("/index.html?figure=original");
  await expect(page.getByRole("tab", { name: "Program", exact: true })).toBeVisible();
}

test("the preview decodes the bundled voice and stops immediately", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "Program", exact: true }).click();
  await page.getByRole("button", { name: "Preview voice", exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  expect(await page.evaluate(() => ({ running: VOICE.context.state, text: VOICE.status, duration: VOICE.source.buffer.duration })))
    .toMatchObject({ running: "running", text: "American male · AI voice" });
  await page.getByRole("button", { name: "Stop preview", exact: true }).click();
  expect(await page.evaluate(() => ({ speaking: VOICE.speaking(), source: !!VOICE.source })))
    .toEqual({ speaking: false, source: false });
});

test("pause cancels a clip that finishes loading after the pause", async ({ page }) => {
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await page.route("**/assets/coach/*.mp3", async route => { await delayed; await route.continue().catch(() => {}); });
  await openApp(page);
  await page.locator('[data-g="start"]').click();
  await expect.poll(() => page.evaluate(() => VOICE.speaking())).toBe(true);
  await page.locator('[data-g="play"]').click();
  release();
  // Wait for the pending decode to finish, proving cancellation survives it.
  await page.evaluate(async () => { await Promise.allSettled([...VOICE.cache.values()]); });
  expect(await page.evaluate(() => ({ paused: G.paused, speaking: VOICE.speaking(), source: !!VOICE.source })))
    .toEqual({ paused: true, speaking: false, source: false });
});

test("mute stops playback and is remembered after reload", async ({ page }) => {
  await openApp(page);
  await page.locator('[data-g="start"]').click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  await page.locator('[data-g="voice"]').click();
  expect(await page.evaluate(() => VOICE.speaking())).toBe(false);
  await page.reload();
  await page.locator('[data-g="start"]').click();
  await expect(page.locator('[data-g="voice"]')).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => VOICE.speaking())).toBe(false);
});

test("missing audio uses a labeled device fallback and cannot stall an intro", async ({ page }) => {
  await page.addInitScript(() => {
    window.fallbackWords = [];
    Object.defineProperty(window, "speechSynthesis", { value: {
      getVoices: () => [{ name: "Microsoft David", lang: "en-US" }],
      cancel() {},
      speak(u) { window.fallbackWords.push(u.text); setTimeout(() => u.onend?.(), 10); }
    } });
    window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  });
  await page.route("**/assets/coach/*.mp3", route => route.fulfill({ status: 404, body: "Missing" }));
  await openApp(page);
  await page.locator('[data-g="start"]').click();
  await expect.poll(() => page.evaluate(() => window.fallbackWords.length)).toBeGreaterThan(0);
  await expect(page.locator('#guide [data-voice-status]')).toHaveText("Device voice — coach audio unavailable.");
  await expect.poll(() => page.evaluate(() => VOICE.speaking())).toBe(false);
});

test("rep counts never queue behind a coaching sentence", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name: "Program", exact: true }).click();
  await page.getByRole("button", { name: "Preview voice", exact: true }).click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  expect(await page.evaluate(async () => {
    const original = VOICE.source;
    await VOICE.say("2", { timed: true });
    const kept = VOICE.source === original;
    VOICE.cancel();
    return { kept, pending: VOICE.speaking() };
  })).toEqual({ kept: true, pending: false });
});

test("all bundled clips decode, and second-by-second counts fit their slots", async ({ page }) => {
  test.setTimeout(60_000);
  await openApp(page);
  const results = await page.evaluate(async () => {
    const context = new AudioContext();
    const invalid = [];
    for (const [text, clip] of Object.entries(window.COACH_CLIPS)) {
      try {
        const res = await fetch(clip.file);
        const buffer = await context.decodeAudioData(await res.arrayBuffer());
        if (!res.ok || buffer.duration < 0.15 || buffer.sampleRate <= 0) invalid.push(text);
        if (["1", "2", "3"].includes(text) && buffer.duration >= 1) invalid.push(`Long countdown: ${text}`);
      } catch { invalid.push(text); }
    }
    await context.close();
    return { count: Object.keys(window.COACH_CLIPS).length, invalid };
  });
  expect(results.count).toBeGreaterThan(100);
  expect(results.invalid).toEqual([]);
});

test("section speech replaces older audio and navigation preference survives reload", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name:"Program", exact:true }).click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  expect(await page.evaluate(() => VOICE.source.buffer.duration)).toBeGreaterThan(1);
  await page.getByRole("tab", { name:"Program", exact:true }).click();
  await page.locator('[data-voice-navigation]').uncheck();
  await page.reload();
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  expect(await page.evaluate(() => ({on:VOICE.on, navigation:VOICE.navigation, active:VOICE.speaking()})))
    .toEqual({on:true, navigation:false, active:false});
  // Explicit instructions remain available even when automatic narration is off.
  await page.getByRole("tab", { name:"Today", exact:true }).click();
  await page.getByRole("button", { name:"Hear today's plan", exact:true }).click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
});

test("global mute silences navigation and explicit instruction buttons", async ({ page }) => {
  await openApp(page);
  await page.locator('header [data-app-voice]').click();
  await page.getByRole("tab", { name:"Program", exact:true }).click();
  await page.locator('#view-program [data-open="p-bird"]').first().click();
  await page.locator('[data-key="p-bird"] [data-hear]').click();
  expect(await page.evaluate(() => VOICE.speaking())).toBe(false);
  await expect(page.locator('#view-program [data-app-voice]')).toHaveAttribute("aria-pressed", "false");
});

test("leaving a standalone hold stops its timer and audio", async ({ page }) => {
  await openApp(page);
  await page.locator('#view-today [data-open="t-curl"]').first().click();
  await page.locator('[data-key="t-curl"] [data-timer]').click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  await page.getByRole("tab", { name:"Program", exact:true }).click();
  expect(await page.evaluate(() => timerState)).toBeNull();
  await page.locator('[data-voice-navigation]').uncheck();
  expect(await page.evaluate(() => VOICE.speaking())).toBe(false);
  await page.getByRole("tab", { name:"Today", exact:true }).click();
  await page.locator('[data-key="t-curl"] [data-timer]').click();
  await expect.poll(() => page.evaluate(() => !!VOICE.source)).toBe(true);
  await page.getByRole("button", {name:"None",exact:true}).click();
  expect(await page.evaluate(() => ({timer:timerState, speaking:VOICE.speaking()})))
    .toEqual({timer:null, speaking:false});
});

test("camera setup uses the same bundled voice and shared mute preference", async ({ page }) => {
  await page.route("**/vision_bundle.mjs", route => route.fulfill({contentType:"text/javascript",body:"export const PoseLandmarker = {}; export const FilesetResolver = {};"}));
  await page.goto("/form-coach.html");
  const [clipResponse] = await Promise.all([
    page.waitForResponse(response=>response.url().includes("assets/coach/") && response.url().endsWith(".mp3")),
    page.getByRole("button", {name:"Hear setup",exact:true}).click()
  ]);
  expect(clipResponse.status()).toBe(200);
  await expect.poll(() => page.evaluate(() => document.getElementById("voiceStatus").textContent)).toBe("American male · AI voice");
  await page.locator('#setupVoiceBtn').click();
  await page.goto("/index.html?figure=original");
  await expect(page.locator('header [data-app-voice]')).toHaveAttribute("aria-pressed", "false");
});
