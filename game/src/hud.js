// v9 final: HUD adds the mission counter (x/8), race line, weapon name, boat speed, and harbor/boat/gate blips on the minimap.
// hud.js — the HUD: health/armor/cash/ammo, wanted stars, the mission
// objective line, speed, toasts, hints, and the canvas 2D minimap
// (roads, player, police, cars, mission marker, harbor, race gates).
import { ROADS } from "./city.js";
import { currentObjective, currentTarget, nearStandHint } from "./missions.js";

export function createHud(S) {
  const $ = (id) => document.getElementById(id);
  const hud = {
    el: {
      health: $("healthFill"),
      armor: $("armorFill"),
      cash: $("cash"),
      ammo: $("ammo"),
      stars: $("stars"),
      objective: $("objective"),
      speed: $("speed"),
      toast: $("toast"),
      hint: $("hint"),
      crosshair: $("crosshair"),
      hitmarker: $("hitmarker"),
      flash: $("wantedFlash"),
      map: $("minimap"),
    },
    mapCtx: $("minimap").getContext("2d"),
    toastTimer: 0,
    hitTimer: 0,
    objectiveText: "",
  };
  S.hud = hud;
  hud.toast = (msg) => {
    hud.el.toast.textContent = msg;
    hud.el.toast.style.opacity = "1";
    hud.toastTimer = 2.6;
  };
  hud.hitmarker = () => {
    hud.el.hitmarker.style.opacity = "1";
    hud.hitTimer = 0.25;
  };
  hud.setObjective = (text) => {
    hud.objectiveText = text;
  };
  return hud;
}

