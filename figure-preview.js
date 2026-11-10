/* Standalone visual review. Does not initialize or write workout progress. */
"use strict";
document.title = "Sci-Op · Human figure study";
document.body.innerHTML = `
  <main class="figure-study">
    <header><span class="eyebrow">SCI-OP / MOVEMENT STUDY</span><h1>A more human demonstrator.</h1>
    <p>Compare body shape and exercise positions. Poses are illustrative and have not been clinically validated.</p></header>
    <div class="study-controls">
      <label>Exercise<select id="study-ex">${Object.entries(EX).map(([id,e])=>`<option value="${id}">${e.name}</option>`).join("")}</select></label>
      <div><span class="control-label">Figure</span><div class="segctl"><a id="human-link">Human study</a><a id="original-link">Original</a></div></div>
    </div>
    <div id="study-stage" class="stage"></div>
    <div class="v3row"><button id="study-play" class="round" aria-label="Pause">${PAUSE_SVG}</button><input id="study-scrub" type="range" min="0" max="1000" value="0" aria-label="Movement position"><button id="study-slow" class="chipbtn" aria-pressed="false">Slow</button><button id="study-mirror" class="chipbtn" aria-pressed="false">Other side</button></div>
    <div id="study-views" class="segctl" role="group" aria-label="Viewing angle">${["angle","side","front","top"].map((v,i)=>`<button data-v3view="${v}" aria-pressed="${!i}">${["3/4","Side","Front","Top"][i]}</button>`).join("")}</div>
    <p id="study-status" role="status">Loading figure…</p><ul id="study-cues" class="cues"></ul>
    <footer>Human study: MakeHuman/MPFB base, adapted by Innerscene (CC0). Matte surface and training shorts are illustrative. <a href="index.html">Back to workouts</a>
    <details><summary>Preview diagnostics</summary><button id="study-check" class="chipbtn">Check all exercise poses</button><p id="study-check-result" role="status"></p>
    <label>Visual review group<select id="study-group"><option value="0">1 · Walk, curl-up, side plank, bird dog</option><option value="1">2 · Glide, calf, balance, bridge</option><option value="2">3 · Dead bug, pull-apart, squat, row</option><option value="3">4 · Hinge, lateral walk, RDL, split squat</option><option value="4">5 · Press, single-leg bridge, full plank, mini squat</option></select></label><button id="study-sheet" class="chipbtn">Show start / middle / end</button><div id="study-gallery"></div></details></footer>
  </main>`;
