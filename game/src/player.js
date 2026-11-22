// v9 final: the player can wade out to the pier (z 306) and board a boat, as well as steal any car.
// player.js — the player on foot: WASD movement relative to the camera,
// running, punching, the third-person camera, and health / armor.
import * as THREE from "three";
import { collideCircle } from "./city.js";
import { down, takeMouse } from "./input.js";

const WALK_SPEED = 7;
const RUN_SPEED = 12;

export function createPlayer(S) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xe8b48a });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), bodyMat);
  body.position.y = 1.1;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), headMat);
  head.position.y = 1.85;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), legMat);
  legL.position.set(-0.18, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.18;
  group.add(legR);
  const armMat = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.24), armMat);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  // Pistol in the right hand, visible when armed.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  gun.position.set(0.48, 0.85, 0.35);
  gun.name = "gun";
  group.add(gun);
  // v9: a longer shotgun barrel swaps in when the shotgun is equipped.
  const shotgun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.16, 0.95),
    new THREE.MeshLambertMaterial({ color: 0x5a2d0c })
  );
  shotgun.position.set(0.48, 0.85, 0.45);
  shotgun.name = "shotgun";
  shotgun.visible = false;
  group.add(shotgun);
  // Muzzle flash: a bright quad at the barrel tip, shown for one frame.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0, side: THREE.DoubleSide })
  );
  flash.position.set(0.48, 0.85, 0.95);
  flash.name = "flash";
  group.add(flash);

  S.scene.add(group);
  const player = {
    group,
    body,
    legL,
    legR,
    gun,
    shotgun,
    flash,
    pos: new THREE.Vector3(0, 0, 40),
    yaw: 0, // facing direction, radians
    camYaw: Math.PI,
    camPitch: 0.32,
    health: 100,
    armor: 0,
    cash: 100,
    ammo: 12,
    ammoReserve: 48,
    // v9: two weapons — pistol (default) and shotgun (picked up at the harbor).
    weapon: "pistol",
    hasShotgun: false,
    shells: 0,
    shellReserve: 0,
    boat: null,
    racesWon: 0,
    onFoot: true,
    car: null,
    carColor: 0xc0392b,
    speed: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtCooldown: 0,
    flashTimer: 0,
    walkPhase: 0,
    alive: true,
  };
  S.player = player;
  return player;
}

