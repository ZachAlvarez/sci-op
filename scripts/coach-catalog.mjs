// Extract the actual workout phrases without launching a browser or the 3D engine.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { pathToFileURL } from "node:url";

export async function coachCatalog() {
  const html = await readFile("index.html", "utf8");
  const camera = await readFile("form-coach.html", "utf8");
  const voice = await readFile("coach-voice.js", "utf8");
  const profile = JSON.parse(await readFile("assets/coach/profile.json", "utf8"));
  const section = (start, end) => {
    const a = html.indexOf(start), b = html.indexOf(end, a);
    if (a < 0 || b < a) throw new Error(`Missing voice catalog boundary: ${start}`);
    return html.slice(a, b);
  };
  const code = voice + "\n"
    + section("const P_bench =", "const HUMAN_P3 =")
    + section("const DOSE =", "const PROGRAM =")
    + section("function buildSegs(", "const G =")
    + `\n({ lines: COACH_LINES, exercises: Object.keys(DOSE).map(id => ({
      id, cues: EX[id].cues.join(" "), segments: buildSegs(id, 0, 1)
    })) });`;
  const { lines, exercises } = runInNewContext(code, {}, { timeout: 1000 });
  const phrases = new Set(Object.values(lines));
  const cameraExercises = runInNewContext(camera.slice(camera.indexOf("const EXS ="), camera.indexOf("const L =")) + "\nEXS;", {}, {timeout:1000});
  for(const ex of Object.values(cameraExercises)) phrases.add(`${ex.name}. ${ex.place}`);
  for(const match of camera.matchAll(/cue\(\s*"[^"]+",\s*"([^"]+)"/g)) phrases.add(match[1]);
  for(const match of camera.matchAll(/say\(\s*"([^"]+)"/g)) phrases.add(match[1]);
  // Camera rep counts and hold checkpoints are dynamic. Cover common sets and
  // holds through ten minutes; unusually large values retain labeled fallback.
  for(let n=1;n<=100;n++) phrases.add(String(n));
  for(let n=110;n<=600;n+=10) phrases.add(String(n));
  for (const ex of exercises) {
    phrases.add(ex.cues);
    for (const seg of ex.segments) for (const [, text] of seg.cues) phrases.add(text);
  }
  const numbers = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"];
  return [...phrases].map(text => ({
    text,
    spoken: /^\d+$/.test(text) ? (numbers[Number(text)] || text) + "." : text,
    // A changed delivery gets a new URL, so cached clips cannot retain the old voice.
    file: `assets/coach/${createHash("sha256").update(JSON.stringify(profile) + "\n" + text).digest("hex").slice(0, 16)}.mp3`
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const phrases = await coachCatalog();
  await mkdir("assets/coach", { recursive: true });
  await writeFile("assets/coach/phrases.json", JSON.stringify(phrases, null, 2) + "\n");
  console.log(`Collected ${phrases.length} unique coach phrases.`);
}
