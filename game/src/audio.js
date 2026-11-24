// Del Sol City — audio.js
// Every sound is synthesized with WebAudio; the game ships no audio files.
// Engine hum and the police siren are continuous nodes whose pitch/gain the
// vehicle and police systems steer each frame; gunshots, pickups and UI blips
// are one-shot envelopes. A small step sequencer loops a warm synthwave pad
// progression as ambient music. Audio starts on the first user gesture.

var AudioSys = {
  ctx: null,
  master: null,
  engineOsc: null, engineGain: null, engineFilter: null,
  sirenOsc: null, sirenGain: null, sirenTimer: 0, sirenHigh: false,
  musicTimer: null, musicStep: 0,

  init: function () {
    if (this.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = G.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    // Engine: a detuned saw pair through a lowpass, gain follows throttle.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    var engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'square';
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    engineOsc2.start();
    this.engineOsc2 = engineOsc2;

    // Siren: one triangle osc whose frequency the police system flips.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();

    this.startMusic();
  },

  resume: function () { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },

  setMuted: function (m) { if (this.master) this.master.gain.value = m ? 0 : 0.55; },

  // Called every frame by the vehicle system: speed 0..1, throttle on/off.
  engine: function (speed01, throttle) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var f = 55 + speed01 * 165 + (throttle ? 12 : 0);
    this.engineOsc.frequency.setTargetAtTime(f, t, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5 + 2, t, 0.06);
    this.engineFilter.frequency.setTargetAtTime(300 + speed01 * 1400, t, 0.08);
    this.engineGain.gain.setTargetAtTime(G.mode === 'car' ? 0.05 + speed01 * 0.075 : 0, t, 0.09);
  },

  // Called every frame by the police system with the nearest cop distance.
  siren: function (nearestDist) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var vol = 0;
    if (nearestDist < 90 && G.wantedStars > 0) vol = clamp(0.085 * (1 - nearestDist / 95), 0, 0.085);
    this.sirenGain.gain.setTargetAtTime(vol, t, 0.1);
    if (vol > 0.004) {
      this.sirenTimer -= 1 / 60;
      if (this.sirenTimer <= 0) { this.sirenHigh = !this.sirenHigh; this.sirenTimer = 0.42; }
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 960 : 690, t, 0.03);
    }
  },

  blip: function (freq, dur, type, vol, when) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime + (when || 0);
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  gunshot: function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    var len = Math.floor(this.ctx.sampleRate * 0.16);
    var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    var src = this.ctx.createBufferSource(); src.buffer = buf;
    var f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    var g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    this.blip(120, 0.09, 'sine', 0.25);
  },

  hit: function () { this.blip(180, 0.08, 'sawtooth', 0.1); },
  pickup: function () { this.blip(660, 0.09, 'square', 0.12); this.blip(990, 0.14, 'square', 0.12, 0.08); },
  cash: function () { this.blip(880, 0.08, 'square', 0.1); this.blip(1174, 0.08, 'square', 0.1, 0.07); this.blip(1568, 0.16, 'square', 0.1, 0.14); },
  fail: function () { this.blip(220, 0.2, 'sawtooth', 0.12); this.blip(155, 0.3, 'sawtooth', 0.12, 0.16); },
  bustedJingle: function () { this.blip(392, 0.16, 'triangle', 0.14); this.blip(330, 0.16, 'triangle', 0.14, 0.15); this.blip(262, 0.34, 'triangle', 0.14, 0.3); },

  // Ambient music: a slow Am–F–C–G pad loop with a soft bass pulse, scheduled
  // one bar at a time so it can run forever without audio assets.
  startMusic: function () {
    if (!this.ctx || this.musicTimer) return;
    var chords = [[110, 220, 261.6, 329.6], [87.3, 174.6, 220, 261.6], [130.8, 196, 261.6, 329.6], [98, 196, 246.9, 293.7]];
    var self = this;
    var playBar = function () {
      if (!self.ctx) return;
      var ch = chords[self.musicStep % chords.length];
      self.musicStep++;
      var t = self.ctx.currentTime;
      for (var i = 1; i < ch.length; i++) {
        var o = self.ctx.createOscillator(), g = self.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = ch[i];
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t + 3.9);
        o.connect(g); g.connect(self.master);
        o.start(t); o.stop(t + 4);
      }
      var b = self.ctx.createOscillator(), bg = self.ctx.createGain();
      b.type = 'sine'; b.frequency.value = ch[0];
      bg.gain.setValueAtTime(0.05, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      b.connect(bg); bg.connect(self.master);
      b.start(t); b.stop(t + 2);
    };
    playBar();
    this.musicTimer = setInterval(playBar, 4000);
  },
};
