// missions.js — the story: 8 chained missions with markers, plus
// repeatable taxi, delivery and street-race side jobs. A beacon marks
// the current target in the world and on the minimap; the HUD shows
// the objective.
// Harbor Delivery (v9 final) is the boat side job: timed crate runs
// between the three pier ends, paid in cash with a speed bonus.
import * as THREE from "three";
import { randomRoadPoint } from "./city.js";
import { makeRng } from "./random.js";
import { hurtPlayer } from "./player.js";

const MISSIONS = [
  {
    name: "First Run",
    reward: 200,
    steps: [
      { text: "Pick up the package at the courier point", x: 60, z: -80, r: 6 },
      { text: "Deliver the package to the docks", x: -80, z: 100, r: 6 },
    ],
  },
  {
    name: "Taxi Rush",
    reward: 300,
    timer: 90,
    steps: [
      { text: "Pick up the fare at Plaza North", x: 0, z: 52, r: 6 },
      { text: "Drop the fare off — hurry!", x: 150, z: -150, r: 6 },
    ],
  },
  {
    name: "Getaway",
    reward: 400,
    steps: [
      {
        text: "Meet the crew at the plaza",
        x: 0, z: 20, r: 6,
        onArrive(S) {
          S.police.addWanted(3, "getaway heat");
          S.hud.toast("The heat is on — run!");
        },
      },
      { text: "Lose the heat — reach the safehouse", x: -180, z: 180, r: 8 },
    ],
  },
  {
    name: "Turf Defense",
    reward: 500,
    steps: [
      {
        text: "Clear the plaza of the rival crew",
        x: 0, z: 0, r: 30, type: "clear",
        onStart(S) {
          spawnGang(S, 4);
        },
      },
    ],
  },
  {
    name: "The Big One",
    reward: 1000,
    steps: [
      {
        text: "Hit the bank — hold the vault",
        x: 120, z: 100, r: 7, type: "hold", holdTime: 5,
      },
      {
        text: "Escape to the boat on the beach",
        x: 0, z: 262, r: 8,
        onStart(S) {
          S.police.addWanted(3, "bank job");
        },
      },
    ],
  },
  {
    name: "Harbor Run",
    reward: 700,
    steps: [
      {
        text: "Pick up the crate at the harbor containers",
        x: 100, z: 227, r: 7,
        onArrive(S) {
          S.police.addWanted(2, "harbor heat");
          S.hud.toast("The harbor crew saw you — move!");
        },
      },
      {
        text: "Stash the crate in the warehouse",
        x: -100, z: 222, r: 7,
      },
      {
        text: "Slip away by boat — board one at the pier",
        x: 0, z: 296, r: 10, type: "boat",
      },
    ],
  },
  {
    name: "Sunset Sprint",
    reward: 800,
    timer: 75, // matches RACE_TIME — one clock for the sprint, not two
    steps: [
      {
        text: "Race the gates — beat the clock!",
        x: 20, z: 20, r: 10, type: "race",
        onStart(S) {
          startRace(S);
        },
      },
    ],
  },
  {
    name: "King of Surya Bay",
    reward: 1500,
    steps: [
      {
        text: "Take the plaza back from the rival crew",
        x: 0, z: 0, r: 30, type: "clear",
        onStart(S) {
          spawnGang(S, 6);
          S.police.addWanted(2, "turf war");
        },
      },
      {
        text: "Reach the safehouse — the city is yours",
        x: -180, z: 180, r: 8,
        onStart(S) {
          S.hud.toast("One last stretch — lose the heat!");
        },
      },
    ],
  },
];

const STANDS = [
  { x: -60, z: 20, type: "taxi", label: "Press T for a taxi job" },
  { x: 20, z: -60, type: "delivery", label: "Press T for a delivery job" },
  { x: -20, z: 180, type: "race", label: "Press T for a street race" },
  { x: 0, z: 238, type: "harbor", label: "Press T for a harbor delivery" },
];

