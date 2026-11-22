// v9 final: the harbor district — piers, containers, cranes, warehouses and a boardwalk — sits on the south edge beside the beach.
// city.js — Surya Bay itself: a seeded 12x12 road grid, buildings with
// varied heights and colors, a beach and sea on the south edge, a plaza
// with a fountain at the centre, and the landmarks missions use (spray
// garage, bank, safehouse, hospital). It also holds the collision
// helpers the player, cars and pedestrians all share.
import * as THREE from "three";
import { makeRng } from "./random.js";

export const GRID = 40; // distance between road centre lines
export const ROADS = [-220, -180, -140, -100, -60, -20, 20, 60, 100, 140, 180, 220];
export const HALF = 240; // playable half-extent; beach starts past +240 z

const PALETTE = [0xf2e6c9, 0xe8b48a, 0xd98c6a, 0x9fc3d8, 0xf5d76e, 0xffffff, 0xc9a0a0, 0x8fb8a0, 0xe0a458, 0x7fa8c9];

function facadeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = "#2c3e50";
  for (let y = 14; y < 250; y += 30) {
    for (let x = 12; x < 120; x += 26) {
      g.fillRect(x, y, 16, 20);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roadTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#3a3f45";
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = "#f5d76e";
  g.fillRect(30, 8, 4, 48);
  g.fillRect(30, 72, 4, 48);
  g.fillStyle = "#e8e8e8";
  g.fillRect(2, 0, 2, 128);
  g.fillRect(60, 0, 2, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 12);
  return t;
}

export function buildCity(S) {
  const rng = makeRng(S.seed);
  const scene = S.scene;
  const city = {
    colliders: [], // {minX, maxX, minZ, maxZ}
    circles: [], // {x, z, r} fountain, palms, lamps
    spray: { x: -180, z: -180 },
    bank: { x: 120, z: 120 },
    safehouse: { x: -180, z: 180 },
    hospital: { x: 180, z: -180 },
    fountain: { x: 0, z: 0, r: 6 },
    beachZ: 244,
    seaZ: 280,
    // v9 Harbor district: piers, containers, cranes, warehouses, boats.
    harbor: {
      piers: [
        { x: -140, z0: 244, z1: 306, w: 10 },
        { x: 0, z0: 244, z1: 312, w: 12 },
        { x: 140, z0: 244, z1: 306, w: 10 },
      ],
      boatSpots: [
        { x: -152, z: 296, yaw: 0 },
        { x: -128, z: 300, yaw: Math.PI },
        { x: 12, z: 302, yaw: 0 },
        { x: -12, z: 296, yaw: Math.PI },
        { x: 152, z: 296, yaw: Math.PI },
      ],
      warehouse: { x: -100, z: 232 },
      containers: { x: 100, z: 232 },
    },
  };

  // Ground: sun-baked grass.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x79a85a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  // Roads: dark strips with a dashed centre line, one per grid line.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const v of ROADS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(9, 480), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(v, 0.05, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(9, 480), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.rotation.z = Math.PI / 2;
    ew.position.set(0, 0.05, v);
    scene.add(ew);
  }

  // Beach sand, then the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 40),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, 262);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 300),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.03, 432);
  scene.add(sea);

  // v9: golden-hour sky — a gradient dome, a low sun disc, and slow clouds.
  buildSky(S, city);
  // v9: the Harbor district on the south shore — piers, containers,
  // cranes, warehouses and moored boats the player can drive.
  buildHarbor(S, city);

  // Central plaza: pavement disc + fountain.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 0.3, 24),
    new THREE.MeshLambertMaterial({ color: 0xcfc4ae })
  );
  plaza.position.set(0, 0.15, 0);
  scene.add(plaza);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0x9aa5ad })
  );
  basin.position.set(0, 0.6, 0);
  scene.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.4, 0.3, 20),
    new THREE.MeshLambertMaterial({ color: 0x4fc3e8 })
  );
  water.position.set(0, 1.1, 0);
  scene.add(water);
  city.circles.push({ x: 0, z: 0, r: 6.5 });

  // Buildings: one or two per block, seeded heights and colors.
  const facade = facadeTexture();
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
  for (let ix = 0; ix < ROADS.length - 1; ix++) {
    for (let iz = 0; iz < ROADS.length - 1; iz++) {
      const cx = (ROADS[ix] + ROADS[ix + 1]) / 2;
      const cz = (ROADS[iz] + ROADS[iz + 1]) / 2;
      // Keep the plaza block and the landmark corners clear of random blocks.
      if (Math.abs(cx) < 30 && Math.abs(cz) < 30) continue;
      if (cz > 225) continue; // beach strip stays open
      const blockRoll = rng.next();
      if (blockRoll < 0.16) {
        // Park: grass + palms, no building.
        plantPalms(S, rng, cx, cz, 3);
        continue;
      }
      const count = blockRoll < 0.6 ? 1 : 2;
      for (let b = 0; b < count; b++) {
        // Twin buildings share a block, so each must fit in half of it:
        // a block is 31 wide and the pair sits at +/-7 from its centre.
        const maxSide = count === 1 ? 22 : 16;
        const w = rng.range(10, maxSide);
        const d = rng.range(10, maxSide);
        const h = rng.range(8, count === 1 ? 46 : 26);
        const ox = count === 1 ? 0 : (b === 0 ? -7 : 7);
        const oz = count === 1 ? 0 : (b === 0 ? -7 : 7);
        const bx = cx + ox;
        const bz = cz + oz;
        const tex = facade.clone();
        tex.needsUpdate = true;
        tex.repeat.set(Math.max(1, Math.round(w / 10)), Math.max(1, Math.round(h / 12)));
        const color = rng.pick(PALETTE);
        const mat = new THREE.MeshLambertMaterial({ map: tex, color });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        mesh.position.set(bx, h / 2, bz);
        scene.add(mesh);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
          new THREE.MeshLambertMaterial({ color: 0x5a4a3a })
        );
        roof.position.set(bx, h + 0.4, bz);
        scene.add(roof);
        city.colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      }
    }
  }

  // Landmarks: spray garage (mint green), bank (tall glass blue),
  // safehouse (small, orange roof), hospital (white + red cross).
  addLandmark(S, city, -180, -180, 20, 10, 16, 0x7fd8a0, "spray");
  addLandmark(S, city, 120, 120, 22, 52, 18, 0x7fb2d8, "bank");
  addLandmark(S, city, -180, 180, 14, 7, 12, 0xf2e6c9, "safehouse");
  addLandmark(S, city, 180, -180, 20, 12, 16, 0xffffff, "hospital");

  // v9: billboards over the avenues — the city advertises itself.
  addBillboard(S, city, -20, -100, "SURYA BAY", 0xffb63d);
  addBillboard(S, city, 60, 180, "HARBOR", 0x4fc3e8);
  addBillboard(S, city, 180, 60, "CASINO", 0xff5da2);

  // Street lamps along the main avenues.
  for (const v of [-180, -60, 60, 180]) {
    for (let t = -200; t <= 200; t += 80) {
      addLamp(S, city, v + 6, t, lampMat, lampHeadMat);
      addLamp(S, city, t, v + 6, lampMat, lampHeadMat);
    }
  }

  // Palms along the beach.
  plantPalms(S, rng, 0, 255, 14);

  S.city = city;
  return city;
}

