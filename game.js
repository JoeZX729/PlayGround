const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const formLabel = document.getElementById('formLabel');
const healthText = document.getElementById('healthText');
const questText = document.getElementById('questText');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const startButton = document.getElementById('startButton');
const attackButton = document.getElementById('attackButton');
const shiftButton = document.getElementById('shiftButton');

const world = {
  width: 900,
  height: 1200,
  tile: 48,
  obstacles: [
    { x: 150, y: 150, w: 130, h: 160 },
    { x: 640, y: 180, w: 150, h: 180 },
    { x: 260, y: 620, w: 160, h: 150 },
    { x: 570, y: 620, w: 170, h: 150 },
    { x: 420, y: 315, w: 58, h: 178 },
    { x: 415, y: 800, w: 70, h: 170 },
  ],
  lanterns: [
    { x: 210, y: 920, r: 120 },
    { x: 670, y: 930, r: 120 },
    { x: 455, y: 270, r: 180 },
  ]
};

const formCatalog = {
  human: { name: 'Human', speed: 185, attack: 18, maxHp: 100, color: '#d9d5ce', glow: '#b6d6ff' },
  wolf: { name: 'Wolf', speed: 235, attack: 22, maxHp: 88, color: '#de9760', glow: '#ffdca8' },
  bear: { name: 'Bear', speed: 140, attack: 32, maxHp: 132, color: '#a56746', glow: '#ffe2b6' },
  stag: { name: 'Stag', speed: 215, attack: 26, maxHp: 96, color: '#b8d8ff', glow: '#dfeeff' },
};

const input = {
  keys: Object.create(null),
  attackQueued: false,
  shiftQueued: false,
};

let gameActive = false;
let gameWon = false;
let lastFrame = 0;
let questState = { relics: 0, boss: false, win: false };
let mobileControlled = false;

function resetGame() {
  gameActive = true;
  gameWon = false;
  questState = { relics: 0, boss: false, win: false };
  game.player = {
    x: 456,
    y: 1030,
    radius: 24,
    form: 'human',
    hp: formCatalog.human.maxHp,
    maxHp: formCatalog.human.maxHp,
    attackCooldown: 0,
    hurtTimer: 0,
    facingX: 1,
    facingY: 0,
    dash: 0,
  };

  game.relics = [
    { x: 330, y: 220, collected: false },
    { x: 570, y: 420, collected: false },
    { x: 520, y: 900, collected: false },
  ];

  game.enemies = [
    { type: 'boar', x: 250, y: 470, radius: 24, hp: 42, speed: 78, color: '#8b5b42', attack: 8 },
    { type: 'boar', x: 690, y: 460, radius: 24, hp: 42, speed: 78, color: '#8b5b42', attack: 8 },
    { type: 'wraith', x: 520, y: 700, radius: 20, hp: 26, speed: 88, color: '#7cc7d8', attack: 10 },
    { type: 'wraith', x: 330, y: 840, radius: 20, hp: 26, speed: 88, color: '#7cc7d8', attack: 10 },
  ];

  game.boss = null;
  game.particles = [];
  game.message = 'The forest breathes in the dark.';
  updateHud();
}

const game = {
  player: null,
  relics: [],
  enemies: [],
  boss: null,
  particles: [],
  message: '',
  time: 0,
};

function updateHud() {
  if (!game.player) return;
  const form = formCatalog[game.player.form];
  formLabel.textContent = form.name;
  healthText.textContent = `HP ${Math.max(0, Math.round(game.player.hp))}/${form.maxHp}`;
  if (questState.win) {
    questText.textContent = 'Quest: The Warden is defeated. Dawn returns.';
  } else if (game.boss) {
    questText.textContent = 'Quest: Defeat the Warden of the Root';
  } else {
    const collected = game.relics.filter((r) => r.collected).length;
    questText.textContent = `Quest: Gather the relics (${collected}/3)`;
  }
}

