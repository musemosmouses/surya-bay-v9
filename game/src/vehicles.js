// v9 final: five drivable boats join the cars — board from a pier, sail the harbor, deliver cargo.
// vehicles.js — cars: the mesh factory, arcade driving physics, and the
// E key that lets the player steal and drive any car on the street.
// Boats live here too: the speedboat mesh, boarding, and water driving.
import * as THREE from "three";
import { collideCircle } from "./city.js";
import { makeRng } from "./random.js";
import { down } from "./input.js";

const CAR_COLORS = [0xc0392b, 0x2e86c1, 0xf5d76e, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x16a085, 0xd35400];

export function makeCarMesh(color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2833 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    group.add(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x555533 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    l.position.set(x, 0.6, 2.22);
    group.add(l);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xd23c3c, emissive: 0x330000 });
  for (const x of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    l.position.set(x, 0.6, -2.22);
    group.add(l);
  }
  return group;
}

export function createCar(S, x, z, yaw, kind, color) {
  const group = makeCarMesh(color);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  S.scene.add(group);
  const car = {
    group,
    pos: new THREE.Vector3(x, 0, z),
    yaw,
    speed: 0,
    color,
    kind, // 'parked' | 'traffic' | 'police' | 'player'
    health: 100,
    wrecked: false,
    driver: kind === "traffic" ? "ai" : null,
    ai: null, // traffic AI state, set by traffic.js
    stuckTimer: 0,
  };
  S.cars.push(car);
  return car;
}

export function spawnParkedCars(S, rng) {
  const spots = [
    [24, 60], [64, -20], [-64, 100], [100, 140], [-100, -60], [140, 20],
    [20, -100], [-140, 60], [180, 100], [-20, 180], [60, -140], [-180, -100],
  ];
  for (const [x, z] of spots) {
    const color = rng.pick(CAR_COLORS);
    createCar(S, x, z, rng.range(0, Math.PI * 2), "parked", color);
  }
}

// v9: boats — a speedboat hull with a windshield and an outboard motor.
// They float on the sea past the beach and moor at the harbor piers.
export function makeBoatMesh(color) {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 6.4), hullMat);
  hull.position.y = 0.6;
  group.add(hull);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.0, 4), hullMat);
  nose.rotation.x = Math.PI / 2;
  nose.rotation.y = Math.PI / 4;
  nose.scale.set(1, 1, 0.6);
  nose.position.set(0, 0.6, 4.1);
  group.add(nose);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 3.4), new THREE.MeshLambertMaterial({ color: 0xecf0f1 }));
  deck.position.set(0, 1.1, -0.6);
  group.add(deck);
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.8, 0.15),
    new THREE.MeshLambertMaterial({ color: 0x1c2833 })
  );
  windshield.position.set(0, 1.6, 0.9);
  windshield.rotation.x = -0.3;
  group.add(windshield);
  const motor = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 1.0, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
  );
  motor.position.set(0, 0.7, -3.4);
  group.add(motor);
  return group;
}

export function createBoat(S, x, z, yaw, color) {
  const group = makeBoatMesh(color);
  group.position.set(x, 0.4, z);
  group.rotation.y = yaw;
  S.scene.add(group);
  const boat = {
    group,
    pos: new THREE.Vector3(x, 0, z),
    yaw,
    speed: 0,
    color,
    kind: "boat",
    bobPhase: Math.random() * 6,
  };
  S.boats.push(boat);
  return boat;
}

export function spawnBoats(S) {
  const rng = makeRng(S.seed + 909);
  const colors = [0xe74c3c, 0x2e86c1, 0xf5d76e, 0x16a085, 0x8e44ad];
  for (const spot of S.city.harbor.boatSpots) {
    createBoat(S, spot.x, spot.z, spot.yaw, rng.pick(colors));
  }
}