function buildSky(S, city) {
  // Gradient dome: warm horizon fading to blue overhead, so the sky
  // reads as golden hour instead of a flat fill color.
  const geo = new THREE.SphereGeometry(900, 16, 12);
  const colors = [];
  const top = new THREE.Color(0x3f7ec2);
  const mid = new THREE.Color(0x9fc3dd);
  const low = new THREE.Color(0xffc98a);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const height01 = pos.getY(i) / 900;
    const c = height01 > 0.25 ? top.clone().lerp(mid, 1 - (height01 - 0.25) / 0.75) : mid.clone().lerp(low, 1 - (height01 + 0.1) / 0.35);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
  );
  S.scene.add(dome);
  // Low sun disc in the west, warm and bright.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })
  );
  sun.position.set(-620, 150, -260);
  sun.lookAt(0, 60, 0);
  S.scene.add(sun);
  // Puffy clouds: flattened white spheres that drift around the city.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const rng = makeRng(S.seed + 707);
  for (let i = 0; i < 9; i++) {
    const puff = new THREE.Group();
    const n = 3 + Math.floor(rng.next() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(9, 16), 8, 6), cloudMat);
      s.position.set(j * rng.range(8, 14) - n * 5, rng.range(-2, 2), rng.range(-4, 4));
      s.scale.y = 0.45;
      puff.add(s);
    }
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(180, 420);
    puff.position.set(Math.cos(a) * r, rng.range(150, 220), Math.sin(a) * r);
    clouds.add(puff);
  }
  S.scene.add(clouds);
  city.clouds = clouds;
}