function startGame() {
  overlay.classList.remove('visible');
  overlayTitle.textContent = 'Moonwake';
  overlayText.textContent = 'The forest of Ashfen has gone dim. Gather three moon-silver relics, change your body to survive the wild, and defeat the Warden of the Root.';
  startButton.textContent = 'Begin the Hunt';
  startButton.blur();
  resetGame();
}

function centerText(x, y, text, color = '#f7f0d9', size = 32, weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function collidesWithObstacle(x, y, radius) {
  for (const obs of world.obstacles) {
    const closestX = clamp(x, obs.x, obs.x + obs.w);
    const closestY = clamp(y, obs.y, obs.y + obs.h);
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy < radius * radius) {
      return true;
    }
  }
  return false;
}

function movePlayer(dx, dy, dt) {
  if (!game.player) return;
  const form = formCatalog[game.player.form];
  const speed = form.speed * (game.player.dash > 0 ? 1.26 : 1);
  let nextX = game.player.x + dx * speed * dt;
  let nextY = game.player.y + dy * speed * dt;

  if (!collidesWithObstacle(nextX, game.player.y, game.player.radius)) {
    game.player.x = clamp(nextX, 36, world.width - 36);
  }
  if (!collidesWithObstacle(game.player.x, nextY, game.player.radius)) {
    game.player.y = clamp(nextY, 36, world.height - 36);
  }

  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    game.player.facingX = dx || game.player.facingX;
    game.player.facingY = dy || game.player.facingY;
  }
}

function cycleForm() {
  if (!game.player) return;
  const forms = ['human', 'wolf', 'bear', 'stag'];
  const currentIndex = forms.indexOf(game.player.form);
  const next = forms[(currentIndex + 1) % forms.length];
  game.player.form = next;
  const stats = formCatalog[next];
  game.player.maxHp = stats.maxHp;
  game.player.hp = clamp(game.player.hp + 12, 0, game.player.maxHp);
  game.message = `${stats.name} form assumed.`;
  updateHud();
}

function performAttack() {
  if (!game.player || game.player.attackCooldown > 0) return;
  const form = formCatalog[game.player.form];
  game.player.attackCooldown = game.player.form === 'wolf' ? 0.34 : 0.48;
  const dirX = Math.abs(game.player.facingX) > 0.001 ? game.player.facingX : 1;
  const dirY = Math.abs(game.player.facingY) > 0.001 ? game.player.facingY : 0;
  const reach = 70;

  for (const enemy of game.enemies) {
    const dx = enemy.x - game.player.x;
    const dy = enemy.y - game.player.y;
    const projected = dx * dirX + dy * dirY;
    const dist = Math.hypot(dx, dy);
    if (projected > 0 && dist < reach + enemy.radius + 18) {
      enemy.hp -= form.attack + (game.player.form === 'bear' ? 10 : 0);
      game.particles.push({ x: enemy.x, y: enemy.y, life: 0.42, color: '#ffd39f', size: 7 });
      if (enemy.hp <= 0) {
        killEnemy(enemy);
      }
    }
  }

  if (game.boss) {
    const dx = game.boss.x - game.player.x;
    const dy = game.boss.y - game.player.y;
    const dist = Math.hypot(dx, dy);
    const projected = dx * dirX + dy * dirY;
    if (projected > 0 && dist < 110) {
      game.boss.hp -= form.attack + 8;
      game.particles.push({ x: game.boss.x, y: game.boss.y, life: 0.5, color: '#fff5b5', size: 9 });
      if (game.boss.hp <= 0) {
        game.boss.alive = false;
        game.boss = null;
        questState.win = true;
        game.message = 'The Warden falls. Dawn reaches the forest.';
      }
    }
  }
}

