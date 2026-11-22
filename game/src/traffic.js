// v9 final: traffic cars still run the road grid while the new boats run the water — two fleets, one city.
// traffic.js — AI cars that drive the road grid: they keep to their lane,
// turn at intersections, brake for the car ahead, and stay near the
// player by respawning on a nearby road when they drift too far away.
import { ROADS, randomRoadPoint } from "./city.js";
import { createCar } from "./vehicles.js";
import { makeRng } from "./random.js";

const TRAFFIC_COUNT = 14;

export function spawnTraffic(S) {
  const rng = makeRng(S.seed + 101);
  S.trafficRng = rng;
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const spot = randomRoadPoint(rng);
    const car = createCar(S, spot.x, spot.z, spot.axis === "z" ? (spot.dir > 0 ? 0 : Math.PI) : (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2), "traffic", 0x888888);
    // Recolor each traffic car from the shared palette.
    car.group.children[0].material = car.group.children[0].material.clone();
    car.group.children[0].material.color.setHex(pickColor(rng));
    car.ai = {
      axis: spot.axis,
      line: spot.axis === "z" ? spot.x : spot.z,
      dir: spot.dir,
      speed: rng.range(8, 13),
      targetSpeed: rng.range(8, 13),
      turnCooldown: rng.range(1, 4),
    };
    car.speed = car.ai.speed;
  }
}

function pickColor(rng) {
  const palette = [0xc0392b, 0x2e86c1, 0xf5d76e, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x16a085, 0x95a5a6];
  return palette[Math.floor(rng.next() * palette.length)];
}

function nearestRoad(v) {
  let closest = ROADS[0];
  for (const r of ROADS) if (Math.abs(r - v) < Math.abs(closest - v)) closest = r;
  return closest;
}

export function updateTraffic(S, dt) {
  const p = S.player;
  const effX = p.pos.x;
  const effZ = p.pos.z;
  for (const car of S.cars) {
    if (car.kind !== "traffic" || car.wrecked) continue;
    const ai = car.ai;
    if (!ai) continue;
    ai.turnCooldown -= dt;

    // Where the car is heading, and what is in front of it.
    const fx = Math.sin(car.yaw);
    const fz = Math.cos(car.yaw);
    let blocked = false;
    for (const other of S.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.pos.x - car.pos.x;
      const dz = other.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 11 && side < 2.6) { blocked = true; break; }
    }
    // The player on foot in the road also makes traffic brake.
    if (!blocked && p.onFoot) {
      const dx = p.pos.x - car.pos.x;
      const dz = p.pos.z - car.pos.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 9 && side < 2.4) blocked = true;
    }

    const target = blocked ? 0 : ai.targetSpeed;
    car.speed += (target - car.speed) * Math.min(1, 2.2 * dt);

    // Turn at intersections: snap onto the crossing road.
    const alongPos = ai.axis === "z" ? car.pos.z : car.pos.x;
    let nearest = ROADS[0];
    for (const v of ROADS) if (Math.abs(v - alongPos) < Math.abs(nearest - alongPos)) nearest = v;
    if (ai.turnCooldown <= 0 && Math.abs(alongPos - nearest) < 2.5 && S.trafficRng.next() < 0.35) {
      ai.turnCooldown = 3 + S.trafficRng.next() * 4;
      // Turn onto the crossing road: the line becomes the intersection
      // just reached (the along-coordinate snaps to its road line).
      const newLine = nearest;
      const newDir = S.trafficRng.next() < 0.5 ? 1 : -1;
      if (ai.axis === "z") {
        car.pos.z = newLine;
        ai.axis = "x";
        ai.line = newLine;
        ai.dir = newDir;
        car.yaw = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.pos.x = newLine;
        ai.axis = "z";
        ai.line = newLine;
        ai.dir = newDir;
        car.yaw = newDir > 0 ? 0 : Math.PI;
      }
    }

    // Drive along the lane, gently correcting drift back to the line.
    const speed = car.speed * ai.dir;
    if (ai.axis === "z") {
      car.pos.z += speed * dt;
      car.pos.x += (ai.line - car.pos.x) * Math.min(1, 1.5 * dt);
    } else {
      car.pos.x += speed * dt;
      car.pos.z += (ai.line - car.pos.z) * Math.min(1, 1.5 * dt);
    }
    car.group.position.set(car.pos.x, 0, car.pos.z);
    car.group.rotation.y = car.yaw;

    // Too far from the player: respawn on a nearby road.
    const distToPlayer = Math.hypot(car.pos.x - effX, car.pos.z - effZ);
    if (distToPlayer > 320) {
      const spot = randomRoadPoint(S.trafficRng);
      // Bias the respawn toward the player's neighbourhood, then snap the
      // cross coordinate onto the nearest road line so it stays on asphalt.
      car.pos.x = Math.max(-220, Math.min(220, spot.x * 0.4 + effX * 0.6));
      car.pos.z = Math.max(-220, Math.min(220, spot.z * 0.4 + effZ * 0.6));
      ai.axis = spot.axis;
      if (spot.axis === "z") {
        car.pos.x = nearestRoad(car.pos.x);
        ai.line = car.pos.x;
      } else {
        car.pos.z = nearestRoad(car.pos.z);
        ai.line = car.pos.z;
      }
      ai.dir = spot.dir;
      car.yaw = spot.axis === "z" ? (spot.dir > 0 ? 0 : Math.PI) : (spot.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      car.speed = ai.targetSpeed;
    }
  }
}