// v9 street race: five gates around the city, in order, against the clock.
// The same course powers the Sunset Sprint story mission and the
// repeatable side race at the race stand.
const RACE_COURSE = [
  { x: 20, z: 20 },
  { x: 180, z: 20 },
  { x: 180, z: -180 },
  { x: -180, z: -180 },
  { x: -180, z: 180 },
];
const RACE_TIME = 75;

// v9 final: Harbor Delivery — a repeatable boat side job. Crates run
// between the three pier ends, on the clock, for cash. The pickup and
// the drop are always different piers, picked from the mission RNG
// stream so every fresh session offers the same first run.
const HARBOR_PIERS = [
  { x: -140, z: 300, name: "West Pier" },
  { x: 0, z: 306, name: "Central Pier" },
  { x: 140, z: 300, name: "East Pier" },
];
const HARBOR_TIME = 120;
const HARBOR_REACH = 8;

export function startHarborDelivery(S) {
  const m = S.missions;
  const from = m.rng.int(0, HARBOR_PIERS.length - 1);
  let to = m.rng.int(0, HARBOR_PIERS.length - 1);
  if (to === from) to = (to + 1) % HARBOR_PIERS.length;
  const pickup = HARBOR_PIERS[from];
  const drop = HARBOR_PIERS[to];
  const reward = 90 + m.rng.int(0, 60);
  m.sideJob = {
    type: "harbor",
    phase: "pickup",
    pickup: { x: pickup.x, z: pickup.z },
    drop: { x: drop.x, z: drop.z },
    fromName: pickup.name,
    toName: drop.name,
    reward,
    timeLeft: HARBOR_TIME,
  };
  S.hud.toast("Harbor delivery — board a boat, crate at " + pickup.name);
  S.audio.pickup();
}

// The objective line for a side job: harbor runs name their piers,
// count the clock down, and remind the player the crate goes by boat.
function sideJobText(S, job) {
  if (job.type === "harbor") {
    const leg = job.phase === "pickup"
      ? "pick up the crate at " + job.fromName
      : "deliver the crate to " + job.toName;
    const boatNote = S.player.boat ? "" : " — board a boat!";
    return "Harbor Delivery: " + leg + " — $" + job.reward + " — " + Math.ceil(job.timeLeft) + "s left" + boatNote;
  }
  return (job.type === "taxi" ? "Taxi job: " : "Delivery: ") + (job.phase === "pickup" ? "pick up" : "drop off") + " — $" + job.reward;
}

export function startRace(S) {
  const m = S.missions;
  m.race = {
    active: true,
    gate: 0,
    timeLeft: RACE_TIME,
    gates: RACE_COURSE,
    reward: 400,
    mission: m.defs[m.index] && m.defs[m.index].steps[m.stage] && m.defs[m.index].steps[m.stage].type === "race",
  };
  for (const gate of m.raceGates) gate.visible = true;
  S.hud.toast("Race! Hit the gates in order — " + RACE_TIME + "s on the clock");
  S.audio.raceGo();
}

export function updateRace(S, dt) {
  const m = S.missions;
  const race = m.race;
  if (!race || !race.active) return false;
  race.timeLeft -= dt;
  const gate = race.gates[race.gate];
  const d = Math.hypot(effX(S) - gate.x, effZ(S) - gate.z);
  if (d < 8) {
    S.audio.pickup();
    S.hud.toast("Gate " + (race.gate + 1) + "/" + race.gates.length + " — keep going!");
    race.gate += 1;
    if (race.gate >= race.gates.length) {
      race.active = false;
      for (const g of m.raceGates) g.visible = false;
      const timeBonus = Math.round(race.timeLeft) * 5;
      const prize = race.reward + timeBonus;
      S.player.cash += prize;
      S.player.racesWon = (S.player.racesWon || 0) + 1;
      S.audio.missionDone();
      S.hud.toast("Race won! +$" + prize + " (" + S.player.racesWon + " wins)");
      if (race.mission) advanceStep(S);
      return true;
    }
  }
  if (race.timeLeft <= 0) {
    race.active = false;
    for (const g of m.raceGates) g.visible = false;
    S.hud.toast("Out of time — the race is lost. Try again!");
    S.audio.thud();
    if (race.mission) {
      m.stage = 0;
      startCurrentStep(S);
    }
    return false;
  }
  return false;
}