function killEnemy(enemy) {
  enemy.dead = true;
  for (let i = 0; i < 12; i += 1) {
    game.particles.push({
      x: enemy.x,
      y: enemy.y,
      dx: (Math.random() - 0.5) * 150,
      dy: (Math.random() - 0.5) * 150,
      size: 4 + Math.random() * 5,
      life: 0.6 + Math.random() * 0.5,
      color: enemy.type === 'boar' ? '#b37043' : '#a3e8f8'
    });
  }
}

function spawnBoss() {
  if (game.boss || questState.boss) return;
  questState.boss = true;
  game.boss = { type: 'warden', x: 510, y: 275, radius: 34, hp: 150, speed: 92, color: '#d7d2fe', attack: 12, alive: true };
  game.message = 'The Warden of the Root awakens.';
}

function handlePickups() {
  for (const relic of game.relics) {
    if (relic.collected) continue;
    const dist = Math.hypot(game.player.x - relic.x, game.player.y - relic.y);
    if (dist < 42) {
      relic.collected = true;
      questState.relics += 1;
      game.player.hp = clamp(game.player.hp + 18, 0, game.player.maxHp);
      game.message = `Relic recovered: ${questState.relics}/3`;
      if (questState.relics >= 3) {
        spawnBoss();
      }
    }
  }
}

function enemyLogic(enemy, dt) {
  if (enemy.dead) return;
  const dx = game.player.x - enemy.x;
  const dy = game.player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  if (dist < 420) {
    enemy.x += (dx / dist) * enemy.speed * dt;
    enemy.y += (dy / dist) * enemy.speed * dt;
    if (collidesWithObstacle(enemy.x, enemy.y, enemy.radius)) {
      enemy.x -= (dx / dist) * enemy.speed * dt;
      enemy.y -= (dy / dist) * enemy.speed * dt;
    }
  }

  if (dist < enemy.radius + game.player.radius + 2) {
    game.player.hp -= enemy.attack * dt;
    game.player.hurtTimer = 0.18;
  }
}

function bossLogic(dt) {
  if (!game.boss || !game.boss.alive) return;
  const dx = game.player.x - game.boss.x;
  const dy = game.player.y - game.boss.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (dist < 520) {
    game.boss.x += (dx / dist) * game.boss.speed * dt;
    game.boss.y += (dy / dist) * game.boss.speed * dt;
  }
  if (dist < game.boss.radius + game.player.radius + 6) {
    game.player.hp -= game.boss.attack * dt;
    game.player.hurtTimer = 0.15;
  }
}

