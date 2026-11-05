// Behavior tests for the form coach's camera lifecycle.
// MediaPipe is replaced with a stub so the tests are fast, offline, and can
// simulate a slow or failing model load. The camera is Chromium's fake device.
import { test, expect } from "@playwright/test";

const STUB = `
  const cfg = () => window.__mp || {};
  export const FilesetResolver = { forVisionTasks: async () => ({}) };
  export const PoseLandmarker = {
    createFromOptions: async () => {
      if (cfg().delay) await new Promise(r => setTimeout(r, cfg().delay));
      if (cfg().fail) throw new Error("stubbed model failure");
      return { detectForVideo: () => { window.__detectCalls = (window.__detectCalls || 0) + 1; return { landmarks: [] }; } };
    },
  };
`;

async function openCoach(page, { modelDelay = 0, modelFail = false, cameraDelay = 0 } = {}) {
  await page.route("**/vision_bundle.mjs", route =>
    route.fulfill({ contentType: "text/javascript", body: STUB }));
  await page.addInitScript(({ modelDelay, modelFail, cameraDelay }) => {
    window.__mp = { delay: modelDelay, fail: modelFail };
    // Record every stream the page opens, including ones it later discards,
    // so a test can tell whether any camera track was left running.
    window.__streams = [];
    const md = navigator.mediaDevices;
    const original = md.getUserMedia.bind(md);
    md.getUserMedia = async constraints => {
      if (cameraDelay) await new Promise(r => setTimeout(r, cameraDelay));
      const stream = await original(constraints);
      window.__streams.push(stream);
      return stream;
    };
  }, { modelDelay, modelFail, cameraDelay });
  await page.goto("/form-coach.html");
}

const liveTracks = page => page.evaluate(() =>
  window.__streams.flatMap(s => s.getTracks()).filter(t => t.readyState === "live").length);
const streamsOpened = page => page.evaluate(() => window.__streams.length);
const detectCalls = page => page.evaluate(() => window.__detectCalls || 0);

test("starts tracking and releases the camera on End", async ({ page }) => {
  await openCoach(page);
  await page.click("#go");
  await expect(page.locator("#stateLbl")).toHaveText(/Step into frame|No one in frame/);
  await expect(page.locator("#status")).toHaveText("");
  expect(await liveTracks(page)).toBe(1);
  await expect.poll(() => detectCalls(page)).toBeGreaterThan(0);

  await page.click("#endBtn");
  await expect(page.locator("#sum")).toHaveClass(/\bon\b/);
  expect(await liveTracks(page)).toBe(0);
  expect(await page.evaluate(() => document.getElementById("vid").srcObject)).toBeNull();
});

test("End while the camera is still opening stops the late stream", async ({ page }) => {
  await openCoach(page, { cameraDelay: 1500 });
  await page.click("#go");
  await page.click("#endBtn");
  await expect.poll(() => streamsOpened(page), { timeout: 5000 }).toBe(1);
  await expect.poll(() => liveTracks(page)).toBe(0);
  await page.waitForTimeout(500);
  expect(await detectCalls(page)).toBe(0);
});

test("End while the model is loading never starts tracking", async ({ page }) => {
  await openCoach(page, { modelDelay: 2000 });
  await page.click("#go");
  await expect(page.locator("#status")).toHaveText(/Loading pose model/);
  await page.click("#endBtn");
  expect(await liveTracks(page)).toBe(0);
  await page.waitForTimeout(2500); // let the stubbed model finish loading
  expect(await detectCalls(page)).toBe(0); // tracking loop never started
  expect(await liveTracks(page)).toBe(0);
});

test("a model load failure shows an error and turns the camera off", async ({ page }) => {
  await openCoach(page, { modelFail: true });
  await page.click("#go");
  await expect(page.locator("#status")).toHaveText(/Couldn't load the pose model/);
  expect(await liveTracks(page)).toBe(0);
});

test("leaving the page stops the camera", async ({ page }) => {
  await openCoach(page);
  await page.click("#go");
  await expect(page.locator("#stateLbl")).toHaveText(/Step into frame|No one in frame/);
  expect(await liveTracks(page)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
  expect(await liveTracks(page)).toBe(0);
});
