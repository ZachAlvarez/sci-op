import { test, expect } from "@playwright/test";

async function openApp(page, { symptoms = [], training = false } = {}) {
  await page.addInitScript(({ symptoms, training }) => {
    const key = "b2l-state-v1";
    if (localStorage.getItem(key)) return;
    const date = offset => {
      const d = new Date(); d.setDate(d.getDate() - offset);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    };
    const log = {};
    symptoms.forEach((sym, offset) => { if (sym !== "missing") log[date(offset)] = { done: [], sym, extra: false }; });
    if (training) {
      log[date(1)] ||= { done: [], sym: null, extra: false };
      log[date(1)].training = { goblet: { weight:25, unit:"lb", reps:"10, 8", difficulty:"Hard", notes:'Left side felt harder. <img src=x onerror="alert(1)">', updated:1 } };
    }
    localStorage.setItem(key, JSON.stringify({ phase:1, strengthDays:[0,1,2,3,4,5,6], log, milestones:{}, updated:1 }));
  }, { symptoms, training });
  await page.goto("/index.html?figure=original");
  await expect(page.getByRole("tab", { name:"Today", exact:true })).toBeVisible();
}

test("new and incomplete symptom history never invent symptom-free days", async ({ page }) => {
  await openApp(page);
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(page.locator("#symptom-history")).toContainText("No symptom check-in today");
  await expect(page.locator("#symptom-history")).not.toContainText("3+ weeks");
});

test("a missing check-in breaks the count even with older symptom-free history", async ({ page }) => {
  await openApp(page, { symptoms:["none","central","missing",...Array(22).fill("none")] });
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(page.locator("#symptom-history")).toContainText("2 consecutive daily check-ins");
});

test("continuous recorded check-ins count, and today's leg symptoms reset the count", async ({ page }) => {
  await openApp(page, { symptoms:Array(21).fill("none") });
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(page.locator("#symptom-history")).toContainText("21 consecutive daily check-ins");
  await page.getByRole("tab", { name:"Today", exact:true }).click();
  await page.getByRole("button", { name:"Traveling down the leg", exact:true }).click();
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(page.locator("#symptom-history")).toHaveText("Today's check-in records symptoms traveling down the leg.");
});

test("the reduced list and guided session agree on a scheduled strength day", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name:"Traveling down the leg", exact:true }).click();
  expect(await page.locator("#view-today .ex").evaluateAll(nodes => nodes.map(n=>n.dataset.id))).toEqual(["walk","curl","bird","glide"]);
  await page.locator('[data-g="start"]').click();
  expect(await page.evaluate(() => G.ids)).toEqual(["walk","curl","bird","glide"]);
  await page.getByRole("button", { name:"End workout", exact:true }).click();
  await page.getByRole("button", { name:"None", exact:true }).click();
  await expect(page.locator('#view-today [data-id="goblet"]')).toBeVisible();
});

test("reporting leg symptoms stops the session and excludes the stopped exercise on restart", async ({ page }) => {
  await openApp(page);
  await page.locator('[data-g="start"]').click();
  await page.getByRole("button", { name:"Symptoms going down the leg", exact:true }).click();
  await expect(page.locator("#guide")).toBeHidden();
  await expect(page.locator("#saveStatus")).toContainText("Session stopped");
  await expect(page.locator('#view-today [data-id="walk"]')).toHaveCount(0);
  await page.locator('[data-g="start"]').click();
  expect(await page.evaluate(() => G.ids)).toEqual(["curl","bird","glide"]);
  expect(await page.evaluate(() => dayLog().done)).not.toContain("walk");
});

test("an exhausted reduced routine cannot start an empty guided session", async ({ page }) => {
  await openApp(page, { symptoms:["leg"] });
  for(let i=0;i<4;i++){
    await page.locator('[data-g="start"]').click();
    await page.getByRole("button", { name:"Symptoms going down the leg", exact:true }).click();
  }
  await expect(page.locator('[data-g="start"]')).toBeDisabled();
  await expect(page.getByRole("heading", { name:"No exercises queued", exact:true })).toBeVisible();
  expect(await page.evaluate(() => sessionIds())).toEqual([]);
});

