// Del Sol City — hud.js
// Everything the player reads: health bar, cash, wanted stars, the objective
// line and mission timer, dialogue subtitles, mission banners, the busted
// progress ring, damage flashes, context prompts ("Press E") and the
// 2D-canvas minimap with roads, the player arrow, the objective blip, police
// and traffic.

var HUD = {
  els: {},
  mapCtx: null,
  mapSize: 188,
  damageT: 0,

  init: function () {
    var ids = ['healthFill', 'cash', 'stars', 'objective', 'timer', 'dialogue', 'dialogueWho',
      'dialogueText', 'banner', 'bannerTitle', 'bannerSub', 'prompt', 'bustedWrap', 'bustedFill',
      'damage', 'minimap', 'note'];
    for (var i = 0; i < ids.length; i++) this.els[ids[i]] = document.getElementById(ids[i]);
    this.mapCtx = this.els.minimap.getContext('2d');
    this.renderCash();
    this.renderStars();
  },

  renderCash: function () { if (this.els.cash) this.els.cash.textContent = '$' + G.cash.toLocaleString('en-US'); },

  renderStars: function () {
    if (!this.els.stars) return;
    var s = '';
    for (var i = 0; i < 5; i++) s += i < G.wantedStars ? '★' : '☆';
    this.els.stars.textContent = s;
    this.els.stars.style.opacity = G.wantedStars > 0 ? '1' : '0.25';
  },

  setObjective: function (text) { if (this.els.objective) this.els.objective.textContent = text; },
  setObjectiveNote: function (text) {
    if (!this.els.note) return;
    this.els.note.textContent = text;
    this.els.note.style.opacity = '1';
    var self = this;
    setTimeout(function () { self.els.note.style.opacity = '0'; }, 2600);
  },

  setTimer: function (seconds) {
    if (!this.els.timer) return;
    if (seconds === null || seconds === undefined) { this.els.timer.style.display = 'none'; return; }
    this.els.timer.style.display = 'block';
    var s = Math.max(0, Math.ceil(seconds));
    this.els.timer.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    this.els.timer.style.color = seconds < 15 ? '#ff5a4d' : '#ffd76a';
  },

  showDialogue: function (who, text) {
    this.els.dialogueWho.textContent = who;
    this.els.dialogueText.textContent = text;
    this.els.dialogue.style.display = 'block';
  },
  hideDialogue: function () { if (this.els.dialogue) this.els.dialogue.style.display = 'none'; },

  showBanner: function (title, sub) {
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub || '';
    this.els.banner.style.display = 'block';
    this.els.banner.style.opacity = '1';
    var self = this;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(function () { self.els.banner.style.opacity = '0'; }, 2800);
    setTimeout(function () { self.els.banner.style.display = 'none'; }, 3400);
  },

  setPrompt: function (text) {
    if (!this.els.prompt) return;
    if (text) { this.els.prompt.textContent = text; this.els.prompt.style.display = 'block'; }
    else this.els.prompt.style.display = 'none';
  },

  renderBusted: function (frac) {
    if (!this.els.bustedWrap) return;
    this.els.bustedWrap.style.display = frac > 0.02 ? 'block' : 'none';
    this.els.bustedFill.style.width = Math.round(frac * 100) + '%';
  },

  flashDamage: function () {
    if (!this.els.damage) return;
    this.els.damage.style.opacity = '0.5';
    this.damageT = 0.25;
  },

  showEndScreen: function (kind) {
    var el = document.getElementById('endscreen');
    document.getElementById('endTitle').textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    document.getElementById('endTitle').style.color = kind === 'busted' ? '#6db3ff' : '#ff5a4d';
    document.getElementById('endSub').textContent = kind === 'busted'
      ? 'The Del Sol PD caught up with Mara. Bail costs $150.'
      : 'Mara wakes up at the marina clinic. The visit costs $100.';
    el.style.display = 'flex';
  },
  hideEndScreen: function () { document.getElementById('endscreen').style.display = 'none'; },

  update: function (dt) {
    if (this.els.healthFill) {
      var f = clamp(G.health / CFG.PLAYER_MAX_HEALTH, 0, 1);
      this.els.healthFill.style.width = (f * 100) + '%';
      this.els.healthFill.style.background = f > 0.5 ? '#53d769' : (f > 0.25 ? '#f0a832' : '#ff5a4d');
    }
    if (this.damageT > 0) {
      this.damageT -= dt;
      if (this.damageT <= 0 && this.els.damage) this.els.damage.style.opacity = '0';
    }
    // Context prompt: near a car on foot, or stopped in one.
    if (G.mode === 'foot') {
      var car = Player.nearestCar(4.2);
      this.setPrompt(car ? 'Press E to ' + (car.parked ? 'take the car' : 'steal the car') : null);
    } else if (G.mode === 'car') {
      this.setPrompt(Math.abs(G.currentCar.speed) < 3 ? 'Press E to get out' : null);
    } else this.setPrompt(null);
    this.drawMinimap();
  },

  // World (x -235..455, z -235..235) squeezed onto the square map at one
  // uniform scale, centred vertically.
  mapXY: function (x, z) {
    var s = this.mapSize, k = s / 690;
    return [ (x + 235) * k, (z + 235) * k + (s - 470 * k) / 2 ];
  },

  drawMinimap: function () {
    var ctx = this.mapCtx;
    if (!ctx) return;
    var s = this.mapSize;
    ctx.clearRect(0, 0, s, s);
    // Land, sea and beach.
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(0, 0, s, s);
    var seaX = (CFG.WATER_X + 235) / 690 * s;
    ctx.fillStyle = '#1d6f8e';
    ctx.fillRect(seaX, 0, s - seaX, s);
    ctx.fillStyle = '#d9c084';
    ctx.fillRect((CFG.BEACH_X + 235) / 690 * s, 0, seaX - (CFG.BEACH_X + 235) / 690 * s, s);
    // Roads.
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 2;
    var i, a, b;
    for (i = 0; i < CFG.ROADS.length; i++) {
      a = this.mapXY(CFG.ROADS[i], -230); b = this.mapXY(CFG.ROADS[i], 230);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      a = this.mapXY(-230, CFG.ROADS[i]); b = this.mapXY(430, CFG.ROADS[i]);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#c9ced6';
    for (i = 0; i < G.cars.length; i++) {
      var cp = G.cars[i].group.position, mp = this.mapXY(cp.x, cp.z);
      ctx.fillRect(mp[0] - 1, mp[1] - 1, 2, 2);
    }
    // Police blips, flashing.
    var flash = Math.floor(G.elapsed * 2.4) % 2 === 0;
    for (i = 0; i < G.cops.length; i++) {
      var pp = G.cops[i].car.group.position, pm = this.mapXY(pp.x, pp.z);
      ctx.fillStyle = flash ? '#ff4040' : '#4d7cff';
      ctx.beginPath(); ctx.arc(pm[0], pm[1], 3, 0, Math.PI * 2); ctx.fill();
    }
    // Objective blip.
    var t = Missions.currentTarget();
    if (t) {
      var om = this.mapXY(t.x, t.z);
      var pulse = 4 + Math.sin(G.elapsed * 4) * 1.4;
      ctx.fillStyle = '#ffc93c';
      ctx.beginPath(); ctx.arc(om[0], om[1], pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff2c4';
      ctx.beginPath(); ctx.arc(om[0], om[1], pulse + 2.5, 0, Math.PI * 2); ctx.stroke();
    }
    // Player arrow.
    var pl = Player.pos(), pm2 = this.mapXY(pl.x, pl.z);
    var heading = G.mode === 'car' && G.currentCar ? G.currentCar.heading : G.camYaw + Math.PI;
    ctx.save();
    ctx.translate(pm2[0], pm2[1]);
    ctx.rotate(headingToMap(heading));
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 2.4); ctx.lineTo(-4, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },
};

// The minimap's y axis points down while the world's -z is up on screen:
// convert a world heading to a canvas rotation.
function headingToMap(heading) {
  return Math.PI - heading;
}
