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