// v9 harbor crew: rival gang members who patrol the container yard and
// jump the player when they get close. They respawn with the story.
function spawnHarborCrew(S) {
  const m = S.missions;
  const rng = makeRng(S.seed + 606);
  for (let i = 0; i < 4; i++) {
    const crewGroup = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x8e1f1f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), shirt);
    body.position.y = 1.1;
    crewGroup.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
    head.position.y = 1.85;
    crewGroup.add(head);
    const x = 60 + rng.range(0, 80);
    const z = 220 + rng.range(0, 20);
    crewGroup.position.set(x, 0, z);
    S.scene.add(crewGroup);
    m.roamers.push({
      group: crewGroup,
      pos: new THREE.Vector3(x, 0, z),
      yaw: 0,
      homeX: x,
      homeZ: z,
      health: 100,
      down: false,
      kind: "roamer",
      punchCooldown: 0,
      walkPhase: rng.next() * 6,
    });
  }
}

function updateRoamers(S, dt) {
  const m = S.missions;
  const p = S.player;
  for (const g of m.roamers) {
    if (g.down) continue;
    g.punchCooldown = Math.max(0, g.punchCooldown - dt);
    const targetX = p.car ? p.car.pos.x : p.pos.x;
    const targetZ = p.car ? p.car.pos.z : p.pos.z;
    const dx = targetX - g.pos.x;
    const dz = targetZ - g.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 35) {
      // Player in range: close in and swing.
      g.yaw = Math.atan2(dx, dz);
      if (d > 2.0) {
        const step = Math.min(4.4 * dt, d - 1.6);
        g.pos.x += (dx / d) * step;
        g.pos.z += (dz / d) * step;
      } else if (p.onFoot && g.punchCooldown <= 0) {
        g.punchCooldown = 1.0;
        hurtPlayer(S, 7, "jumped by a harbor rival");
      }
    } else {
      // Drift back toward the home turf.
      const hx = g.homeX - g.pos.x;
      const hz = g.homeZ - g.pos.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 4) {
        g.yaw = Math.atan2(hx, hz);
        g.pos.x += (hx / hd) * 2.2 * dt;
        g.pos.z += (hz / hd) * 2.2 * dt;
      }
    }
    g.walkPhase += dt * 9;
    g.group.position.set(g.pos.x, 0, g.pos.z);
    g.group.rotation.y = g.yaw;
  }
}

export function createMissions(S) {
  // Beacon: a light pillar and a spinning diamond over the target.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 34, 12, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xffd23d, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  pillar.position.y = 17;
  beacon.add(pillar);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshLambertMaterial({ color: 0xffd23d, emissive: 0x664400 })
  );
  gem.position.y = 7;
  gem.name = "gem";
  beacon.add(gem);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4, 5, 24),
    new THREE.MeshLambertMaterial({ color: 0xffd23d, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  S.scene.add(beacon);

  // Side-job stands get a small cyan ring on the ground.
  for (const stand of STANDS) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 3.4, 20),
      new THREE.MeshLambertMaterial({ color: stand.type === "race" ? 0xff5da2 : 0x4fc3e8, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(stand.x, 0.12, stand.z);
    S.scene.add(m);
  }

  // v9 race gates: tall glowing rings over each course gate, hidden
  // until a race starts.
  const raceGates = [];
  for (const gate of RACE_COURSE) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.5, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0xff5da2, emissive: 0x550022 })
    );
    ring.position.set(gate.x, 4, gate.z);
    ring.visible = false;
    S.scene.add(ring);
    raceGates.push(ring);
  }

  // v9 final: the delivery crate — a bright orange box that marks the
  // pier end the current harbor run is headed for, bobbing over the
  // water until the run is collected or cancelled.
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshLambertMaterial({ color: 0xff7f11, emissive: 0x552200 })
  );
  crate.visible = false;
  S.scene.add(crate);

  S.missions = {
    index: 0,
    stage: 0,
    defs: MISSIONS,
    beacon,
    crate,
    gang: [],
    gangLeft: 0,
    roamers: [],
    race: null,
    raceGates,
    sideJob: null,
    timer: 0,
    holdProgress: 0,
    done: false,
    rng: makeRng(S.seed + 404),
    onGangDown: (g) => onGangDown(S, g),
  };
  spawnHarborCrew(S);
  startCurrentStep(S);
}