// The player driving the boat they boarded: faster than any car on the
// water, wide turns, gentle bobbing. E steps off onto the nearest pier.
export function updateBoat(S, dt) {
  const p = S.player;
  const boat = p.boat;
  if (!boat || p.onFoot) return;
  const input = S.input;
  const throttle = down(input, "KeyW") ? 11 : 0;
  const brake = down(input, "KeyS") ? 14 : 0;
  let steer = 0;
  if (down(input, "KeyA")) steer += 1;
  if (down(input, "KeyD")) steer -= 1;
  boat.speed += throttle * dt;
  if (brake > 0) boat.speed -= brake * dt * (boat.speed > 0 ? 1 : -0.4);
  boat.speed -= boat.speed * 0.22 * dt;
  boat.speed = Math.max(-6, Math.min(27, boat.speed));
  if (Math.abs(boat.speed) < 0.05 && throttle === 0) boat.speed = 0;
  boat.yaw += steer * 1.1 * dt * Math.min(1, Math.abs(boat.speed) / 8) * (boat.speed >= 0 ? 1 : -1);
  const fx = Math.sin(boat.yaw);
  const fz = Math.cos(boat.yaw);
  boat.pos.x += fx * boat.speed * dt;
  boat.pos.z += fz * boat.speed * dt;
  // Stay in the water: the beach at z 244 is the shoreline.
  boat.pos.x = Math.max(-270, Math.min(270, boat.pos.x));
  boat.pos.z = Math.max(248, Math.min(420, boat.pos.z));
  boat.bobPhase += dt * 2;
  boat.group.position.set(boat.pos.x, 0.4 + Math.sin(boat.bobPhase) * 0.15, boat.pos.z);
  boat.group.rotation.y = boat.yaw;
  boat.group.rotation.z = Math.sin(boat.bobPhase * 0.7) * 0.02;
  p.pos.set(boat.pos.x, 0, boat.pos.z);
  p.speed = Math.abs(boat.speed);
  p.group.visible = false;
  const dist = 10.5;
  const cx = boat.pos.x - Math.sin(boat.yaw) * dist;
  const cz = boat.pos.z - Math.cos(boat.yaw) * dist;
  S.camera.position.set(cx, 5.0, cz);
  S.camera.lookAt(boat.pos.x + fx * 7, 1.2, boat.pos.z + fz * 7);
  S.audio.engine(Math.abs(boat.speed) / 27);
}

// The player driving the car they are in. Arcade physics: accelerate,
// brake, steer harder at low speed, handbrake for sharp turns.
export function updateDriving(S, dt) {
  const p = S.player;
  const car = p.car;
  if (!car || p.onFoot) return;
  const input = S.input;

  // v9: only shot 1 (the chase) cruises — shot 3 (the race) stages its
  // speed by hand so the car is at the first gate when the shot lands.
  const cruise = S.shot === 1;
  const accel = down(input, "KeyW") || cruise ? 14 : 0;
  const brake = down(input, "KeyS") ? 18 : 0;
  const handbrake = down(input, "Space");
  let steer = 0;
  if (down(input, "KeyA")) steer += 1;
  if (down(input, "KeyD")) steer -= 1;

  car.speed += accel * dt;
  if (brake > 0) {
    car.speed -= brake * dt * (car.speed > 0 ? 1 : -0.4);
  }
  // Drag and rolling resistance, stronger with the handbrake.
  car.speed -= car.speed * (handbrake ? 1.6 : 0.35) * dt;
  car.speed = Math.max(-9, Math.min(34, car.speed));
  if (Math.abs(car.speed) < 0.05 && accel === 0) car.speed = 0;

  // Steering follows the speed; reverse flips it.
  const steerAmount = steer * 1.9 * dt * Math.min(1, Math.abs(car.speed) / 8) * (car.speed >= 0 ? 1 : -1);
  car.yaw += steerAmount * (handbrake ? 1.6 : 1);

  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const nx = car.pos.x + fx * car.speed * dt;
  const nz = car.pos.z + fz * car.speed * dt;
  const fixed = collideCircle(S, nx, nz, 2.1);
  if (fixed.hit && Math.abs(car.speed) > 4) {
    car.speed *= 0.45;
    S.audio.crash();
  }
  car.pos.x = fixed.x;
  car.pos.z = fixed.z;
  car.group.position.set(car.pos.x, 0, car.pos.z);
  car.group.rotation.y = car.yaw;

  // The player rides along: feet off the ground, body hidden in the car.
  p.pos.set(car.pos.x, 0, car.pos.z);
  p.speed = Math.abs(car.speed);
  p.group.visible = false;

  // Bumping other cars: slow both, push the other one aside.
  for (const other of S.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.pos.x - car.pos.x;
    const dz = other.pos.z - car.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.2 && d > 0.01) {
      const push = (4.2 - d) / 2;
      other.pos.x += (dx / d) * push;
      other.pos.z += (dz / d) * push;
      other.group.position.set(other.pos.x, 0, other.pos.z);
      if (Math.abs(car.speed) > 6) {
        car.speed *= 0.7;
        if (other.kind === "traffic" || other.kind === "parked") {
          S.police.addWanted(0, "bump");
        }
      }
    }
  }

  // Chase camera: behind and above the car, looking ahead.
  const dist = 9.5;
  const cx = car.pos.x - Math.sin(car.yaw) * dist;
  const cz = car.pos.z - Math.cos(car.yaw) * dist;
  S.camera.position.set(cx, 4.2, cz);
  S.camera.lookAt(car.pos.x + fx * 6, 1.4, car.pos.z + fz * 6);

  S.audio.engine(Math.abs(car.speed) / 34);
}