const studyStyle = document.createElement("style");
studyStyle.textContent = `body{background:#101318;color:#f1f0eb}.figure-study{max-width:1000px;margin:auto;padding:32px 24px 48px}.eyebrow{font-size:11px;letter-spacing:.19em;color:#cfb694}header h1{font-size:clamp(25px,4vw,38px);margin:8px 0}header p,footer{color:#a8afb9;font-size:14px;max-width:720px}.study-controls{display:flex;gap:24px;align-items:end;margin:24px 0 16px}.study-controls label{flex:1}.study-controls label,.control-label{display:block;font-size:12px;color:#a8afb9}.study-controls select{display:block;background:#232930;color:#f1f0eb;border:1px solid #424a55;padding:12px;border-radius:10px;width:100%;margin-top:7px;font:inherit;font-size:15px}.segctl a{padding:12px;color:#a8afb9;text-decoration:none;font-size:13px;border-radius:8px}.segctl a[aria-current=page]{background:#cfb694;color:#15181c}.control-label{margin-bottom:7px}#study-stage{height:clamp(300px,55vh,620px);background:radial-gradient(ellipse at 50% 28%,#424a53,#1b222b 75%);border:1px solid #363f4a;border-radius:18px}#study-stage canvas{width:100%!important;height:100%!important}#study-status{color:#cfb694;font-size:13px;margin:16px 0 0}footer{border-top:1px solid #323b46;margin-top:24px;padding-top:16px}footer a{color:#cfb694}.v3row{margin:12px 0}.chipbtn{white-space:nowrap}@media(max-width:560px){.figure-study{padding:20px 16px}.study-controls{gap:12px;flex-wrap:wrap}.study-controls label{min-width:100%}}`;
document.head.appendChild(studyStyle);
studyStyle.textContent += `#study-gallery{margin-top:16px}#study-gallery section{margin:16px 0}#study-gallery h3{font-size:14px;margin:8px 0}#study-gallery .poses{display:grid;grid-template-columns:repeat(3,1fr);background:#272f39}#study-gallery img{width:100%;display:block}#study-group{background:#252d36;color:#eee;padding:8px;margin:10px}#study-gallery .pose-caption{display:flex;justify-content:space-around;font-size:11px;color:#bfc6cd}`;
const studyParams = new URLSearchParams(location.search);
const studySelect = document.getElementById("study-ex");
studySelect.value = Object.hasOwn(EX,studyParams.get("exercise")) ? studyParams.get("exercise") : "goblet";
const studyUi = {play:document.getElementById("study-play"), slow:document.getElementById("study-slow"), scrub:document.getElementById("study-scrub"), views:[...document.querySelectorAll("#study-views button")]};
let studyMirror = false;
function updateStudyLinks(){
  for(const kind of ["human","original"]){
    const url = new URL(location.href); url.searchParams.set("figure",kind); url.searchParams.set("exercise",studySelect.value);
    const a = document.getElementById(kind+"-link"); a.href = url.href;
    if((studyParams.get("figure") === "original" ? "original" : "human") === kind) a.setAttribute("aria-current","page");
  }
}
function mountStudy(){
  V3.mount(document.getElementById("study-stage"),studySelect.value,studyMirror,studyUi);
  document.getElementById("study-cues").innerHTML = EX[studySelect.value].cues.map(c=>`<li>${c}</li>`).join("");
  document.getElementById("study-status").textContent = !V3.is3D ? "3D unavailable — showing original pre-rendered demonstration." : V3.figure === "human" ? "Human study · 53-bone body rig · illustrative movement" : "Original figure" + (studyParams.get("figure") !== "original" ? " · human asset unavailable; showing fallback" : "");
  updateStudyLinks();
}
studySelect.onchange = ()=>{ if(V3?.loaded) mountStudy(); };
studyUi.play.onclick = ()=>V3.togglePlay();
studyUi.slow.onclick = ()=>V3.toggleSlow();
studyUi.scrub.oninput = ()=>V3.scrub(+studyUi.scrub.value);
studyUi.views.forEach(b=>b.onclick = e=>{ e.stopPropagation(); V3.view(b.dataset.v3view); });
document.getElementById("study-mirror").onclick = e=>{ studyMirror = !studyMirror; e.currentTarget.setAttribute("aria-pressed",studyMirror); mountStudy(); };
updateStudyLinks();
document.getElementById("study-sheet").onclick = ()=>{
  const start = Number(document.getElementById("study-group").value)*4;
  document.getElementById("study-gallery").innerHTML = Object.keys(EX).slice(start,start+4).map(id=>`<section><h3>${EX[id].name}</h3><div class="poses">${V3.frames(id,3,320,220,studyMirror).map((src,i)=>`<img src="${src}" alt="${EX[id].name}: ${["start","middle","end"][i]}">`).join("")}</div><div class="pose-caption"><span>Start</span><span>Middle</span><span>End</span></div></section>`).join("");
  mountStudy();
};
document.getElementById("study-check").onclick = ()=>{
  const report = V3?.auditPoses?.();
  document.getElementById("study-check-result").textContent = !report || report.error ? "3D figure is not ready." : `${report.exercises} exercises, ${report.samples} pose samples including both sides; ${report.supportSamples || 0} bird-dog support samples across reach and breathing: ${report.errors.length ? report.errors.join("; ") : "passed"}. Checks finite transforms${report.figure === "human" ? ", joint continuity, planted contacts, support elbow direction, palm orientation and fingertip height" : ""}; not clinical validation.`;
};
if(V3) V3.onReady(mountStudy);
else document.getElementById("study-status").textContent = "This browser cannot display the figure.";
