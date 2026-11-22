// main.js — Surya Bay boot and game loop: renderer, lights, the world,
// the state machine (menu / play / pause / busted), deterministic
// ?shot= staging for screenshots, pickups, and the debug handle the
// playtests drive (window.__surya).
import * as THREE from "three";
import { buildCity } from "./city.js";
import { createInput } from "./input.js";
import { createPlayer, updatePlayer } from "./player.js";
import { createCar, spawnParkedCars, updateDriving, tryEnterExit, spawnBoats, updateBoat } from "./vehicles.js";
import { spawnTraffic, updateTraffic } from "./traffic.js";
import { spawnPeds, updatePeds } from "./pedestrians.js";
import { createPolice, addWanted, updatePolice } from "./police.js";
import { createMissions, updateMissions, startCurrentStep, startRace } from "./missions.js";
import { createHud, updateHud } from "./hud.js";
import { createAudio } from "./audio.js";
import { saveGame, loadGame, hasSave } from "./save.js";
import { makeRng } from "./random.js";

const SEED = 1337;

function boot() {
  const mount = document.getElementById("app");
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.className = "webgl";
  mount.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 120, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 90, 180);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a55, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 1.6);
  sun.position.set(-120, 180, -80);
  scene.add(sun);

  const S = {
    renderer,
    scene,
    camera,
    clock: new THREE.Clock(),
    seed: SEED,
    rng: makeRng(SEED),
    mode: "menu",
    time: 0,
    shot: 0,
    cars: [],
    boats: [],
    peds: [],
    pickups: [],
    autosaveTimer: 0,
    ready: false,
  };

  S.input = createInput(renderer.domElement);
  createAudio(S);
  buildCity(S);
  createPlayer(S);
  spawnParkedCars(S, makeRng(SEED + 11));
  spawnBoats(S);
  spawnTraffic(S);
  spawnPeds(S);
  createPolice(S);
  createHud(S);
  createMissions(S);
  createPickups(S);

  wireMenus(S);
  wireKeys(S);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Deterministic staged states for the four screenshots.
  const params = new URLSearchParams(window.location.search);
  const shot = parseInt(params.get("shot") || "0", 10);
  if (shot >= 1 && shot <= 4) {
    S.shot = shot;
    stageShot(S, shot);
  }

  S.ready = true;
  window.__surya = {
    S,
    version: "surya-bay-v9",
    state() {
      const p = S.player;
      return {
        mode: S.mode,
        wanted: S.police.wanted,
        health: Math.round(p.health),
        armor: Math.round(p.armor),
        cash: Math.round(p.cash),
        missionIndex: S.missions.index,
        missionTotal: S.missions.defs.length,
        missionStage: S.missions.stage,
        missionDone: S.missions.done,
        racesWon: p.racesWon || 0,
        deliveriesDone: p.deliveriesDone || 0,
        delivery: S.missions.sideJob && S.missions.sideJob.type === "harbor"
          ? {
            phase: S.missions.sideJob.phase,
            timeLeft: Math.round(S.missions.sideJob.timeLeft),
            reward: S.missions.sideJob.reward,
            from: S.missions.sideJob.fromName,
            to: S.missions.sideJob.toName,
            px: S.missions.sideJob.pickup.x,
            pz: S.missions.sideJob.pickup.z,
            dx: S.missions.sideJob.drop.x,
            dz: S.missions.sideJob.drop.z,
          }
          : null,
        boatYaw: p.boat ? +p.boat.yaw.toFixed(3) : 0,
        weapon: p.weapon,
        hasShotgun: p.hasShotgun,
        onBoat: !!p.boat,
        raceGate: S.missions.race ? S.missions.race.gate : -1,
        raceTime: S.missions.race ? Math.round(S.missions.race.timeLeft) : -1,
        px: +p.pos.x.toFixed(1),
        pz: +p.pos.z.toFixed(1),
        speed: +(p.boat ? Math.abs(p.boat.speed) : p.car ? Math.abs(p.car.speed) : p.speed).toFixed(1),
        onFoot: p.onFoot,
        policeCars: S.police.policeCars.length,
        cops: S.police.cops.length,
        gangLeft: S.missions.gangLeft,
        sideJob: !!S.missions.sideJob,
      };
    },
    setWanted(n) {
      S.police.wanted = 0;
      if (n > 0) addWanted(S, n, "debug");
    },
    teleport(x, z) {
      S.player.pos.set(x, 0, z);
      S.player.group.position.set(x, 0, z);
      if (S.player.car) {
        S.player.car.pos.set(x, 0, z);
        S.player.car.group.position.set(x, 0, z);
      }
    },
    giveCash(n) {
      S.player.cash += n;
    },
    startMission(i) {
      S.missions.index = i;
      S.missions.stage = 0;
      S.missions.done = false;
      startCurrentStep(S);
    },
  };

  renderer.setAnimationLoop(() => tick(S));
}

