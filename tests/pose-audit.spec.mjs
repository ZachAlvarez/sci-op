// Runs the built-in pose audit on both figures. It samples every exercise at
// 21 positions on both sides and reports finite transforms, start poses that
// drift from their specs and, for the human figure, joint continuity and
// contact checks. These are renderer regression checks, not biomechanics.
import { test, expect } from "@playwright/test";

test.use({
  launchOptions: {
    // Software WebGL, so the 3D engine runs on CI machines without a GPU.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

for (const figure of ["original", "human"]) {
  test(`pose audit passes on the ${figure} figure`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto(`/index.html?preview=figure&figure=${figure}`);
    await page.waitForFunction(() => typeof V3 !== "undefined" && V3 && V3.loaded, null, { timeout: 60_000 });
    const report = await page.evaluate(() => ({ is3D: V3.is3D, ...V3.auditPoses() }));

    expect(report.is3D, "WebGL is required for the audit").toBe(true);
    // A failed human asset load silently falls back to the original figure.
    expect(report.figure).toBe(figure);
    expect(report.exercises).toBe(20);
    expect(report.samples).toBe(840);
    expect(report.errors).toEqual([]);
  });
}

test("the workout app uses the human figure by default and the original on request", async ({ page }) => {
  const figureAt = async url => {
    await page.goto(url);
    await page.waitForFunction(() => typeof V3 !== "undefined" && V3 && V3.loaded, null, { timeout: 60_000 });
    return page.evaluate(() => V3.figure);
  };
  expect(await figureAt("/index.html")).toBe("human");
  expect(await figureAt("/index.html?figure=original")).toBe("original");
});

test("a missing human asset falls back to the original figure", async ({ page }) => {
  await page.route("**/assets/human-base-rigged.glb", route => route.abort());
  await page.goto("/index.html");
  await page.waitForFunction(() => typeof V3 !== "undefined" && V3 && V3.loaded, null, { timeout: 60_000 });
  expect(await page.evaluate(() => V3.figure)).toBe("original");
});

test("dragging the figure rotates the camera", async ({ page }) => {
  await page.goto("/index.html?preview=figure&exercise=goblet");
  await page.waitForFunction(() => typeof V3 !== "undefined" && V3 && V3.loaded, null, { timeout: 60_000 });
  const before = await page.evaluate(() => V3.camera);

  const box = await page.locator("#study-stage canvas").boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 160, y + 40, { steps: 8 });
  await page.mouse.up();

  const after = await page.evaluate(() => V3.camera);
  expect(after.theta).toBeCloseTo(before.theta - 1.6, 1); // 160 px at 0.01 rad per px
  expect(after.phi).toBeLessThan(before.phi);             // mouse drags also tilt

  // Moving the mouse without a button held must not rotate.
  await page.mouse.move(x - 100, y);
  expect((await page.evaluate(() => V3.camera)).theta).toBe(after.theta);
});
