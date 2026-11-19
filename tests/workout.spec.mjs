import { test, expect } from "@playwright/test";

// Strength days alternate lower and upper body. Tests pin today to the lower
// body unless they pass focus: null to exercise the alternation itself.
async function openApp(page, { symptoms = [], training = false, focus = "lower" } = {}) {
  await page.addInitScript(({ symptoms, training, focus }) => {
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
    if (focus) { log[date(0)] ||= { done: [], sym: null, extra: false }; log[date(0)].focus = focus; }
    localStorage.setItem(key, JSON.stringify({ phase:1, strengthDays:[0,1,2,3,4,5,6], log, milestones:{}, updated:1 }));
  }, { symptoms, training, focus });
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
  // After today's lower-body work, tomorrow defaults to the upper body.
  await page.getByRole("button", { name:"Switch to glutes and legs", exact:true }).click();
  await page.locator('#view-today [data-record="goblet"]').click();
  await expect(page.locator('#record-form [name="weight"]')).toHaveValue("27.5");
  await expect(page.locator('#record-form [name="unit"]')).toHaveValue("kg");
  await expect(page.locator('#record-form [name="reps"]')).toHaveValue("");
  // A new day starts a new entry: completion does not carry over, but saving
  // a new entry marks it complete unless unchecked.
  expect(await page.evaluate(() => dayLog().done)).not.toContain("goblet");
  await expect(page.locator('#record-form [name="complete"]')).toBeChecked();
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
  expect(await page.evaluate(() => dayLog().done)).toContain("walk"); // a new record defaults to complete
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

test("every exercise links to a video of a person doing it", async ({ page }) => {
  await openApp(page);
  const table = await page.evaluate(() => ({ videos: VIDEOS, exercises: Object.keys(EX) }));
  expect(Object.keys(table.videos).sort()).toEqual([...table.exercises].sort());
  for (const [id, channel] of Object.values(table.videos)) {
    expect(id).toMatch(/^[\w-]{11}$/); // YouTube video ids are 11 characters
    expect(channel.length).toBeGreaterThan(0);
  }

  await page.locator('#view-today .exmain[data-open="t-bird"]').click();
  const link = page.locator('#view-today [data-id="bird"] .video-link');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", `https://www.youtube.com/watch?v=${table.videos.bird[0]}`);
  await expect(link).toHaveAttribute("target", "_blank"); // opens outside the app, so progress is not lost
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toContainText(table.videos.bird[1]);

  await page.getByRole("tab", { name:"Program", exact:true }).click();
  expect(await page.locator("#view-program .video-link").count()).toBe(await page.locator("#view-program .ex").count());
});

test("the slackboard has a hold timer that names the foot", async ({ page }) => {
  await page.clock.install();
  await openApp(page);
  await page.locator('#view-today .exmain[data-open="t-slack"]').click();
  // Stop the 3D render loop; otherwise fast-forwarding the clock renders every frame.
  await page.evaluate(() => V3.release());
  const timer = page.locator('[data-key="t-slack"] [data-timer]');
  await expect(timer).toHaveText("Start 30-second hold timer");
  await timer.click();
  await expect(timer).toContainText("Hold 30 s, rep 1 of 6, right foot");
  await page.clock.runFor(3 * 30_000 + 2 * 5_000);   // holds 1–3 on the right, with two short rests
  await expect(timer).toContainText("Rest 10 s, then switch to left foot, rep 4 of 6");
  await page.clock.runFor(10_000);
  await expect(timer).toContainText("Hold 30 s, rep 4 of 6, left foot");
  await timer.click(); // stop
  await expect(timer).toHaveText("Start 30-second hold timer");
});

test("saving a new record marks the exercise complete unless unchecked", async ({ page }) => {
  await openApp(page);
  await page.locator('#view-today [data-record="goblet"]').click();
  await expect(page.locator('#record-form [name="complete"]')).toBeChecked();
  await page.locator('#record-form [name="reps"]').fill("10, 10");
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  expect(await page.evaluate(() => dayLog().done)).toContain("goblet");

  await page.locator('#view-today [data-record="hinge"]').click();
  await page.locator('#record-form [name="reps"]').fill("8, 8");
  await page.locator('#record-form [name="complete"]').uncheck();
  await page.getByRole("button", { name:"Save entry", exact:true }).click();
  expect(await page.evaluate(() => dayLog().done)).not.toContain("hinge");
});

test("finishing the workout saves what was done and marks the rest skipped", async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await openApp(page);
  // Older records saved before completion defaulted on: recorded but not checked off.
  await page.evaluate(() => {
    const L = dayLog(); L.done = ["walk"];
    L.training = { curl:{weight:null,unit:"lb",reps:"10, 10",difficulty:"",notes:"",updated:1} };
    save(); renderToday();
  });
  await expect(page.locator(".hero [data-finish]")).toBeVisible(); // shortcut appears once something is done
  await page.locator("#view-today .finish [data-finish]").click();
  const form = page.locator("#finish-form");
  await expect(form.locator('[value="walk"]')).toBeChecked();
  await expect(form.locator('[value="curl"]')).toBeChecked();  // recorded counts as done
  await expect(form.locator('[value="bird"]')).not.toBeChecked();
  await form.locator('[value="bird"]').check();
  await form.locator('[value="walk"]').uncheck();
  await form.getByRole("button", { name:"Save workout", exact:true }).click();

  await expect(page.locator("#workout-record")).toBeHidden();
  await expect(page.locator("#saveStatus")).toContainText("Workout saved: 2 of");
  await expect(page.locator("#view-today .finish")).toContainText("Workout saved at");
  await expect(page.locator(".hero [data-finish]")).toHaveCount(0);
  expect((await page.evaluate(() => dayLog().done)).sort()).toEqual(["bird","curl"]);
  expect(await page.evaluate(() => typeof dayLog().finished)).toBe("number");

  await page.reload();
  await expect(page.locator("#view-today .finish")).toContainText("2 of");
  await page.getByRole("button", { name:"Edit today's workout", exact:true }).click();
  await expect(page.locator('#finish-form [value="bird"]')).toBeChecked();
  const box = await page.locator("#workout-record").boundingBox();
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name:"Cancel", exact:true }).click();
  expect((await page.evaluate(() => dayLog().done)).sort()).toEqual(["bird","curl"]);
});