function createPickups(S) {
  const defs = [
    { kind: "health", x: 24, z: -60, color: 0x2ecc71, apply: () => { S.player.health = Math.min(100, S.player.health + 30); } },
    { kind: "health", x: -100, z: 140, color: 0x2ecc71, apply: () => { S.player.health = Math.min(100, S.player.health + 30); } },
    { kind: "armor", x: 100, z: 60, color: 0x4aa8ff, apply: () => { S.player.armor = Math.min(100, S.player.armor + 50); } },
    { kind: "armor", x: -140, z: -140, color: 0x4aa8ff, apply: () => { S.player.armor = Math.min(100, S.player.armor + 50); } },
    { kind: "ammo", x: 60, z: 100, color: 0xf5a623, apply: () => { S.player.ammoReserve += 24; } },
    { kind: "ammo", x: -60, z: -100, color: 0xf5a623, apply: () => { S.player.ammoReserve += 24; } },
    // v9: the shotgun waits by the harbor containers — grab it, then Q to swap.
    { kind: "shotgun", x: 70, z: 232, color: 0x8e44ad, apply: () => {
      S.player.hasShotgun = true;
      S.player.weapon = "shotgun";
      S.player.shells = 6;
      S.player.shellReserve += 12;
    } },
  ];
  for (const def of defs) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshLambertMaterial({ color: def.color, emissive: 0x222222 })
    );
    mesh.position.set(def.x, 1.2, def.z);
    S.scene.add(mesh);
    S.pickups.push({ ...def, mesh, taken: false, respawn: 0 });
  }
}

function updatePickups(S, dt) {
  const p = S.player;
  for (const pickup of S.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) {
        pickup.taken = false;
        pickup.mesh.visible = true;
      }
      continue;
    }
    pickup.mesh.rotation.y += dt * 1.5;
    pickup.mesh.position.y = 1.2 + Math.sin(S.time * 2 + pickup.x) * 0.25;
    const d = Math.hypot(p.pos.x - pickup.x, p.pos.z - pickup.z);
    if (d < 2.4 && p.alive) {
      pickup.apply();
      pickup.taken = true;
      pickup.respawn = 30;
      pickup.mesh.visible = false;
      S.audio.pickup();
      S.hud.toast(pickup.kind === "health" ? "+30 health" : pickup.kind === "armor" ? "+50 armor" : pickup.kind === "shotgun" ? "Shotgun! Press Q to swap weapons" : "+24 ammo");
    }
  }
}