function updateParticles(dt) {
  for (const p of game.particles) {
    p.life -= dt;
    p.x += (p.dx || 0) * dt;
    p.y += (p.dy || 0) * dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
}

function update(dt) {
  if (!game.player || !gameActive) return;
  game.time += dt;
  game.player.attackCooldown = Math.max(0, game.player.attackCooldown - dt);
  game.player.hurtTimer = Math.max(0, game.player.hurtTimer - dt);
  game.player.dash = Math.max(0, game.player.dash - dt);

  const moveX = (input.keys.ArrowRight || input.keys.KeyD ? 1 : 0) - (input.keys.ArrowLeft || input.keys.KeyA ? 1 : 0);
  const moveY = (input.keys.ArrowDown || input.keys.KeyS ? 1 : 0) - (input.keys.ArrowUp || input.keys.KeyW ? 1 : 0);
  const len = Math.hypot(moveX, moveY) || 1;
  const dx = moveX / len;
  const dy = moveY / len;
  if (moveX || moveY) movePlayer(dx, dy, dt);

  if (input.attackQueued) {
    input.attackQueued = false;
    performAttack();
  }

  if (input.shiftQueued) {
    input.shiftQueued = false;
    cycleForm();
    game.player.dash = 0.18;
  }

  for (const enemy of game.enemies) enemyLogic(enemy, dt);
  bossLogic(dt);
  handlePickups();
  updateParticles(dt);

  if (game.player.hp <= 0) {
    gameActive = false;
    overlay.classList.add('visible');
    overlayText.textContent = 'The forest claimed you. Shift your form and try again.';
    overlayTitle.textContent = 'Fallen';
    startButton.textContent = 'Try Again';
    return;
  }

  if (questState.win) {
    gameActive = false;
    overlay.classList.add('visible');
    overlayText.textContent = 'Ashfen breathes again. The moon-silver relics are restored to the earth.';
    overlayTitle.textContent = 'Victory';
    startButton.textContent = 'Play Again';
    return;
  }

  updateHud();
}

function drawGround() {
  ctx.fillStyle = '#182838';
  ctx.fillRect(0, 0, world.width, world.height);

  for (let x = 0; x < world.width; x += world.tile) {
    for (let y = 0; y < world.height; y += world.tile) {
      const isDark = (x + y) % 96 < 48;
      ctx.fillStyle = isDark ? '#1d2d3b' : '#213949';
      ctx.fillRect(x, y, world.tile, world.tile);
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(x + 2, y + 2, world.tile - 4, world.tile - 4);
    }
  }

  for (const obs of world.obstacles) {
    ctx.fillStyle = '#3a4e4a';
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    ctx.fillStyle = 'rgba(12,17,20,0.26)';
    ctx.fillRect(obs.x, obs.y + obs.h - 10, obs.w, 10);
  }

  ctx.fillStyle = '#69534d';
  ctx.fillRect(400, 120, 100, 110);
  ctx.fillStyle = '#6b7f8a';
  ctx.fillRect(430, 20, 36, 110);
  ctx.fillStyle = '#9d8d8a';
  ctx.fillRect(330, 980, 240, 90);
}

function drawShrine() {
  ctx.fillStyle = '#b4b8d9';
  ctx.fillRect(428, 176, 46, 74);
  ctx.fillStyle = '#f0d88e';
  ctx.beginPath();
  ctx.arc(454, 150, 28, 0, Math.PI * 2);
  ctx.fill();

  for (const relic of game.relics) {
    if (relic.collected) continue;
    ctx.fillStyle = '#dfeaf7';
    ctx.beginPath();
    ctx.arc(relic.x, relic.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6d38d';
    ctx.fillRect(relic.x - 4, relic.y - 18, 8, 20);
  }
}

function drawEntity(entity, color, size, shape = 'circle') {
  ctx.save();
  ctx.translate(entity.x, entity.y);
  ctx.fillStyle = color;

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, -size * 1.2);
    ctx.lineTo(size * 0.9, 0);
    ctx.lineTo(0, size * 1.2);
    ctx.lineTo(-size * 0.9, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawShadowsAndLights() {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 9, 17, 0.78)';
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.globalCompositeOperation = 'destination-out';

  const lights = [
    { x: game.player.x, y: game.player.y, r: 170 },
    ...world.lanterns.map((l) => ({ x: l.x, y: l.y, r: l.r })),
  ];

  for (const light of lights) {
    const grad = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.28, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.14)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function drawPlayer() {
  const form = formCatalog[game.player.form];
  const x = game.player.x;
  const y = game.player.y;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = form.color;
  ctx.beginPath();
  ctx.arc(x, y, game.player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f2efea';
  ctx.beginPath();
  ctx.arc(x - 8, y - 4, 4, 0, Math.PI * 2);
  ctx.arc(x + 8, y - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  if (game.player.hurtTimer > 0) {
    ctx.fillStyle = 'rgba(255, 100, 92, 0.5)';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemy(enemy) {
  if (enemy.dead) return;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(enemy.x, enemy.y + 16, enemy.radius + 6, enemy.radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (enemy.type === 'boar') {
    drawEntity(enemy, enemy.color, enemy.radius, 'diamond');
  } else {
    drawEntity(enemy, enemy.color, enemy.radius, 'circle');
  }

  const hpScale = enemy.hp / (enemy.type === 'warden' ? 150 : 42);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(enemy.x - 26, enemy.y - enemy.radius - 18, 52, 8);
  ctx.fillStyle = '#8fe0b4';
  ctx.fillRect(enemy.x - 24, enemy.y - enemy.radius - 16, 48 * hpScale, 4);
}

function drawBoss() {
  if (!game.boss || !game.boss.alive) return;
  const boss = game.boss;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(boss.x, boss.y + 16, 42, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d1d1ff';
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#9a7cff';
  ctx.beginPath();
  ctx.moveTo(boss.x, boss.y - 30);
  ctx.lineTo(boss.x + 16, boss.y - 6);
  ctx.lineTo(boss.x - 16, boss.y - 6);
  ctx.closePath();
  ctx.fill();

  const hpRatio = clamp(game.boss.hp / 150, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(boss.x - 60, boss.y - 52, 120, 10);
  ctx.fillStyle = '#ff9e82';
  ctx.fillRect(boss.x - 58, boss.y - 50, 116 * hpRatio, 6);
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 1.3);
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawUIStrings() {
  if (!game.player) return;
  ctx.fillStyle = 'rgba(10, 14, 20, 0.38)';
  ctx.fillRect(38, 1108, 300, 46);
  centerText(188, 1140, `${game.message || 'Forest wanderer'}`, '#ebf0ff', 16, 600);
  centerText(452, 1100, `HP ${Math.round(game.player.hp)}`, '#ffd7a1', 26, 700);
}

function render() {
  drawGround();
  drawShrine();
  for (const enemy of game.enemies) drawEnemy(enemy);
  drawBoss();
  drawPlayer();
  drawParticles();
  drawShadowsAndLights();
  drawUIStrings();
}

function frame(timestamp) {
  const dt = Math.min((timestamp - lastFrame) / 1000 || 0.016, 0.032);
  lastFrame = timestamp;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function setButtonState() {
  const isDesktop = window.matchMedia('(pointer: fine) and (min-width: 700px)').matches;
  document.querySelector('.touch-controls').style.display = isDesktop ? 'none' : 'flex';
}

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch') {
    document.querySelector('.touch-controls').style.display = 'flex';
  }
});
window.addEventListener('resize', setButtonState);

function handleKey(event, isDown) {
  if (event.code) {
    input.keys[event.code] = isDown;
  }
  if (isDown && event.code === 'Space') {
    input.attackQueued = true;
  }
  if (isDown && event.code === 'ShiftLeft') {
    input.shiftQueued = true;
  }
}

function bindControls() {
  window.addEventListener('keydown', (event) => handleKey(event, true));
  window.addEventListener('keyup', (event) => handleKey(event, false));

  document.querySelectorAll('.touch-up, .touch-down, .touch-left, .touch-right').forEach((button) => {
    const holdTimeout = { active: false };
    const press = (event) => {
      event.preventDefault();
      mobileControlled = true;
      const key = button.dataset.key;
      input.keys[key] = true;
      if (button.dataset.key === 'ArrowUp') {
        game.player.facingY = -1;
      }
      if (button.dataset.key === 'ArrowDown') {
        game.player.facingY = 1;
      }
      if (button.dataset.key === 'ArrowLeft') {
        game.player.facingX = -1;
      }
      if (button.dataset.key === 'ArrowRight') {
        game.player.facingX = 1;
      }
      if (!holdTimeout.active) {
        holdTimeout.active = true;
        const release = () => {
          input.keys[key] = false;
          holdTimeout.active = false;
        };
        button.addEventListener('pointerup', release, { once: true });
        button.addEventListener('pointerleave', release, { once: true });
      }
    };
    button.addEventListener('pointerdown', press);
  });

  attackButton.addEventListener('click', () => {
    input.attackQueued = true;
  });

  shiftButton.addEventListener('click', () => {
    input.shiftQueued = true;
  });

  startButton.addEventListener('click', () => {
    startGame();
  });
}

setButtonState();
bindControls();
resetGame();
requestAnimationFrame(frame);
