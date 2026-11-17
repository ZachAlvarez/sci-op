// Checks that every exercise's YouTube video still exists, using YouTube's
// public oEmbed endpoint. Needs network access, so it is run by hand
// (npm run check-videos) rather than in CI.
import { readFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");
const match = html.match(/const VIDEOS = (\{[\s\S]*?\n\});/);
if (!match) throw new Error("index.html: could not find the VIDEOS table.");
const videos = JSON.parse(match[1]);

let failed = 0;
for (const [exercise, [id, channel]] of Object.entries(videos)) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`;
  let line;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const { title, author_name: author } = await res.json();
      line = `ok       ${exercise.padEnd(10)} ${author} | ${title}`;
    } else {
      // 404: removed or private. 401/403: exists but embedding is off, which is fine for a link.
      const gone = res.status === 404 || res.status === 400;
      if (gone) failed++;
      line = `${gone ? "MISSING " : "ok (" + res.status + ")"} ${exercise.padEnd(10)} ${id} (${channel})`;
    }
  } catch (error) {
    failed++;
    line = `ERROR    ${exercise.padEnd(10)} ${id}: ${error.message}`;
  }
  console.log(line);
}
if (failed) { console.error(`\n${failed} video link(s) need replacing.`); process.exit(1); }
console.log(`\nAll ${Object.keys(videos).length} video links are live.`);