export function startCurrentStep(S) {
  const m = S.missions;
  if (m.done) return;
  const def = m.defs[m.index];
  const step = def.steps[m.stage];
  if (!step) return;
  m.timer = def.timer || 0;
  m.holdProgress = 0;
  if (step.onStart) step.onStart(S);
  S.hud.toast("Mission: " + def.name);
  S.hud.setObjective(step.text);
}

function advanceStep(S) {
  const m = S.missions;
  const def = m.defs[m.index];
  m.stage += 1;
  if (m.stage >= def.steps.length) {
    S.player.cash += def.reward;
    S.audio.missionDone();
    S.hud.toast("Mission complete: " + def.name + " — +$" + def.reward);
    m.index += 1;
    m.stage = 0;
    if (m.index >= m.defs.length) {
      m.done = true;
      S.hud.setObjective("Story complete — Surya Bay is yours. Free roam!");
      S.hud.toast("STORY COMPLETE — you run Surya Bay now!");
      return;
    }
  }
  startCurrentStep(S);
}

export function currentTarget(S) {
  const m = S.missions;
  if (m.sideJob) {
    return m.sideJob.phase === "pickup" ? m.sideJob.pickup : m.sideJob.drop;
  }
  if (m.done) return null;
  const step = m.defs[m.index].steps[m.stage];
  return step ? { x: step.x, z: step.z } : null;
}

export function currentObjective(S) {
  const m = S.missions;
  if (m.race && m.race.active) {
    const gate = m.race.gates[m.race.gate];
    const d = Math.hypot(effX(S) - gate.x, effZ(S) - gate.z);
    return {
      text: "RACE — gate " + (m.race.gate + 1) + "/" + m.race.gates.length + " — " + Math.ceil(m.race.timeLeft) + "s left",
      dist: d,
    };
  }
  if (m.sideJob) {
    const job = m.sideJob;
    const t = job.phase === "pickup" ? job.pickup : job.drop;
    const d = Math.hypot(effX(S) - t.x, effZ(S) - t.z);
    return {
      text: sideJobText(S, job),
      dist: d,
    };
  }
  if (m.done) return { text: "Story complete — free roam!", dist: 0 };
  const def = m.defs[m.index];
  const step = def.steps[m.stage];
  const d = Math.hypot(effX(S) - step.x, effZ(S) - step.z);
  let line = "Mission " + (m.index + 1) + "/" + m.defs.length + " — " + def.name + ": " + step.text;
  if (step.type === "clear") line += " (" + (m.gangLeft) + " left)";
  if (step.type === "hold") line += " — hold " + Math.ceil(step.holdTime - m.holdProgress) + "s";
  if (step.type === "race") line += " — gate " + ((m.race && m.race.gate) || 0) + "/" + RACE_COURSE.length;
  if (step.type === "boat" && S.player.boat) {
    // Aboard: the job is sailing out past the piers, so the distance
    // shown is the remaining run to open water, not to the pier.
    return { text: "Mission " + (m.index + 1) + "/" + m.defs.length + " — " + def.name + ": sail out past the piers!", dist: Math.max(0, 320 - S.player.boat.pos.z) };
  }
  if (m.timer > 0) line += " — " + Math.ceil(m.timer) + "s left";
  return { text: line, dist: d };
}

function effX(S) {
  return S.player.car ? S.player.car.pos.x : S.player.pos.x;
}
function effZ(S) {
  return S.player.car ? S.player.car.pos.z : S.player.pos.z;
}