export function updatePlayer(S, dt) {
  const p = S.player;
  const input = S.input;
  if (!p.alive || !p.onFoot) return;

  // Camera orbit from the mouse (or arrow keys when pointer lock is off).
  const { dx, dy } = takeMouse(input);
  p.camYaw -= dx * 0.0028;
  p.camPitch += dy * 0.0022;
  p.camPitch = Math.max(-0.15, Math.min(0.9, p.camPitch));
  if (down(input, "ArrowLeft")) p.camYaw += 1.9 * dt;
  if (down(input, "ArrowRight")) p.camYaw -= 1.9 * dt;
  if (down(input, "ArrowUp")) p.camPitch = Math.max(-0.15, p.camPitch - 0.9 * dt);
  if (down(input, "ArrowDown")) p.camPitch = Math.min(0.9, p.camPitch + 0.9 * dt);

  // Movement relative to the camera.
  let fx = 0;
  let fz = 0;
  if (down(input, "KeyW")) { fx -= Math.sin(p.camYaw); fz -= Math.cos(p.camYaw); }
  if (down(input, "KeyS")) { fx += Math.sin(p.camYaw); fz += Math.cos(p.camYaw); }
  if (down(input, "KeyA")) { fx -= Math.cos(p.camYaw); fz += Math.sin(p.camYaw); }
  if (down(input, "KeyD")) { fx += Math.cos(p.camYaw); fz -= Math.sin(p.camYaw); }
  const len = Math.hypot(fx, fz);
  const running = down(input, "ShiftLeft", "ShiftRight");
  const speed = running ? RUN_SPEED : WALK_SPEED;
  if (len > 0.01) {
    fx /= len;
    fz /= len;
    const nx = p.pos.x + fx * speed * dt;
    const nz = p.pos.z + fz * speed * dt;
    // The player may wade out to z 306 to board a boat; cars stay at 276.
    const fixed = collideCircle(S, nx, nz, 0.55, 306);
    p.pos.x = fixed.x;
    p.pos.z = fixed.z;
    p.speed = speed;
    p.yaw = Math.atan2(fx, fz);
    p.walkPhase += dt * (running ? 11 : 7);
  } else {
    p.speed = 0;
  }

  // Walk swing on the legs, face the movement direction.
  p.group.position.set(p.pos.x, 0, p.pos.z);
  p.group.rotation.y = p.yaw;
  const swing = p.speed > 0.1 ? Math.sin(p.walkPhase) * 0.5 : 0;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;

  // Punch: F, short range, hurts peds, gang and cops in front.
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  if (down(input, "KeyF") && p.punchCooldown <= 0) {
    p.punchCooldown = 0.45;
    S.audio.punch();
    punchHit(S);
  }

  // Weapon switch: Q toggles, 1 pistol, 2 shotgun (once picked up).
  if (down(input, "KeyQ") && !p.switchCooldown) {
    p.switchCooldown = 0.35;
    if (p.hasShotgun) {
      p.weapon = p.weapon === "pistol" ? "shotgun" : "pistol";
      S.hud.toast(p.weapon === "shotgun" ? "Shotgun out — spread the love" : "Pistol out");
      S.audio.click();
    }
  }
  p.switchCooldown = Math.max(0, (p.switchCooldown || 0) - dt);
  if (down(input, "Digit1")) p.weapon = "pistol";
  if (down(input, "Digit2") && p.hasShotgun) p.weapon = "shotgun";
  p.gun.visible = p.weapon === "pistol";
  p.shotgun.visible = p.weapon === "shotgun";

  // Muzzle flash fades fast.
  if (p.flashTimer > 0) {
    p.flashTimer -= dt;
    p.flash.material.opacity = Math.max(0, p.flashTimer * 12);
  }

  // Shoot: mouse click, hitscan toward the camera aim. The shotgun fires
  // a 5-pellet spread; the pistol is one precise round.
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  if (input.mouseDown && p.shootCooldown <= 0) {
    if (p.weapon === "shotgun") {
      if (p.shells > 0) {
        p.shells -= 1;
        p.shootCooldown = 0.7;
        p.flashTimer = 0.09;
        S.audio.shotgun();
        shootHit(S, true);
        if (S.police.wanted < 1) S.police.addWanted(1, "shooting");
      } else {
        p.shootCooldown = 0.3;
        S.audio.click();
      }
    } else if (p.ammo > 0) {
      p.ammo -= 1;
      p.shootCooldown = 0.28;
      p.flashTimer = 0.06;
      S.audio.gunshot();
      shootHit(S, false);
      if (S.police.wanted < 1) S.police.addWanted(1, "shooting");
    } else {
      p.shootCooldown = 0.3;
      S.audio.click();
    }
  }
  if (down(input, "KeyR")) {
    if (p.weapon === "shotgun" && p.shells < 6 && p.shellReserve > 0) {
      const need = 6 - p.shells;
      const take = Math.min(need, p.shellReserve);
      p.shells += take;
      p.shellReserve -= take;
      S.audio.reload();
    } else if (p.weapon === "pistol" && p.ammo < 12 && p.ammoReserve > 0) {
      const need = 12 - p.ammo;
      const take = Math.min(need, p.ammoReserve);
      p.ammo += take;
      p.ammoReserve -= take;
      S.audio.reload();
    }
  }

  p.hurtCooldown = Math.max(0, p.hurtCooldown - dt);
  updatePlayerCamera(S, dt);
}

export function updatePlayerCamera(S, dt) {
  const p = S.player;
  const followDist = 7.5;
  const height = 2.6 + Math.sin(p.camPitch) * 4.5;
  const cx = p.pos.x + Math.sin(p.camYaw) * Math.cos(p.camPitch) * followDist;
  const cz = p.pos.z + Math.cos(p.camYaw) * Math.cos(p.camPitch) * followDist;
  S.camera.position.set(cx, height, cz);
  S.camera.lookAt(p.pos.x, 1.6, p.pos.z);
}