function wireMenus(S) {
  const $ = (id) => document.getElementById(id);
  const menu = $("menu");
  const pauseMenu = $("pauseMenu");
  const bustedMenu = $("bustedMenu");
  const btnContinue = $("btnContinue");
  if (hasSave()) btnContinue.classList.remove("hidden");

  function startGame(load) {
    S.audio.ensure();
    S.audio.startMusic();
    S.input.keys.clear();
    if (load) {
      const save = loadGame();
      if (save) {
        S.player.cash = save.cash;
        S.player.health = save.health || 100;
        S.player.armor = save.armor || 0;
        S.player.pos.set(save.px || 0, 0, save.pz || 40);
        S.player.group.position.set(S.player.pos.x, 0, S.player.pos.z);
        S.player.carColor = save.carColor || 0xc0392b;
        S.player.racesWon = save.racesWon || 0;
        S.player.hasShotgun = !!save.hasShotgun;
        S.player.shells = save.shells || 0;
        S.player.shellReserve = save.shellReserve || 0;
        // v9: eight story missions now, so clamp to the last one — the old
        // cap of 5 sent saves from Harbor Run onward back to The Big One,
        // and made the story-complete branch below unreachable.
        const savedMission = Math.min(save.missionIndex || 0, S.missions.defs.length);
        S.missions.index = savedMission;
        S.missions.stage = 0;
        if (savedMission >= S.missions.defs.length) {
          S.missions.done = true;
          S.hud.setObjective("Story complete — free roam!");
          S.hud.toast("Save loaded — story complete. Free roam!");
        } else {
          S.missions.done = false;
          // Re-run the step's start: timers, the M4 gang, the HUD objective.
          startCurrentStep(S);
          S.hud.toast("Save loaded — mission " + (S.missions.index + 1));
        }
      }
    }
    menu.classList.add("hidden");
    pauseMenu.classList.add("hidden");
    bustedMenu.classList.add("hidden");
    S.mode = "play";
  }

  $("btnStart").addEventListener("click", () => startGame(false));
  btnContinue.addEventListener("click", () => startGame(true));
  $("btnResume").addEventListener("click", () => {
    pauseMenu.classList.add("hidden");
    S.mode = "play";
  });
  $("btnSaveQuit").addEventListener("click", () => {
    saveGame(S);
    pauseMenu.classList.add("hidden");
    menu.classList.remove("hidden");
    if (hasSave()) btnContinue.classList.remove("hidden");
    S.mode = "menu";
    if (document.pointerLockElement) document.exitPointerLock();
  });
  $("btnRespawn").addEventListener("click", () => {
    const p = S.player;
    p.cash = Math.max(0, p.cash - 100);
    p.health = 100;
    p.armor = 0;
    p.alive = true;
    p.pos.set(180, 0, -140);
    p.group.position.set(180, 0, -140);
    p.group.visible = true;
    p.onFoot = true;
    p.car = null;
    p.boat = null;
    S.police.wanted = 0;
    for (const car of S.police.policeCars) S.scene.remove(car.group);
    S.police.policeCars = [];
    for (const cop of S.police.cops) S.scene.remove(cop.group);
    S.police.cops = [];
    bustedMenu.classList.add("hidden");
    S.mode = "play";
    S.hud.toast("Bailed out — $100. Stay out of trouble.");
  });
}

function wireKeys(S) {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "KeyE" && S.mode === "play") {
      tryEnterExit(S);
    }
    if ((e.code === "KeyP" || e.code === "Escape") && (S.mode === "play" || S.mode === "pause")) {
      const pauseMenu = document.getElementById("pauseMenu");
      if (S.mode === "play") {
        S.mode = "pause";
        pauseMenu.classList.remove("hidden");
        if (document.pointerLockElement) document.exitPointerLock();
      } else {
        S.mode = "play";
        pauseMenu.classList.add("hidden");
      }
    }
    if (e.code === "KeyM") {
      const muted = S.audio.toggleMute();
      S.hud.toast(muted ? "Sound muted" : "Sound on");
    }
  });
}

