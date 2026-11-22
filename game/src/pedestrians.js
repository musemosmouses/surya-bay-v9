// v9 final: 36 pedestrians on the sidewalks, including the 4-strong harbor crew around the piers.
// pedestrians.js — people on the sidewalks: they wander, cross at
// corners, and run from gunfire, a police chase, or a car bearing
// down on them. Run one over and the wanted level notices.
import * as THREE from "three";
import { collideCircle, ROADS } from "./city.js";
import { makeRng } from "./random.js";

const PED_COUNT = 36; // v9: a busier city — more life on the sidewalks
const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0xfd79a8, 0x00cec9];

export function spawnPeds(S) {
  const rng = makeRng(S.seed + 202);
  S.pedRng = rng;
  S.peds = [];
  for (let i = 0; i < PED_COUNT; i++) {
    const group = makePedMesh(rng.pick(SHIRTS));
    const x = rng.range(-220, 220);
    const z = rng.range(-220, 220);
    group.position.set(x, 0, z);
    S.scene.add(group);
    const ped = {
      group,
      pos: new THREE.Vector3(x, 0, z),
      yaw: rng.range(0, Math.PI * 2),
      speed: rng.range(1.0, 2.0),
      state: "walk",
      stateTimer: rng.range(2, 8),
      health: 100,
      down: false,
      kind: "ped",
      countedCrime: false,
      walkPhase: rng.range(0, 6),
    };
    S.peds.push(ped);
  }
}

function makePedMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b48a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 1.75;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.26), pants);
  legL.position.set(-0.15, 0.32, 0);
  legL.name = "legL";
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  legR.name = "legR";
  group.add(legR);
  return group;
}

export function updatePeds(S, dt) {
  const p = S.player;
  for (const ped of S.peds) {
    if (ped.down) continue;
    ped.stateTimer -= dt;

    // Fear: gunfire, a nearby chase, or a fast car heading at them.
    let danger = null;
    if (S.police.wanted >= 2) {
      const d = Math.hypot(p.pos.x - ped.pos.x, p.pos.z - ped.pos.z);
      if (d < 25) danger = { x: p.pos.x, z: p.pos.z };
    }
    if (!danger) {
      for (const car of S.cars) {
        if (car.kind === "player" && Math.abs(car.speed) > 8) {
          const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
          if (d < 14) { danger = { x: car.pos.x, z: car.pos.z }; break; }
        }
      }
    }
    if (danger && ped.state !== "flee") {
      ped.state = "flee";
      ped.stateTimer = 3;
      // Remember the escape direction: the threat may be gone next frame.
      const fleeDist = Math.hypot(ped.pos.x - danger.x, ped.pos.z - danger.z) || 1;
      ped.fleeDX = (ped.pos.x - danger.x) / fleeDist;
      ped.fleeDZ = (ped.pos.z - danger.z) / fleeDist;
    }
    if (ped.state === "flee" && ped.stateTimer <= 0) {
      ped.state = "walk";
      ped.stateTimer = 2 + S.pedRng.next() * 6;
    }

    if (ped.state === "flee") {
      const nx = ped.pos.x + ped.fleeDX * 4.2 * dt;
      const nz = ped.pos.z + ped.fleeDZ * 4.2 * dt;
      const fixed = collideCircle(S, nx, nz, 0.4);
      ped.pos.x = fixed.x;
      ped.pos.z = fixed.z;
    } else {
      if (ped.stateTimer <= 0) {
        // New direction: mostly along a sidewalk, sometimes across.
        ped.yaw = S.pedRng.next() < 0.7
          ? Math.round(S.pedRng.next() * 4) * (Math.PI / 2)
          : S.pedRng.next() * Math.PI * 2;
        ped.stateTimer = 3 + S.pedRng.next() * 6;
      }
      const nx = ped.pos.x + Math.sin(ped.yaw) * ped.speed * dt;
      const nz = ped.pos.z + Math.cos(ped.yaw) * ped.speed * dt;
      const fixed = collideCircle(S, nx, nz, 0.4);
      ped.pos.x = fixed.x;
      ped.pos.z = fixed.z;
    }

    // Run over by the player's car: down, and the law takes note.
    if (p.car && Math.abs(p.car.speed) > 5 && !ped.countedCrime) {
      const d = Math.hypot(p.car.pos.x - ped.pos.x, p.car.pos.z - ped.pos.z);
      if (d < 2.6) {
        ped.countedCrime = true;
        ped.down = true;
        ped.group.rotation.z = Math.PI / 2;
        ped.group.position.y = 0.3;
        S.police.addWanted(1, "ran over a pedestrian");
        S.hud.toast("You ran someone over — wanted up!");
        S.audio.thud();
      }
    }

    ped.walkPhase += dt * (ped.state === "flee" ? 11 : 6);
    const legSwing = Math.sin(ped.walkPhase) * 0.45;
    ped.group.position.set(ped.pos.x, ped.group.position.y, ped.pos.z);
    ped.group.rotation.y = ped.state === "flee" ? Math.atan2(ped.fleeDX, ped.fleeDZ) : ped.yaw;
    const legL = ped.group.getObjectByName("legL");
    const legR = ped.group.getObjectByName("legR");
    if (legL) legL.rotation.x = legSwing;
    if (legR) legR.rotation.x = -legSwing;
  }
}