export function updateMissions(S, dt) {
  const m = S.missions;
  // Spin the beacon gem and keep it over the current target.
  const gem = m.beacon.getObjectByName("gem");
  if (gem) gem.rotation.y += dt * 2;
  const target = currentTarget(S);
  if (target) {
    m.beacon.visible = true;
    m.beacon.position.set(target.x, 0, target.z);
  } else {
    m.beacon.visible = false;
  }

  // Side jobs first: T near a stand starts one.
  updateSideJobs(S, dt);
  updateGang(S, dt);
  updateRoamers(S, dt);
  updateRace(S, dt);
  if (m.done) return;

  const def = m.defs[m.index];
  const step = def.steps[m.stage];
  if (!step) return;

  // Mission timer (Taxi Rush / Sunset Sprint): run out and it resets.
  if (def.timer && m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.stage = 0;
      S.hud.toast("Too slow — try again!");
      S.audio.thud();
      startCurrentStep(S);
      return;
    }
  }

  const d = Math.hypot(effX(S) - step.x, effZ(S) - step.z);
  if (step.type === "clear") {
    if (m.gangLeft <= 0) advanceStep(S);
    return;
  }
  if (step.type === "race") {
    // The race itself advances the step when all gates are cleared.
    if (!m.race || !m.race.active) {
      if (!m.race) startRace(S);
    }
    return;
  }
  if (step.type === "boat") {
    // Board a boat and reach the open water past the pier. The piers end
    // at z 306–312 and every boat is moored at z 296–302, so the old
    // z > 290 check completed the step the instant the player boarded —
    // the escape never happened. z > 320 means actually sailing out.
    if (S.player.boat && S.player.boat.pos.z > 320) {
      if (step.onArrive) step.onArrive(S);
      advanceStep(S);
    }
    return;
  }
  if (step.type === "hold") {
    if (d < step.r) {
      m.holdProgress += dt;
      if (m.holdProgress >= step.holdTime) {
        S.player.cash += 150;
        S.hud.toast("Vault cracked — +$150!");
        advanceStep(S);
      }
    } else {
      m.holdProgress = Math.max(0, m.holdProgress - dt * 0.5);
    }
    return;
  }
  if (d < step.r) {
    if (step.onArrive) step.onArrive(S);
    advanceStep(S);
  }
}

function updateSideJobs(S, dt) {
  const m = S.missions;
  const p = S.player;
  if (!m.sideJob) {
    if (p.onFoot && S.input.keys.has("KeyT")) {
      for (const stand of STANDS) {
        const d = Math.hypot(p.pos.x - stand.x, p.pos.z - stand.z);
        if (d < 6) {
          if (stand.type === "race") {
            if (!m.race || !m.race.active) startRace(S);
            S.input.keys.delete("KeyT");
            break;
          }
          if (stand.type === "harbor") {
            startHarborDelivery(S);
            S.input.keys.delete("KeyT");
            break;
          }
          const pickup = randomRoadPoint(m.rng);
          const drop = randomRoadPoint(m.rng);
          const reward = stand.type === "taxi" ? 60 + m.rng.int(0, 60) : 50 + m.rng.int(0, 40);
          m.sideJob = { type: stand.type, phase: "pickup", pickup, drop, reward };
          S.hud.toast(stand.type === "taxi" ? "Taxi job started — pick up the fare" : "Delivery started — pick up the package");
          S.input.keys.delete("KeyT");
          break;
        }
      }
    }
    return;
  }
  const job = m.sideJob;
  if (job.type === "harbor") {
    updateHarborDelivery(S, dt);
    return;
  }
  const t = job.phase === "pickup" ? job.pickup : job.drop;
  const d = Math.hypot(effX(S) - t.x, effZ(S) - t.z);
  if (d < 7) {
    if (job.phase === "pickup") {
      job.phase = "drop";
      S.hud.toast(job.type === "taxi" ? "Fare picked up — drop them off" : "Package picked up — deliver it");
      S.audio.pickup();
    } else {
      p.cash += job.reward;
      S.audio.cash();
      S.hud.toast("Side job done — +$" + job.reward);
      m.sideJob = null;
    }
  }
}