// Deterministic staged states, one per screenshot. The world is the same
// every load (seeded), so each shot shows the same scene every time.
function stageShot(S, n) {
  const p = S.player;
  const menu = document.getElementById("menu");
  if (n === 4) {
    // Start screen over a live city view; the minimap stays visible.
    S.mode = "menu";
    menu.classList.remove("hidden");
    return;
  }
  menu.classList.add("hidden");
  document.getElementById("pauseMenu").classList.add("hidden");
  document.getElementById("bustedMenu").classList.add("hidden");
  S.mode = "play";

  if (n === 1) {
    // Police chase: driving north on 20th Ave at wanted 3, mission 1 live.
    const car = createCar(S, 20, 0, Math.PI, "player", 0xc0392b);
    car.speed = 12;
    p.car = car;
    p.onFoot = false;
    p.group.visible = false;
    p.carColor = 0xc0392b;
    addWanted(S, 3, "shot");
    const cops = S.police.policeCars;
    // One cruiser head-on ahead (visible in frame), one chasing behind.
    // Far enough ahead that it has not rammed the player when the shot lands.
    if (cops[0]) { cops[0].pos.set(20, 0, -110); cops[0].yaw = 0; cops[0].speed = 20; }
    if (cops[1]) { cops[1].pos.set(24, 0, 62); cops[1].yaw = Math.PI; cops[1].speed = 20; }
  } else if (n === 2) {
    // On foot on 20th Ave with traffic and pedestrians around.
    p.pos.set(20, 0, 40);
    p.group.position.set(20, 0, 40);
    p.camYaw = Math.PI;
    p.camPitch = 0.3;
    const traffic = S.cars.filter((c) => c.kind === "traffic");
    const spots = [[20, -20, 0], [20, 70, Math.PI], [-40, 40, Math.PI / 2]];
    traffic.slice(0, 3).forEach((car, i) => {
      car.pos.set(spots[i][0], 0, spots[i][1]);
      car.yaw = spots[i][2];
      car.group.position.set(spots[i][0], 0, spots[i][1]);
      car.group.rotation.y = spots[i][2];
      car.speed = 8;
    });
    const pedSpots = [[24, 30], [16, 52], [28, 62]];
    S.peds.slice(0, 3).forEach((ped, i) => {
      ped.pos.set(pedSpots[i][0], 0, pedSpots[i][1]);
      ped.group.position.set(pedSpots[i][0], 0, pedSpots[i][1]);
    });
  } else if (n === 3) {
    // v9: street race — driving north on 20th Ave toward the first gate,
    // wanted 2, a cruiser ahead. The car starts at z 70 at speed 28, so
    // at capture (~4 s in) it sits right at the gate ring at z 20.
    const car = createCar(S, 20, 70, Math.PI, "player", 0x2e86c1);
    car.speed = 28;
    p.car = car;
    p.onFoot = false;
    p.group.visible = false;
    p.carColor = 0x2e86c1;
    addWanted(S, 2, "shot");
    startRace(S);
    const cops = S.police.policeCars;
    // Cruiser ahead, parked as a static display car (out of the police
    // list, so the chase AI never moves it): it stays in frame at capture
    // time instead of ramming head-on before the shot lands.
    if (cops[0]) {
      const show = cops[0];
      S.police.policeCars.splice(S.police.policeCars.indexOf(show), 1);
      show.pos.set(20, 0, -60);
      show.group.position.set(20, 0, -60);
      show.yaw = Math.PI;
      show.group.rotation.y = Math.PI;
      show.speed = 0;
    }
    // Clear the road ahead of slow traffic so the shot shows the race.
    for (const car of S.cars) {
      if (car.kind === "traffic" && Math.abs(car.pos.x - 20) < 5 && car.pos.z < 90 && car.pos.z > -80) {
        car.pos.x = 60;
        car.pos.z = Math.max(-220, Math.min(220, car.pos.z));
        car.group.position.set(car.pos.x, 0, car.pos.z);
        if (car.ai) { car.ai.axis = "x"; car.ai.line = car.pos.z; car.yaw = car.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        car.group.rotation.y = car.yaw;
      }
    }
  }
}

function tick(S) {
  const dt = Math.min(S.clock.getDelta(), 0.1);
  S.time += dt;

  if (S.mode === "play") {
    if (S.player.onFoot) updatePlayer(S, dt);
    else if (S.player.boat) updateBoat(S, dt);
    else updateDriving(S, dt);
    updateTraffic(S, dt);
    updatePeds(S, dt);
    updatePolice(S, dt);
    updateMissions(S, dt);
    updatePickups(S, dt);
    // v9: clouds drift around the city; race gates spin while visible;
    // moored boats bob gently on the water.
    if (S.city.clouds) S.city.clouds.rotation.y += dt * 0.004;
    for (const gate of S.missions.raceGates) {
      if (gate.visible) gate.rotation.z += dt * 0.6;
    }
    for (const boat of S.boats) {
      if (boat === S.player.boat) continue;
      boat.bobPhase += dt * 1.4;
      boat.group.position.y = 0.4 + Math.sin(boat.bobPhase) * 0.12;
    }
    S.autosaveTimer += dt;
    if (S.autosaveTimer > 25) {
      S.autosaveTimer = 0;
      saveGame(S);
    }
  } else if (S.mode === "menu") {
    // Live backdrop behind the start screen: traffic and pedestrians
    // keep moving, the camera orbits the city.
    updateTraffic(S, dt);
    updatePeds(S, dt);
    const orbit = S.time * 0.05;
    S.camera.position.set(Math.cos(orbit) * 190, 95, Math.sin(orbit) * 190);
    S.camera.lookAt(0, 0, 40);
  }

  updateHud(S, dt);
  if (S.mode === "play") {
    S.audio.engine(S.player.car ? Math.abs(S.player.car.speed) / 34 : 0);
  } else {
    S.audio.engine(0);
  }
  S.renderer.render(S.scene, S.camera);
}

boot();