export function updateHud(S, dt) {
  const hud = S.hud;
  const p = S.player;
  hud.el.health.style.width = Math.max(0, p.health) + "%";
  hud.el.armor.style.width = Math.max(0, Math.min(100, p.armor)) + "%";
  hud.el.cash.textContent = "$" + Math.round(p.cash);
  // v9: the ammo line names the weapon currently in hand.
  hud.el.ammo.textContent = p.weapon === "shotgun"
    ? "SHOTGUN — " + p.shells + " / " + p.shellReserve
    : "PISTOL — " + p.ammo + " / " + p.ammoReserve;

  // Hitmarker fade.
  if (hud.hitTimer > 0) {
    hud.hitTimer -= dt;
    if (hud.hitTimer <= 0) hud.el.hitmarker.style.opacity = "0";
  }

  // Wanted stars: filled gold up to the level, dim beyond it.
  let starRow = "";
  for (let i = 0; i < 5; i++) {
    starRow += i < S.police.wanted ? "★" : '<span class="off">★</span>';
  }
  hud.el.stars.innerHTML = starRow;

  // Objective line: mission text + distance to the marker.
  const obj = currentObjective(S);
  const rangeText = obj.dist > 1 ? " — " + Math.round(obj.dist) + "m" : "";
  hud.el.objective.innerHTML = "<b>" + escapeHtml(obj.text) + "</b>" + rangeText;

  // Speed, only while driving (car or boat).
  if (p.car && !p.onFoot) {
    hud.el.speed.innerHTML = Math.round(Math.abs(p.car.speed) * 3.4) + ' <small>km/h</small>';
  } else if (p.boat && !p.onFoot) {
    hud.el.speed.innerHTML = Math.round(Math.abs(p.boat.speed) * 3.4) + ' <small>kn</small>';
  } else {
    hud.el.speed.textContent = "";
  }

  // Toast fade.
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.el.toast.style.opacity = "0";
  }

  // Context hint at the bottom of the screen.
  let hint = "";
  if (S.mode === "play") {
    if (p.boat) {
      hint = "E step off · W throttle · mind the piers";
    } else if (p.onFoot) {
      let nearestCar = 4.5;
      for (const car of S.cars) {
        if (car.wrecked) continue;
        const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
        if (d < nearestCar) nearestCar = d;
      }
      if (nearestCar < 4.5) hint = "Press E to enter the car";
      else if (p.pos.z > 238) {
        let nearestBoat = 5.5;
        for (const b of S.boats) {
          const d = Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z);
          if (d < nearestBoat) nearestBoat = d;
        }
        hint = nearestBoat < 5.5 ? "Press E to board the boat" : nearStandHint(S);
      } else hint = nearStandHint(S);
    } else {
      hint = "E exit car · SPACE handbrake · P pause";
    }
  }
  hud.el.hint.textContent = hint;

  // Crosshair on foot, hidden in a car or in menus.
  hud.el.crosshair.style.display = S.mode === "play" && p.onFoot ? "block" : "none";

  // Red edge flash while wanted, pulsing.
  hud.el.flash.style.opacity = S.police.wanted > 0 && S.mode === "play"
    ? String(0.35 + 0.3 * Math.sin(S.time * 5))
    : "0";

  drawMinimap(S);
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function drawMinimap(S) {
  const ctx = S.hud.mapCtx;
  const W = 180;
  const scale = W / 560; // world -280..280 maps to 0..180
  const mx = (x) => (x + 280) * scale;
  const my = (z) => (z + 280) * scale;

  ctx.fillStyle = "#10202e";
  ctx.fillRect(0, 0, W, W);
  // Sea at the south edge, beach above it.
  ctx.fillStyle = "#2e86c1";
  ctx.fillRect(0, my(280), W, W - my(280));
  ctx.fillStyle = "#e8d29a";
  ctx.fillRect(0, my(244), W, my(280) - my(244));
  // Roads.
  ctx.strokeStyle = "#5a636b";
  ctx.lineWidth = 2;
  for (const v of ROADS) {
    ctx.beginPath(); ctx.moveTo(mx(v), 0); ctx.lineTo(mx(v), W); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, my(v)); ctx.lineTo(W, my(v)); ctx.stroke();
  }
  // Buildings as dark blocks.
  ctx.fillStyle = "#233140";
  for (const b of S.city.colliders) {
    ctx.fillRect(mx(b.minX), my(b.minZ), Math.max(1, (b.maxX - b.minX) * scale), Math.max(1, (b.maxZ - b.minZ) * scale));
  }
  // Spray garage (the bay ring, not the building) and safehouse.
  ctx.fillStyle = "#2ecc71";
  const sprayAt = S.city.sprayBay || S.city.spray;
  ctx.fillRect(mx(sprayAt.x) - 2, my(sprayAt.z) - 2, 4, 4);
  ctx.fillStyle = "#e67e22";
  ctx.fillRect(mx(S.city.safehouse.x) - 2, my(S.city.safehouse.z) - 2, 4, 4);
  // v9 harbor: piers reaching into the sea, boats as white dots.
  ctx.fillStyle = "#8a6a45";
  for (const pier of S.city.harbor.piers) {
    ctx.fillRect(mx(pier.x - pier.w / 2), my(pier.z0), (pier.w) * scale, (pier.z1 - pier.z0) * scale);
  }
  ctx.fillStyle = "#ffffff";
  for (const boat of S.boats) {
    ctx.beginPath();
    ctx.arc(mx(boat.pos.x), my(boat.pos.z), 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // v9 race: the next gate glows pink on the map.
  if (S.missions.race && S.missions.race.active) {
    const gate = S.missions.race.gates[S.missions.race.gate];
    ctx.fillStyle = "#ff5da2";
    ctx.beginPath();
    ctx.arc(mx(gate.x), my(gate.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission target.
  const target = currentTarget(S);
  if (target) {
    ctx.fillStyle = "#ffd23d";
    ctx.beginPath();
    ctx.arc(mx(target.x), my(target.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd23d";
    ctx.beginPath();
    ctx.arc(mx(target.x), my(target.z), 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Traffic cars, then pedestrians.
  ctx.fillStyle = "#ffffff";
  for (const car of S.cars) {
    if (car.kind === "traffic" || car.kind === "parked") {
      ctx.fillRect(mx(car.pos.x) - 1, my(car.pos.z) - 1, 2, 2);
    }
  }
  ctx.fillStyle = "#9aa5ad";
  for (const ped of S.peds) {
    if (!ped.down) ctx.fillRect(mx(ped.pos.x) - 1, my(ped.pos.z) - 1, 2, 2);
  }
  // Police cruisers and foot cops.
  ctx.fillStyle = "#ff3b30";
  for (const car of S.police.policeCars) {
    ctx.beginPath();
    ctx.arc(mx(car.pos.x), my(car.pos.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of S.police.cops) {
    ctx.fillRect(mx(cop.pos.x) - 1, my(cop.pos.z) - 1, 2, 2);
  }
  // The player: a green triangle pointing where they face.
  const p = S.player;
  const yaw = p.car ? p.car.yaw : p.yaw;
  ctx.fillStyle = "#3ddc5a";
  ctx.save();
  ctx.translate(mx(p.pos.x), my(p.pos.z));
  ctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) + Math.PI);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
