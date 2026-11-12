import { readFile, stat } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { coachCatalog } from "./coach-catalog.mjs";

const files = ["index.html", "form-coach.html"];
const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

function validateScripts(file, html) {
  let count = 0;

  for (const match of html.matchAll(scriptTag)) {
    const attributes = match[1].toLowerCase();
    const type = attributes.match(/\btype\s*=\s*["']?([^\s"'>]+)/)?.[1];
    if (type && !["module", "text/javascript", "application/javascript"].includes(type)) continue;

    let source = match[2];
    if (type === "module") {
      // This project has one CDN import. Remove imports so the remaining module
      // body can be parsed without fetching or executing browser code.
      source = source.replace(/^\s*import\s+[\s\S]*?;\s*/m, "");
    }

    try {
      new Function(source);
      count++;
    } catch (error) {
      throw new Error(`${file}: inline script ${count + 1} does not parse: ${error.message}`);
    }
  }

  if (count === 0) throw new Error(`${file}: no executable inline scripts found.`);
  return count;
}

let totalScripts = 0;
for (const file of files) {
  const html = await readFile(file, "utf8");
  totalScripts += validateScripts(file, html);
}

// The optional figure study has a standalone classic script.
new Function(await readFile("figure-preview.js", "utf8"));
new Function(await readFile("coach-voice.js", "utf8"));

const voiceContext = { window: {} };
runInNewContext(await readFile("assets/coach/manifest.js", "utf8"), voiceContext);
const phrases = await coachCatalog();
for (const phrase of phrases) {
  const clip = voiceContext.window.COACH_CLIPS[phrase.text];
  if (!clip || clip.file !== phrase.file || !(clip.duration > 0)) {
    throw new Error(`Missing or outdated coach clip: ${phrase.text}. Rebuild the voice pack.`);
  }
  if ((await stat(clip.file)).size < 256) throw new Error(`Empty coach clip: ${clip.file}`);
}

console.log(`Validated ${files.length} HTML files and ${totalScripts} executable inline scripts.`);
console.log(`Validated ${phrases.length} bundled coach phrases.`);