test("recorded work survives reload, shows the last session, and safely renders notes", async ({ page }) => {
  await openApp(page, { training:true });
  await page.locator('#view-today [data-record="goblet"]').click();
  const form = page.locator("#record-form");
  await expect(form.locator(".previous-entry")).toContainText("25 lb");
  await expect(form.locator(".previous-entry")).toContainText('<img src=x onerror="alert(1)">');
  await expect(form.locator(".previous-entry img")).toHaveCount(0);
  await expect(form.locator('[name="weight"]')).toHaveValue("25");
  await expect(form.locator('[name="reps"]')).toHaveValue("");
  await form.locator('[name="weight"]').fill("27.5");
  await form.locator('[name="unit"]').selectOption("kg");
  await form.locator('[name="reps"]').fill("10, 10, 9");
  await form.locator('[name="difficulty"]').selectOption("Moderate");
  await form.locator('[name="notes"]').fill("Controlled lowering; use the same load next time.");
  await form.locator('[name="complete"]').check();
  await form.getByRole("button", { name:"Save entry", exact:true }).click();
  await expect(page.locator("#workout-record")).toBeHidden();
  await page.reload();
  await expect(page.locator('#view-today [data-id="goblet"] .last-entry')).toContainText("27.5 kg · 10, 10, 9 reps / set · Moderate");
  await expect(page.getByRole("button", { name:"Mark Goblet squat, heels elevated done", exact:true })).toHaveAttribute("aria-pressed","true");
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(page.locator(".history-entry")).toHaveCount(2);
  await expect(page.locator(".history-entry").first()).toContainText("Controlled lowering");
  await page.getByRole("button", { name:"Edit today's entry", exact:true }).click();
  await page.locator('#record-form [name="reps"]').fill("10, 10, 10");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  await expect(page.locator(".history-entry")).toHaveCount(2);
  await expect(page.locator(".history-entry").first()).toContainText("10, 10, 10 reps / set");
  const tomorrow = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate()+1); return d.getTime(); });
  await page.clock.setFixedTime(new Date(tomorrow));
  await page.reload();
  await page.locator('#view-today [data-record="goblet"]').click();
  await expect(page.locator('#record-form [name="weight"]')).toHaveValue("27.5");
  await expect(page.locator('#record-form [name="unit"]')).toHaveValue("kg");
  await expect(page.locator('#record-form [name="reps"]')).toHaveValue("");
  await expect(page.locator('#record-form [name="complete"]')).not.toBeChecked();
  await expect(page.locator(".previous-entry")).toContainText("Controlled lowering");
});

test("invalid completed amounts cannot be saved and cancel preserves the existing entry", async ({ page }) => {
  await openApp(page);
  await page.locator('#view-today [data-record="goblet"]').click();
  await page.locator('#record-form [name="reps"]').fill("10, -3");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  await expect(page.locator("#record-error")).toContainText("whole numbers");
  await page.getByRole("button", { name:"Cancel", exact:true }).click();
  expect(await page.evaluate(() => dayLog().training?.goblet ?? null)).toBeNull();
});

test("recording during guidance pauses and restores the prior playback state", async ({ page }) => {
  await openApp(page);
  await page.locator('[data-g="start"]').click();
  await page.getByRole("button", { name:"Record exercise", exact:true }).click();
  expect(await page.evaluate(() => G.paused)).toBe(true);
  await page.locator('#record-form [name="reps"]').fill("2.5");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  await expect.poll(() => page.evaluate(() => G.paused)).toBe(false);
  await expect(page.locator("#gPrevious")).toContainText("2.5 min");
  expect(await page.evaluate(() => dayLog().done)).not.toContain("walk");
  await page.locator('[data-g="play"]').click();
  await page.getByRole("button", { name:"Record exercise", exact:true }).click();
  await page.getByRole("button", { name:"Cancel", exact:true }).click();
  expect(await page.evaluate(() => G.paused)).toBe(true);
});

test("a failed local save is reported rather than claiming persistence", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); }; });
  await page.locator('#view-today [data-record="goblet"]').click();
  await page.locator('#record-form [name="reps"]').fill("8, 8");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  await expect(page.locator("#saveStatus")).toContainText("only kept until this page closes");
  await expect(page.locator("#saveStatus")).not.toContainText("Saved today");
});

test("record form fits a phone viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:844 });
  await openApp(page, { training:true });
  await page.locator('#view-today [data-record="goblet"]').click();
  const box = await page.locator("#workout-record").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name:"Save entry", exact:true })).toBeVisible();
  await page.locator("#workout-record").screenshot({ path:testInfo.outputPath("record-phone.png") });
});