// E enters the nearest car (stealing it is a crime); E again exits.
// v9: near the water, E boards the nearest moored boat instead.
export function tryEnterExit(S) {
  const p = S.player;
  if (!p.alive) return;
  if (p.boat) {
    exitBoat(S);
    return;
  }
  if (p.onFoot) {
    let best = null;
    let bestD = 4.5;
    for (const car of S.cars) {
      if (car.wrecked) continue;
      const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    if (best) {
      enterCar(S, best);
      return;
    }
    // No car close by: try a boat (only on the beach or a pier).
    let boat = null;
    let nearestBoat = 5.5;
    for (const b of S.boats) {
      const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
      if (d < nearestBoat) {
        boat = b;
        nearestBoat = d;
      }
    }
    if (boat) boardBoat(S, boat);
  } else {
    exitCar(S);
  }
}

export function boardBoat(S, boat) {
  const p = S.player;
  p.boat = boat;
  p.onFoot = false;
  p.group.visible = false;
  S.hud.toast("Boarded the boat — W to throttle, E to step off.");
  S.audio.door();
}

export function exitBoat(S) {
  const p = S.player;
  const boat = p.boat;
  if (!boat) return;
  // Step off into the shallow water beside the boat — the player wades,
  // so the landing just needs to be clear of the piers, not on dry land.
  const stepOff = boat.pos.x > 0 ? -4.5 : 4.5;
  const bx = Math.max(-270, Math.min(270, boat.pos.x + stepOff));
  const bz = Math.max(248, Math.min(300, boat.pos.z));
  const fixed = collideCircle(S, bx, bz, 0.55, 306);
  p.pos.set(fixed.x, 0, fixed.z);
  p.group.position.set(p.pos.x, 0, p.pos.z);
  p.group.visible = true;
  p.onFoot = true;
  p.boat = null;
  boat.speed = 0;
  S.audio.door();
}

export function enterCar(S, car) {
  const p = S.player;
  const wasTraffic = car.kind === "traffic";
  const wasPolice = car.kind === "police";
  const alreadyOwned = !!car.playerOwned;
  car.kind = "player";
  car.driver = "player";
  p.car = car;
  p.onFoot = false;
  p.group.visible = false;
  p.carColor = car.color;
  if (wasPolice) {
    // A stolen cruiser leaves the force: the chase AI must not keep
    // driving it, and the surplus-pop must never stand it down.
    const idx = S.police.policeCars.indexOf(car);
    if (idx >= 0) S.police.policeCars.splice(idx, 1);
  }
  if (alreadyOwned) {
    // Getting back into your own car is free: the theft was paid once.
    S.hud.toast("Back in your car.");
  } else if (wasPolice) {
    car.playerOwned = true;
    S.police.addWanted(2, "stole a cruiser");
    S.hud.toast("You stole a police cruiser!");
  } else if (wasTraffic) {
    car.playerOwned = true;
    S.police.addWanted(1, "carjacked");
    S.hud.toast("Carjacked! The driver ran off.");
  } else {
    car.playerOwned = true;
    S.police.addWanted(1, "stole a parked car");
    S.hud.toast("Hot-wired a parked car!");
  }
  S.audio.door();
}

export function exitCar(S) {
  const p = S.player;
  const car = p.car;
  if (!car) return;
  // Step out to the side of the car.
  const side = 2.8;
  const px = car.pos.x + Math.cos(car.yaw) * side;
  const pz = car.pos.z - Math.sin(car.yaw) * side;
  const fixed = collideCircle(S, px, pz, 0.55);
  p.pos.set(fixed.x, 0, fixed.z);
  p.group.position.set(p.pos.x, 0, p.pos.z);
  p.group.visible = true;
  p.onFoot = true;
  p.car = null;
  car.speed = 0;
  // The car keeps its kind: a stolen car stays the player's ride to retake.
  car.kind = "parked";
  car.driver = null;
  S.audio.door();
}