function buildHarbor(S, city) {
  const H = city.harbor;
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x6e5138 });
  // Piers: wooden decks on posts, reaching out over the sea.
  for (const pier of H.piers) {
    const len = pier.z1 - pier.z0;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(pier.w, 0.8, len), deckMat);
    deck.position.set(pier.x, 0.6, (pier.z0 + pier.z1) / 2);
    S.scene.add(deck);
    for (let z = pier.z0 + 4; z < pier.z1; z += 14) {
      for (const dx of [-pier.w / 2 + 0.6, pier.w / 2 - 0.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.6, 6), woodMat);
        post.position.set(pier.x + dx, 0, z);
        S.scene.add(post);
      }
    }
    city.colliders.push({ minX: pier.x - pier.w / 2, maxX: pier.x + pier.w / 2, minZ: pier.z0, maxZ: pier.z1 });
    // Pier edge lamps, so the harbor glows at the waterline.
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lampMat);
    lamp.position.set(pier.x + pier.w / 2 - 0.5, 2.2, pier.z1 - 3);
    S.scene.add(lamp);
  }
  // Shipping containers: stacked, rust-red / blue / green, with colliders.
  const contColors = [0xb03a2e, 0x2471a3, 0x1e8449, 0xca6f1e, 0x7d3c98];
  const rng = makeRng(S.seed + 808);
  let colorIdx = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = H.containers.x - 24 + col * 16;
      const z = H.containers.z - 10 + row * 10;
      const stack = rng.chance(0.4) ? 2 : 1;
      for (let lvl = 0; lvl < stack; lvl++) {
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(12, 2.6, 2.6),
          new THREE.MeshLambertMaterial({ color: contColors[(colorIdx + lvl) % contColors.length] })
        );
        c.position.set(x, 1.3 + lvl * 2.6, z);
        S.scene.add(c);
      }
      city.colliders.push({ minX: x - 6, maxX: x + 6, minZ: z - 1.3, maxZ: z + 1.3 });
      colorIdx++;
    }
  }
  // Two gantry cranes over the container yard.
  for (const cx of [H.containers.x - 30, H.containers.x + 30]) {
    const steel = new THREE.MeshLambertMaterial({ color: 0xf5a623 });
    const legA = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), steel);
    legA.position.set(cx - 4, 17, H.containers.z);
    S.scene.add(legA);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(1.2, 34, 1.2), steel);
    legB.position.set(cx + 4, 17, H.containers.z);
    S.scene.add(legB);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 1.4, 1.4), steel);
    arm.position.set(cx, 33, H.containers.z + 8);
    S.scene.add(arm);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    cab.position.set(cx, 30, H.containers.z);
    S.scene.add(cab);
    city.colliders.push({ minX: cx - 5, maxX: cx + 5, minZ: H.containers.z - 1, maxZ: H.containers.z + 1 });
  }
  // Warehouse sheds at the back of the harbor yard.
  const shedMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ad });
  for (const [wx, wz] of [[H.warehouse.x, H.warehouse.z], [H.warehouse.x + 34, H.warehouse.z]]) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 16), shedMat);
    shed.position.set(wx, 4.5, wz);
    S.scene.add(shed);
    const roof = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 26, 12, 1, false, 0, Math.PI),
      new THREE.MeshLambertMaterial({ color: 0x5a636b })
    );
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = Math.PI / 2;
    roof.position.set(wx, 9, wz);
    S.scene.add(roof);
    city.colliders.push({ minX: wx - 13, maxX: wx + 13, minZ: wz - 8, maxZ: wz + 8 });
  }
  // Boardwalk strip along the sand, with benches.
  const walk = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 8),
    new THREE.MeshLambertMaterial({ color: 0xc9a06a })
  );
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, 0.06, 240);
  S.scene.add(walk);
}