test("a weight left blank today stays blank when the entry is edited", async ({ page }) => {
  await openApp(page, { training:true }); // yesterday's goblet entry has 25 lb
  await page.locator('#view-today [data-record="goblet"]').click();
  await page.locator('#record-form [name="weight"]').fill("");
  await page.locator('#record-form [name="reps"]').fill("8, 8");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  await page.locator('#view-today [data-record="goblet"]').click();
  await expect(page.locator('#record-form [name="weight"]')).toHaveValue("");
  await page.locator('#record-form [name="notes"]').fill("Bodyweight only today.");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  expect(await page.evaluate(() => dayLog().training.goblet.weight)).toBeNull();
});

test("walks and holds have no weight field and save without one", async ({ page }) => {
  await openApp(page);
  await page.locator('#view-today [data-record="walk"]').click();
  await expect(page.locator('#record-form [name="weight"]')).toHaveCount(0);
  await expect(page.locator('#record-form [name="unit"]')).toHaveCount(0);
  await page.locator('#record-form [name="reps"]').fill("12");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  expect(await page.evaluate(() => dayLog().training.walk)).toMatchObject({ weight:null, unit:"lb", reps:"12" });
  await expect(page.locator('#view-today [data-id="walk"] .last-entry')).toHaveText("Today: 12 min");
});

test("an exercise stopped by mistake can be put back", async ({ page }) => {
  await openApp(page);
  await page.locator('[data-g="start"]').click();
  await page.getByRole("button", { name:"Symptoms going down the leg", exact:true }).click();
  await expect(page.locator('#view-today [data-id="walk"]')).toHaveCount(0);
  await expect(page.locator(".stopped")).toContainText("Walk");
  await page.getByRole("button", { name:"Put back", exact:true }).click();
  await expect(page.locator(".stopped")).toHaveCount(0);
  await expect(page.locator('#view-today [data-id="walk"]')).toBeVisible();
  expect(await page.evaluate(() => dayLog().skipped)).toEqual([]);
  // The check-in is separate: the day stays reduced until it is changed too.
  expect(await page.evaluate(() => sessionIds())).toEqual(["walk","curl","bird","glide"]);
  await page.getByRole("button", { name:"None", exact:true }).click();
  await expect(page.locator('#view-today [data-id="goblet"]')).toBeVisible();
});

test("a completed reduced day counts as a full day, and a stopped exercise is not required", async ({ page }) => {
  await openApp(page, { symptoms:["leg"] });
  await page.evaluate(() => { dayLog().done = ["walk","curl","bird","glide"]; save(); renderProgress(); });
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(page.locator(".day.today")).toHaveClass(/\bfull\b/);
  await expect(page.locator(".stat b").first()).toHaveText("1");

  await page.evaluate(() => { const L = dayLog(); L.done = ["curl","bird","glide"]; L.skipped = ["walk"]; save(); renderProgress(); });
  await expect(page.locator(".day.today")).toHaveClass(/\bfull\b/);
  await page.evaluate(() => { const L = dayLog(); L.done = ["curl"]; save(); renderProgress(); });
  await expect(page.locator(".day.today")).toHaveClass(/\bpart\b/);
  // Stopping every exercise is not a completed day.
  await page.evaluate(() => { const L = dayLog(); L.done = []; L.skipped = ["walk","curl","bird","glide"]; save(); renderProgress(); });
  await expect(page.locator(".day.today")).not.toHaveClass(/\bfull\b/);
});

test("the symptom count shows through yesterday until today's check-in", async ({ page }) => {
  await openApp(page, { symptoms:["missing", ...Array(25).fill("none")] });
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  const history = page.locator("#symptom-history");
  await expect(history).toContainText("25 consecutive daily check-ins");
  await expect(history).toContainText("through yesterday");
  await expect(history).toContainText("three weeks or more");
  await expect(history).toContainText("No check-in yet today");
  await page.getByRole("tab", { name:"Today", exact:true }).click();
  await page.getByRole("button", { name:"Back or buttock only", exact:true }).click();
  await page.getByRole("tab", { name:"Progress", exact:true }).click();
  await expect(history).toContainText("26 consecutive daily check-ins");
  await expect(history).toContainText("through today");
});
