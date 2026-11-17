import * as THREE from 'three';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { Vehicle, spawnParkedCars } from './vehicles.js';
import { TrafficSystem } from './traffic.js';
import { WantedSystem } from './police.js';
import { MissionSystem } from './missions.js';
import { CombatSystem } from './combat.js';
import { SoundSystem } from './audio.js';
import { saveGame, loadGame, clearSave, hasSave } from './save.js';

// 1. Setup Renderer & Scene & Camera
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

// 4. Lighting: HemisphereLight + Directional sun (check city.js or add cleanly)
const hemiLight = new THREE.HemisphereLight(0xfff8e7, 0x444444, 0.9);
hemiLight.position.set(0, 200, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(100, 200, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 500;
const d = 150;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
scene.add(dirLight);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Sound System
const sound = new SoundSystem();

// 2. Build City, Player, Parked Cars, Traffic, Wanted, Missions, Combat
const city = buildCity(scene);
const player = new Player(scene);

// 3. Spawn fix: move player to a clear spot on a road (e.g. intersection near middle (0,0) or road centre)
// Let's place player at road center (0, 0, 40) or similar intersection
player.position.set(0, 0, 35);
player.group.position.copy(player.position);

const parkedCars = spawnParkedCars(scene, city, 12);
const traffic = new TrafficSystem(scene, city);
const wanted = new WantedSystem(scene, city);

wanted.onLevelChange = (lvl) => {
  const stars = document.querySelectorAll('#hud-wanted .star');
  stars.forEach((s, i) => {
    if (i < lvl) {
      s.textContent = '★';
      s.classList.add('active');
    } else {
      s.textContent = '☆';
      s.classList.remove('active');
    }
  });
  // 1. Sound: siren when wanted.level >= 1
  if (lvl >= 1) {
    sound.siren(true);
  } else {
    sound.siren(false);
  }
};

const missions = new MissionSystem(scene, city);
missions.start();
missions.onMissionComplete = () => {
  sound.missionComplete();
  // 2. Save right after mission completes
  saveGame({
    cash: missions.cash,
    missionIndex: missions.currentIndex,
    health: combat.health,
    playerX: player.position.x,
    playerZ: player.position.z,
    driving: !!window.__game.driving
  });
};

const combat = new CombatSystem(scene, city, player);
combat.setWanted(wanted);

// Hook combat action sounds
const origShoot = combat.shoot.bind(combat);
combat.shoot = () => {
  sound.gunshot();
  origShoot();
};

const origPunch = combat.punch.bind(combat);
combat.punch = () => {
  sound.punchHit();
  origPunch();
};

// Global game state reference
window.__game = {
  scene,
  player,
  city,
  parkedCars,
  traffic,
  wanted,
  missions,
  combat,
  driving: null,
  state: 'menu'
};

// HUD Elements
const hudObjective = document.getElementById('hud-objective');
const hudCash = document.getElementById('hud-cash');
const hudHealth = document.getElementById('hud-health');

// Start Screen UI & Continue Button
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');

if (startButton) {
  startButton.addEventListener('click', () => {
    sound.ensure();
    sound.click();
    if (startScreen) startScreen.style.display = 'none';
    window.__game.state = 'playing';
  });
}

// 2. Save: Continue button next to Start if hasSave()
if (startScreen && hasSave()) {
  const continueBtn = document.createElement('button');
  continueBtn.id = 'continue-button';
  continueBtn.textContent = 'Continue Game';
  continueBtn.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 12px 24px; font-size: 18px; border-radius: 8px; cursor: pointer; margin-left: 10px; font-weight: bold; box-shadow: 0 4px 12px rgba(59,130,246,0.4);';
  continueBtn.addEventListener('click', () => {
    sound.ensure();
    sound.click();
    const saved = loadGame();
    if (saved) {
      missions.cash = saved.cash;
      missions.currentIndex = saved.missionIndex;
      missions._updateMarkerPosition();
      combat.health = saved.health;
      player.position.set(saved.playerX, 0, saved.playerZ);
      player.group.position.copy(player.position);
      if (hudCash) hudCash.textContent = '$' + missions.cash;
      if (hudHealth) hudHealth.textContent = Math.ceil(combat.health);
      const cur = missions.current();
      if (hudObjective && cur) hudObjective.textContent = cur.objective;
    }
    if (startScreen) startScreen.style.display = 'none';
    window.__game.state = 'playing';
  });
  if (startButton && startButton.parentNode) {
    startButton.parentNode.appendChild(continueBtn);
  }
}


// Set HUD from live state at boot
if (hudCash) hudCash.textContent = '💲 ' + missions.cash;
if (hudHealth) hudHealth.textContent = '❤️ ' + Math.ceil(combat.health);
const cur = missions.current();
if (hudObjective && cur) hudObjective.textContent = cur.objective;
else if (hudObjective) hudObjective.textContent = 'Explore Sunset City';

// 5. Screenshot staging (?shot=...) and autostart
const urlParams = new URLSearchParams(window.location.search);
const shotParam = urlParams.get('shot');
const autostartParam = urlParams.get('autostart');

function stageShot(name) {
  if (startScreen) startScreen.style.display = 'none';
  window.__game.state = 'playing';
  sound.ensure();

  if (name === 'street') {
    // Player on foot at wide intersection with traffic cars & pedestrians visible, camera pulled back
    player.position.set(0, 0, 40);
    player.group.position.copy(player.position);
    player.cameraDist = 12.0;
    player.cameraHeight = 4.5;
    if (traffic && traffic.cars.length >= 2) {
      traffic.cars[0].position.set(5, 0, 35);
      traffic.cars[0].mesh.position.copy(traffic.cars[0].position);
      traffic.cars[1].position.set(-6, 0, 45);
      traffic.cars[1].mesh.position.copy(traffic.cars[1].position);
    }
    if (traffic && traffic.pedestrians.length >= 2) {
      traffic.pedestrians[0].startX = 3; traffic.pedestrians[0].endX = 3;
      traffic.pedestrians[0].startZ = 35; traffic.pedestrians[0].endZ = 45;
      traffic.pedestrians[0].progress = 0.5;
      traffic.pedestrians[1].startX = -3; traffic.pedestrians[1].endX = -3;
      traffic.pedestrians[1].startZ = 35; traffic.pedestrians[1].endZ = 45;
      traffic.pedestrians[1].progress = 0.5;
    }
  } else if (name === 'drive') {
    // (a) drive: choose a parked car whose style is 'sport' or 'sedan' (fall back to parkedCars[0]);
    // set car.position to (40, 0.2, -80) and car.heading = 0, then car.mesh.position.copy(car.position);
    // move 2 traffic cars onto the same road ahead: traffic.cars[0] at (40, 0.2, -40) and traffic.cars[1] at (40, 0.2, 0).
    let targetCar = parkedCars.find(c => c.style === 'sport' || c.style === 'sedan');
    if (!targetCar && parkedCars.length > 0) targetCar = parkedCars[0];
    if (targetCar) {
      targetCar.position.set(40, 0.2, -80);
      targetCar.heading = 0;
      targetCar.mesh.position.copy(targetCar.position);
      targetCar.mesh.rotation.y = targetCar.heading;
      window.__game.driving = targetCar;
      player.group.visible = false;
      if (hudObjective) hudObjective.textContent = 'Driving (' + targetCar.style + ') - Press E to Exit';
    }
    if (traffic && traffic.cars.length >= 2) {
      traffic.cars[0].position.set(40, 0.2, -40);
      traffic.cars[0].heading = 0;
      traffic.cars[0].mesh.position.copy(traffic.cars[0].position);
      traffic.cars[0].mesh.rotation.y = 0;

      traffic.cars[1].position.set(40, 0.2, 0);
      traffic.cars[1].heading = 0;
      traffic.cars[1].mesh.position.copy(traffic.cars[1].position);
      traffic.cars[1].mesh.rotation.y = 0;
    }
  } else if (name === 'chase') {
    // (b) chase: same car placement as drive, then after wanted.addHeat(60) move policeCars[0] to (40, 0.2, -30)
    // ahead of player and policeCars[1] to (40, 0.2, -110) behind.
    let targetCar = parkedCars.find(c => c.style === 'sport' || c.style === 'sedan');
    if (!targetCar && parkedCars.length > 0) targetCar = parkedCars[0];
    if (targetCar) {
      targetCar.position.set(40, 0.2, -80);
      targetCar.heading = 0;
      targetCar.mesh.position.copy(targetCar.position);
      targetCar.mesh.rotation.y = targetCar.heading;
      window.__game.driving = targetCar;
      player.group.visible = false;
      if (hudObjective) hudObjective.textContent = 'Driving (' + targetCar.style + ') - Press E to Exit';
    }
    wanted.addHeat(60);
    if (wanted.policeCars && wanted.policeCars.length > 0) {
      const p1 = wanted.policeCars[0];
      p1.position.set(36, 0.2, -60);
      p1.heading = Math.PI;
      p1.group.position.copy(p1.position);
      p1.group.rotation.y = p1.heading;
    }
    if (wanted.policeCars && wanted.policeCars.length > 1) {
      const p2 = wanted.policeCars[1];
      p2.position.set(40, 0.2, -110);
      p2.heading = 0;
      p2.group.position.copy(p2.position);
      p2.group.rotation.y = p2.heading;
    }
  } else if (name === 'mission') {
    // (c) mission: place the player at (40, 0, 55) - on the x=40 road, 15 units south of mission marker at (40,40)
    player.position.set(40, 0, 55);
    player.group.position.copy(player.position);
    player.cameraYaw = Math.PI;
    player.cameraDist = 9.0;
    player.cameraHeight = 3.5;
  }
}

if (shotParam) {
  stageShot(shotParam);
} else if (autostartParam) {
  if (startScreen) startScreen.style.display = 'none';
  window.__game.state = 'playing';
}

// 3. Input State
const input = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
  jump: false,
  dragDX: 0,
  dragDY: 0
};

// Keyboard Listeners
window.addEventListener('keydown', (e) => {
  sound.ensure();
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = true;
  if (e.code === 'Space') {
    input.jump = true;
    e.preventDefault();
  }

  // Punch with F
  if (e.code === 'KeyF' && window.__game.state === 'playing') {
    combat.punch();
  }

  // Enter/Exit Car with E key
  if (e.code === 'KeyE' && window.__game.state === 'playing') {
    if (window.__game.driving) {
      // Exit car
      const car = window.__game.driving;
      player.position.set(
        car.position.x + 2.2 * Math.cos(car.heading),
        0,
        car.position.z - 2.2 * Math.sin(car.heading)
      );
      player.group.position.copy(player.position);
      player.group.visible = true;
      window.__game.driving = null;
      sound.stopEngine();
      if (hudObjective) hudObjective.textContent = 'Explore Sunset City';
    } else {
      // Check nearest parked car within 3 units
      for (const car of parkedCars) {
        const dist = player.position.distanceTo(car.position);
        if (dist < 3.0) {
          window.__game.driving = car;
          sound.engineStart();
          wanted.addHeat(25);
          player.group.visible = false;
          if (hudObjective) {
            hudObjective.textContent = 'Car stolen! The police are onto you. Driving (' + car.style + ') - Press E to Exit';
          }
          break;
        }
      }
    }
  }

  // Toggle lights with L
  if (e.code === 'KeyL' && window.__game.driving) {
    window.__game.driving.lights = !window.__game.driving.lights;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') input.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.back = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.right = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.run = false;
  if (e.code === 'Space') input.jump = false;
});

// Mouse Shoot & Drag Orbit Listeners
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

renderer.domElement.addEventListener('mousedown', (e) => {
  sound.ensure();
  if (e.button === 0 && window.__game.state === 'playing') {
    combat.shoot();
  }
  isDragging = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastMouseX;
  const dy = e.clientY - lastMouseY;
  input.dragDX += dx;
  input.dragDY += dy;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

window.addEventListener('mouseup', () => {
  isDragging = false;
});

// Touch support for mobile / drag
renderer.domElement.addEventListener('touchstart', (e) => {
  sound.ensure();
  if (e.touches.length === 1) {
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
  }
});

renderer.domElement.addEventListener('touchmove', (e) => {
  if (!isDragging || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - lastMouseX;
  const dy = e.touches[0].clientY - lastMouseY;
  input.dragDX += dx;
  input.dragDY += dy;
  lastMouseX = e.touches[0].clientX;
  lastMouseY = e.touches[0].clientY;
}, { passive: true });

renderer.domElement.addEventListener('touchend', () => {
  isDragging = false;
});

// Window resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game Over UI helper
function showGameOver() {
  sound.gameOver();
  const existing = document.getElementById('game-over-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'game-over-overlay';
  overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 9999; color: white; font-family: sans-serif;';
  overlay.innerHTML = `
    <h1 style="font-size: 48px; color: #ef4444; margin-bottom: 10px; text-transform: uppercase; letter-data: 2px;">Wasted</h1>
    <p style="font-size: 20px; color: #9ca3af; margin-bottom: 30px;">You were busted or taken down in Sunset City.</p>
    <button id="restart-btn" style="background: #eab308; color: black; border: none; padding: 14px 28px; font-size: 20px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 15px rgba(234,179,8,0.4);">Try Again</button>
  `;
  document.body.appendChild(overlay);

  document.getElementById('restart-btn').addEventListener('click', () => {
    sound.ensure();
    sound.click();
    clearSave();
    window.location.reload();
  });
}

// 5. Minimap Setup
const minimapCanvas = document.getElementById('hud-minimap');
let minimapCtx = null;
if (minimapCanvas) {
  minimapCtx = minimapCanvas.getContext('2d');
}

function drawMinimap() {
  if (!minimapCtx || !minimapCanvas) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;

  minimapCtx.clearRect(0, 0, w, h);
  minimapCtx.fillStyle = '#1e293b';
  minimapCtx.fillRect(0, 0, w, h);

  // Draw mission marker if active
  const curMission = missions.current();
  if (curMission && missions.markerPos) {
    const mNormX = (missions.markerPos.x / 100) * 0.5 + 0.5;
    const mNormZ = (missions.markerPos.z / 100) * 0.5 + 0.5;
    minimapCtx.fillStyle = '#eab308';
    minimapCtx.beginPath();
    minimapCtx.arc(mNormX * w, mNormZ * h, 5, 0, Math.PI * 2);
    minimapCtx.fill();
  }

  // Draw police cars as small red dots
  if (wanted.policeCars) {
    minimapCtx.fillStyle = '#ef4444';
    for (const pCar of wanted.policeCars) {
      if (!pCar || !pCar.position) continue;
      const pNormX = (pCar.position.x / 100) * 0.5 + 0.5;
      const pNormZ = (pCar.position.z / 100) * 0.5 + 0.5;
      minimapCtx.fillRect(pNormX * w - 2, pNormZ * h - 2, 4, 4);
    }
  }

  // Target object position (player or driving car)
  const targetPos = window.__game.driving ? window.__game.driving.position : player.position;
  const normX = (targetPos.x / 100) * 0.5 + 0.5;
  const normZ = (targetPos.z / 100) * 0.5 + 0.5;
  const mapX = normX * w;
  const mapY = normZ * h;

  minimapCtx.fillStyle = window.__game.driving ? '#3b82f6' : '#ef4444';
  minimapCtx.beginPath();
  minimapCtx.arc(mapX, mapY, 5, 0, Math.PI * 2);
  minimapCtx.fill();
}

// Autosave timer (every 10 seconds while playing)
let saveTimer = 0;

// 6. Main Render Loop
let lastTime = performance.now();

function animate(currentTime) {
  requestAnimationFrame(animate);

  const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
  lastTime = currentTime;

  if (window.__game.state === 'playing') {
    // 2. Autosave every 10 seconds while playing
    saveTimer += dt;
    if (saveTimer >= 10) {
      saveTimer = 0;
      saveGame({
        cash: missions.cash,
        missionIndex: missions.currentIndex,
        health: combat.health,
        playerX: player.position.x,
        playerZ: player.position.z,
        driving: !!window.__game.driving
      });
    }

    if (window.__game.driving) {
      // Update vehicle physics & controls
      const car = window.__game.driving;
      car.update(dt, input, city);

      // 1. Sound: engine setEngine speed
      const speed01 = Math.min(1, Math.abs(car.speed) / (car.maxSpeed || 30));
      sound.setEngine(speed01);

      // Camera follow car
      if (camera) {
        if (input.dragDX) player.cameraYaw -= input.dragDX * 0.005;
        if (input.dragDY) player.cameraPitch = Math.max(-0.2, Math.min(1.2, player.cameraPitch + input.dragDY * 0.005));

        const followDist = 8.0;
        const followHeight = 3.2;
        const targetCamX = car.position.x - Math.sin(car.heading + player.cameraYaw) * followDist;
        const targetCamY = car.position.y + followHeight;
        const targetCamZ = car.position.z - Math.cos(car.heading + player.cameraYaw) * followDist;

        camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 10);
        camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 10);
        camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 10);
        camera.lookAt(car.position.x, car.position.y + 1.0, car.position.z);
      }
    } else {
      sound.stopEngine();
      player.update(dt, input, city, camera);
    }

    // Always update traffic, wanted, missions, and combat when playing
    traffic.update(dt, player.position, window.__game.driving);
    wanted.update(dt, player.position, !window.__game.driving, window.__game.driving);

    const mStatus = missions.update(dt, player.position, window.__game.driving, wanted);
    if (mStatus === 'complete' || mStatus === 'stage') {
      const cur = missions.current();
      if (hudObjective) {
        hudObjective.textContent = cur ? cur.objective : 'All missions complete!';
      }
      if (hudCash) {
        hudCash.textContent = '$' + missions.cash;
      }
    } else if (!missions.current()) {
      if (hudObjective && hudObjective.textContent !== 'All missions complete!') {
        hudObjective.textContent = 'All missions complete!';
      }
    }

    combat.update(dt, {
      pedestrians: traffic.pedestrians,
      officers: wanted.policeOfficers
    });

    if (wanted.damageDealt > 0) {
      combat.takeDamage(wanted.damageDealt);
      wanted.damageDealt = 0;
    }

    if (combat.loot > 0) {
      missions.cash += combat.loot;
      combat.loot = 0;
      if (hudCash) hudCash.textContent = '$' + missions.cash;
    }

    if (hudHealth) {
      hudHealth.textContent = Math.ceil(combat.health);
    }

    if (combat.health <= 0) {
      window.__game.state = 'gameover';
      showGameOver();
    }
  } else {
    // Menu / Idle camera orbit update
    sound.stopEngine();
    if (camera) {
      player.cameraYaw += dt * 0.2;
      const targetCamX = player.position.x - Math.sin(player.cameraYaw) * Math.cos(player.cameraPitch) * player.cameraDist;
      const targetCamY = player.position.y + player.cameraHeight + Math.sin(player.cameraPitch) * player.cameraDist;
      const targetCamZ = player.position.z - Math.cos(player.cameraYaw) * Math.cos(player.cameraPitch) * player.cameraDist;
      camera.position.set(targetCamX, targetCamY, targetCamZ);
      camera.lookAt(player.position.x, player.position.y + 1.2, player.position.z);
    }
  }

  // Camera shake effect
  if (wanted.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * wanted.shake;
    camera.position.y += (Math.random() - 0.5) * wanted.shake;
  }

  // Always render scene
  renderer.render(scene, camera);

  // Draw minimap
  drawMinimap();

  // Reset frame input deltas
  input.dragDX = 0;
  input.dragDY = 0;
}

requestAnimationFrame(animate);
