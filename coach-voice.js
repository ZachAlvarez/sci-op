/* Generated speech is served with the app; no account or live TTS service needed. */
"use strict";
const COACH_LINES = Object.freeze({
  preview: "Hey, you. Stoked you're here. Let's get into it. Keep it smooth. Yeah, there you go. One more. Okay, you're kinda making this my favorite part of the day.",
  resume: "Alright, let's get back into it.",
  done: "And that's a wrap. Stoked you showed up. Kinda looking forward to our next round.",
  stop: "Session stopped. Skip anything that sends symptoms down the leg.",
  today: "Hey, you. Stoked you're back. Here's today's plan. Check in with your symptoms, then let's get into it.",
  program: "Let's set you up. Your phase, strength days, and exercises are all here.",
  progress: "Here's your progress. Every session you record gives you something to build on.",
  rules: "Quick ground rules. Keep it controlled, and stop any movement that sends symptoms farther down your leg.",
  saved: "Entry saved on this device. Nice. That's something to build on next time.",
  checked: "Got it. One more checked off. I like that energy.",
  milestone: "Milestone checked. Look at you, putting in the work.",
  phase1: "Phase one. Let's build that foundation, one good rep at a time.",
  phase2: "Phase two selected. Check the readiness milestones before adding load.",
  schedule: "Strength days updated. Let's find a rhythm that works for you.",
  reduced: "Thanks for checking in. Today's plan is reduced. Skip anything that makes symptoms spread farther down the leg.",
  checkin: "Check-in recorded. Keep paying attention to how things feel as you move.",
  timerStart: "Get comfortable. Your hold starts now.",
  timerRest: "And relax. Five seconds to reset.",
  timerNext: "Alright, next hold. Keep breathing.",
  timerDone: "That's your last hold. Nice work. Take a breath.",
  cameraDone: "Camera session ended. Your summary is ready.",
  cameraSetup: "Here's the camera coach. Choose your exercise and check the setup before you start."
});

class CoachVoice {
  constructor(clips = {}) {
    this.clips = clips;
    this.cache = new Map();
    this.on = true;
    this.navigation = true;
    try { this.on = localStorage.getItem("sci-op-coach-muted") !== "true"; } catch {}
    try { this.navigation = localStorage.getItem("sci-op-coach-navigation") !== "false"; } catch {}
    this.lastEnd = 0;
    this.serial = 0;
    this.active = false;
    this.previewing = false;
    this.status = "American male · AI voice";
    this.onchange = () => {};
  }
  setEnabled(on) {
    this.on = on;
    if (!on) this.cancel();
    try { localStorage.setItem("sci-op-coach-muted", String(!on)); } catch {}
    this.onchange();
  }
  setNavigation(on) {
    this.navigation = on;
    this.cancel();
    try { localStorage.setItem("sci-op-coach-navigation", String(on)); } catch {}
    this.onchange();
  }
  unlock() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    try {
      this.context ||= new Context();
      // Called directly from Start/Resume/Preview, including on iOS.
      if (this.context.state !== "running") this.context.resume().catch(() => {});
    } catch {}
  }
  async load(text) {
    const clip = this.clips[text];
    if (!clip || !this.context) throw new Error("No coach clip");
    if (this.cache.has(text)) return this.cache.get(text);
    const task = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(clip.file, { signal: controller.signal });
        if (!response.ok) throw new Error("Coach clip unavailable");
        return await this.context.decodeAudioData(await response.arrayBuffer());
      } finally { clearTimeout(timer); }
    })();
    this.cache.set(text, task);
    // Keep a small working set of decoded audio, not the whole voice pack.
    if (this.cache.size > 48) this.cache.delete(this.cache.keys().next().value);
    task.catch(() => { if (this.cache.get(text) === task) this.cache.delete(text); });
    return task;
  }
  preload(texts) {
    if (!this.on || !this.context) return;
    [...new Set(texts)].forEach(text => this.load(text).catch(() => {}));
  }
  cancel() {
    ++this.serial;
    clearTimeout(this.timer);
    if (this.source) {
      this.source.onended = null;
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    window.speechSynthesis?.cancel();
    this.active = false;
    this.previewing = false;
    this.lastEnd = performance.now();
    this.onchange();
  }
  speaking() { return this.active; }
  finish(token) {
    if (token !== this.serial) return;
    clearTimeout(this.timer);
    this.source?.disconnect();
    this.source = null;
    this.active = false;
    this.previewing = false;
    this.lastEnd = performance.now();
    this.onchange();
  }
  async say(text, opts = {}) {
    if ((!this.on && !opts.preview) || !text) return;
    // Let form guidance finish instead of chopping a sentence for a rep count.
    // The visual count remains authoritative; a skipped count is never replayed.
    if (opts.timed && /^\d+$/.test(text) && this.active && !this.counting) return;
    // A count belongs to this moment. Never queue stale cues behind speech.
    this.cancel();
    const token = this.serial;
    this.active = true;
    this.counting = /^\d+$/.test(text);
    this.previewing = !!opts.preview;
    this.onchange();
    const started = performance.now();
    this.timer = setTimeout(() => this.cancel(), 9000);
    try {
      const buffer = await this.load(text);
      if (token !== this.serial) return;
      if (opts.timed && performance.now() - started > 1000) return this.finish(token);
      if (this.context.state !== "running") throw new Error("Audio needs a tap");
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.onended = () => this.finish(token);
      this.source = source;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cancel(), (buffer.duration + 2) * 1000);
      this.status = "American male · AI voice";
      this.onchange();
      source.start();
    } catch {
      if (token !== this.serial) return;
      if (opts.timed && performance.now() - started > 1000) return this.finish(token);
      this.fallback(text, token);
    }
  }
  fallback(text, token) {
    const synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) {
      this.status = "Audio unavailable. Follow the on-screen cues.";
      this.finish(token);
      return;
    }
    const voices = synth.getVoices().filter(v => /^en/i.test(v.lang));
    const preferred = ["Guy", "Christopher", "David", "Mark", "Alex", "Daniel"];
    const voice = preferred.map(name => voices.find(v => v.name.includes(name))).find(Boolean)
      || voices.find(v => /^en[-_]US/i.test(v.lang)) || voices[0];
    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) utterance.voice = voice;
    utterance.lang = "en-US";
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.onend = utterance.onerror = () => this.finish(token);
    this.status = "Device voice — coach audio unavailable.";
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.cancel(), Math.max(6000, text.length * 110));
    this.onchange();
    synth.speak(utterance);
  }
}
