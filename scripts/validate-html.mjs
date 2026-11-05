import { readFile } from "node:fs/promises";

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

const coach = await readFile("form-coach.html", "utf8");
if (!coach.includes("thisSession !== sessionId") || !coach.includes('window.addEventListener("pagehide", stop)')) {
  throw new Error("form-coach.html: startup cancellation and camera cleanup checks are missing.");
}

console.log(`Validated ${files.length} HTML files and ${totalScripts} executable inline scripts.`);