function punchHit(S) {
  const p = S.player;
  const punchReach = 2.6;
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const targets = [];
  for (const ped of S.peds) if (!ped.down) targets.push(ped);
  for (const g of S.missions.gang) if (!g.down) targets.push(g);
  for (const g of S.missions.roamers) if (!g.down) targets.push(g);
  for (const cop of S.police.cops) if (!cop.down) targets.push(cop);
  for (const t of targets) {
    const dx = t.pos.x - p.pos.x;
    const dz = t.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < punchReach && dx * fx + dz * fz > 0) {
      hurtTarget(S, t, 34, "punched");
      break;
    }
  }
}

function shootHit(S, spread) {
  const p = S.player;
  // Aim from the camera through the screen centre.
  const dir = new THREE.Vector3();
  S.camera.getWorldDirection(dir);
  const origin = S.camera.position.clone();
  const targets = [];
  for (const ped of S.peds) if (!ped.down) targets.push({ t: ped, r: 0.7 });
  for (const g of S.missions.gang) if (!g.down) targets.push({ t: g, r: 0.7 });
  for (const g of S.missions.roamers) if (!g.down) targets.push({ t: g, r: 0.7 });
  for (const cop of S.police.cops) if (!cop.down) targets.push({ t: cop, r: 0.7 });
  for (const car of S.cars) {
    if (car.kind === "police") targets.push({ t: car, r: 2.2, car: true });
  }
  // The shotgun fires 5 pellets with a small spread; each pellet that
  // lands hurts. The pistol fires one precise round.
  const pellets = spread ? 5 : 1;
  for (let s = 0; s < pellets; s++) {
    const aim = dir.clone();
    if (spread) {
      aim.x += (Math.random() - 0.5) * 0.09;
      aim.y += (Math.random() - 0.5) * 0.09;
      aim.z += (Math.random() - 0.5) * 0.09;
      aim.normalize();
    }
    let hit = null;
    let hitD = 60;
    for (const entry of targets) {
      if (entry.t.down || entry.t.wrecked) continue;
      const to = new THREE.Vector3(entry.t.pos.x - origin.x, 1.2 - origin.y, entry.t.pos.z - origin.z);
      const along = to.dot(aim);
      if (along < 1 || along > hitD) continue;
      const perp = to.clone().addScaledVector(aim, -along).length();
      if (perp < entry.r + 0.4) {
        hit = entry;
        hitD = along;
      }
    }
    if (hit) {
      S.hud.hitmarker();
      if (hit.car) {
        hurtPoliceCar(S, hit.t, spread ? 18 : 40);
      } else {
        hurtTarget(S, hit.t, spread ? 18 : 50, "shot");
      }
    }
  }
}

export function hurtTarget(S, t, dmg, how) {
  t.health = (t.health ?? 100) - dmg;
  if (t.health <= 0 && !t.down) {
    t.down = true;
    t.group.rotation.z = Math.PI / 2;
    t.group.position.y = 0.3;
    if (t.kind === "gang") {
      S.player.cash += 25;
      S.hud.toast("Gang member down — +$25");
      S.missions.onGangDown(t);
    } else if (t.kind === "roamer") {
      S.player.cash += 25;
      S.hud.toast("Harbor rival down — +$25");
    } else if (t.kind === "cop") {
      S.police.addWanted(1, "cop down");
      S.hud.toast("Officer down — wanted up!");
    } else {
      S.police.addWanted(1, "ped " + how);
      S.hud.toast("Pedestrian " + how + " — wanted up!");
    }
    S.audio.thud();
  }
}

function hurtPoliceCar(S, car, dmg) {
  car.health = (car.health ?? 100) - dmg;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    car.group.rotation.z = 0.2;
    S.player.cash += 50;
    S.hud.toast("Police car wrecked — +$50");
    S.police.addWanted(1, "wrecked a cruiser");
  }
}

export function hurtPlayer(S, dmg, from) {
  const p = S.player;
  if (!p.alive || p.hurtCooldown > 0) return;
  p.hurtCooldown = 0.5;
  let remaining = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, remaining);
    p.armor -= absorbed;
    remaining -= absorbed;
  }
  p.health -= remaining;
  S.audio.hurt();
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    S.mode = "busted";
    S.audio.busted();
    document.getElementById("bustedMenu").classList.remove("hidden");
    document.getElementById("crosshair").style.display = "none";
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