// A harbor run ticks down from HARBOR_TIME and only counts at a pier
// end while the player is aboard a boat — the crate travels by water,
// not on foot. The crate marker rides the leg's pier end so the run
// is visible in the world as well as on the minimap. Reaching a leg's
// pier end advances the run; running the clock out cancels it, and
// finishing pays the fare plus $1 for every second still on the clock.
function updateHarborDelivery(S, dt) {
  const m = S.missions;
  const job = m.sideJob;
  const p = S.player;
  job.timeLeft -= dt;
  if (job.timeLeft <= 0) {
    m.sideJob = null;
    if (m.crate) m.crate.visible = false;
    S.hud.toast("Too slow — the buyer walked away. Delivery cancelled.");
    S.audio.thud();
    return;
  }
  const t = job.phase === "pickup" ? job.pickup : job.drop;
  if (m.crate) {
    m.crate.visible = true;
    m.crate.position.set(t.x, 1.2 + Math.sin(S.time * 2) * 0.2, t.z);
    m.crate.rotation.y += dt * 1.5;
  }
  const d = Math.hypot(effX(S) - t.x, effZ(S) - t.z);
  if (d >= HARBOR_REACH || !p.boat) return;
  if (job.phase === "pickup") {
    job.phase = "drop";
    S.hud.toast("Crate aboard — deliver it to " + job.toName);
    S.audio.pickup();
    return;
  }
  const timeBonus = Math.round(job.timeLeft);
  const payout = job.reward + timeBonus;
  p.cash += payout;
  p.deliveriesDone = (p.deliveriesDone || 0) + 1;
  if (m.crate) m.crate.visible = false;
  S.audio.cash();
  S.hud.toast("Harbor delivery done — +$" + payout + " ($" + job.reward + " + $" + timeBonus + " fast bonus, run #" + p.deliveriesDone + ")");
  m.sideJob = null;
}

export function nearStandHint(S) {
  const p = S.player;
  if (!p.onFoot || S.missions.sideJob) return "";
  for (const stand of STANDS) {
    const d = Math.hypot(p.pos.x - stand.x, p.pos.z - stand.z);
    if (d < 6) return stand.label;
  }
  return "";
}

function spawnGang(S, n) {
  const m = S.missions;
  const rng = makeRng(S.seed + 505 + m.index * 17);
  for (let i = 0; i < n; i++) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0x8e1f1f });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.4), shirt);
    body.position.y = 1.1;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), skin);
    head.position.y = 1.85;
    group.add(head);
    const angle = rng.next() * Math.PI * 2;
    const x = Math.cos(angle) * 18;
    const z = Math.sin(angle) * 18;
    group.position.set(x, 0, z);
    S.scene.add(group);
    m.gang.push({
      group,
      pos: new THREE.Vector3(x, 0, z),
      yaw: 0,
      health: 100,
      down: false,
      kind: "gang",
      punchCooldown: 0,
      walkPhase: rng.next() * 6,
    });
  }
  m.gangLeft = n;
}

function updateGang(S, dt) {
  const m = S.missions;
  const p = S.player;
  for (const g of m.gang) {
    if (g.down) continue;
    g.punchCooldown = Math.max(0, g.punchCooldown - dt);
    const ex = p.car ? p.car.pos.x : p.pos.x;
    const ez = p.car ? p.car.pos.z : p.pos.z;
    const dx = ex - g.pos.x;
    const dz = ez - g.pos.z;
    const d = Math.hypot(dx, dz);
    g.yaw = Math.atan2(dx, dz);
    if (d > 2.0) {
      const step = Math.min(4.6 * dt, d - 1.6);
      g.pos.x += (dx / d) * step;
      g.pos.z += (dz / d) * step;
    } else if (p.onFoot && g.punchCooldown <= 0) {
      g.punchCooldown = 1.0;
      // Gang members punch the player on contact.
      hurtPlayer(S, 7, "jumped by a rival");
    }
    g.walkPhase += dt * 9;
    g.group.position.set(g.pos.x, 0, g.pos.z);
    g.group.rotation.y = g.yaw;
  }
}

export function onGangDown(S, g) {
  const m = S.missions;
  m.gangLeft = Math.max(0, m.gangLeft - 1);
  S.hud.toast("Rival down — " + m.gangLeft + " left");
}