function addBillboard(S, city, x, z, text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#101418";
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = "#" + color.toString(16).padStart(6, "0");
  g.font = "bold 34px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.6, 14, 6),
    new THREE.MeshLambertMaterial({ color: 0x444444 })
  );
  pole.position.set(x, 7, z);
  S.scene.add(pole);
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(16, 4, 0.6),
    new THREE.MeshLambertMaterial({ map: tex, emissive: 0x222222 })
  );
  board.position.set(x, 16, z);
  S.scene.add(board);
  city.colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: z - 0.6, maxZ: z + 0.6 });
}

function addLandmark(S, city, x, z, w, h, d, color, kind) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, h / 2, z);
  S.scene.add(mesh);
  city.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  if (kind === "hospital") {
    const crossMat = new THREE.MeshLambertMaterial({ color: 0xd23c3c });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 0.4), crossMat);
    c1.position.set(x, h + 1.2, z + d / 2 + 0.2);
    S.scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4, 0.4), crossMat);
    c2.position.set(x, h + 1.2, z + d / 2 + 0.2);
    S.scene.add(c2);
  }
  if (kind === "spray") {
    // Green ground ring marks the pay-and-spray bay.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(7, 9, 24),
      new THREE.MeshLambertMaterial({ color: 0x2ecc71, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x + 16, 0.08, z);
    S.scene.add(ring);
    city.sprayBay = { x: x + 16, z };
  }
  if (kind === "safehouse") {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(11, 4, 4),
      new THREE.MeshLambertMaterial({ color: 0xe67e22 })
    );
    roof.position.set(x, h + 2, z);
    roof.rotation.y = Math.PI / 4;
    S.scene.add(roof);
  }
}

function addLamp(S, city, x, z, poleMat, headMat) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5, 6), poleMat);
  pole.position.set(x, 2.5, z);
  S.scene.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), headMat);
  head.position.set(x, 5.1, z);
  S.scene.add(head);
}

function plantPalms(S, rng, cx, cz, n) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e9e5b });
  for (let i = 0; i < n; i++) {
    const x = cx + rng.range(-14, 14);
    const z = cz + rng.range(-14, 14);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.set(x, 3, z);
    S.scene.add(trunk);
    const top = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat);
    top.position.set(x, 6.6, z);
    top.scale.y = 0.6;
    S.scene.add(top);
    S.city?.circles.push({ x, z, r: 0.8 });
  }
}

// Push a circle (x, z, radius r) out of every building AABB and round
// collider. Returns the corrected position and whether it hit anything.
// maxZ lets the player wade out to the boats (z 306); cars and peds
// stay on dry land at 276.
export function collideCircle(S, x, z, r, maxZ = 276) {
  let hit = false;
  const city = S.city;
  for (const b of city.colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = x - (b.minX - r);
        const pr = b.maxX + r - x;
        const pt = z - (b.minZ - r);
        const pb = b.maxZ + r - z;
        const least = Math.min(pl, pr, pt, pb);
        if (least === pl) x = b.minX - r;
        else if (least === pr) x = b.maxX + r;
        else if (least === pt) z = b.minZ - r;
        else z = b.maxZ + r;
      }
    }
  }
  for (const c of city.circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = r + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 0.0001) {
      hit = true;
      const d = Math.sqrt(d2);
      x = c.x + (dx / d) * rr;
      z = c.z + (dz / d) * rr;
    }
  }
  // Keep everything inside the playable area.
  const bound = 236;
  if (x < -bound) { x = -bound; hit = true; }
  if (x > bound) { x = bound; hit = true; }
  if (z < -bound) { z = -bound; hit = true; }
  if (z > maxZ) { z = maxZ; hit = true; }
  return { x, z, hit };
}

export function onRoad(x, z) {
  for (const v of ROADS) {
    if (Math.abs(x - v) < 5.5 || Math.abs(z - v) < 5.5) return true;
  }
  return false;
}

// A random point on a road, with the road's axis and a driving direction.
export function randomRoadPoint(rng) {
  const v = rng.pick(ROADS);
  const t = rng.range(-220, 220);
  if (rng.chance(0.5)) return { x: v, z: t, axis: "z", dir: rng.chance(0.5) ? 1 : -1 };
  return { x: t, z: v, axis: "x", dir: rng.chance(0.5) ? 1 : -1 };
}