test("glute work: phase 1 adds clamshells and bridge marches, phase 2 loads the bridge and adds single-leg RDLs", async ({ page }) => {
  await openApp(page);
  const today = page.locator("#view-today");
  for (const id of ["clam", "march"]) await expect(today.locator(`.exmain[data-open="t-${id}"]`)).toBeVisible();

  await page.getByRole("tab", { name:"Program", exact:true }).click();
  await page.locator('#view-program [data-phase="2"]').click();
  const plan = await page.evaluate(() => ({ p2: PROGRAM[2].lower, strength: todayPlan().strength }));
  expect(plan.p2).toContain("thrust");
  expect(plan.p2).toContain("slrdl");
  expect(plan.p2).not.toContain("bridge"); // the hip thrust is the loaded bridge
  expect(plan.strength).toEqual(plan.p2);

  const guide = await page.evaluate(() => ({
    sides:[sideName("slrdl", 1), sideName("slrdl", 2), sideName("clam", 1)],
    marchReps: buildSegs("march", 0, 1).filter(s => s.kind === "rep").map(s => s.mirror)
  }));
  expect(guide.sides).toEqual(["Standing on the right leg", "Standing on the left leg", "Right side down"]);
  expect(guide.marchReps).toHaveLength(3 * 8 * 2); // 8 lifts per side, alternating
  expect(guide.marchReps.slice(0, 4)).toEqual([false, true, false, true]);
});

test("strength days alternate lower and upper body, and today's focus can be switched", async ({ page }) => {
  await openApp(page, { focus:null }); // no history: start with the lower body
  const today = page.locator("#view-today");
  await expect(today.locator('.exmain[data-open="t-bridge"]')).toBeVisible();
  await expect(today.locator('.exmain[data-open="t-pushup"]')).toHaveCount(0);

  // Yesterday was a lower-body day, so today is the upper body.
  await page.evaluate(() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    S.log[todayKey(d)] = { done:["walk", "bridge", "goblet"], sym:null, extra:false };
    save(); renderToday();
  });
  for (const id of ["pushup", "press", "row", "bcurl", "triext"]) await expect(today.locator(`.exmain[data-open="t-${id}"]`)).toBeVisible();
  await expect(today.locator('.exmain[data-open="t-bridge"]')).toHaveCount(0);
  expect(await page.evaluate(() => sessionIds())).toContain("pushup");

  // Switching is remembered for today, survives reload, and drives the guided session.
  await today.getByRole("button", { name:"Switch to glutes and legs" }).click();
  await page.reload();
  await expect(today.locator('.exmain[data-open="t-bridge"]')).toBeVisible();
  const ids = await page.evaluate(() => sessionIds());
  expect(ids).toContain("bridge");
  expect(ids).not.toContain("pushup");

  // A day spent on the upper body makes the next strength day lower body.
  expect(await page.evaluate(() => dayFocus({ done:["pushup", "bcurl"] }))).toBe("upper");
  expect(await page.evaluate(() => dayFocus({ done:["walk", "curl"] }))).toBe(null); // daily routine only
});
