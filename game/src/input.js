// v9 final: keyboard + mouse state still feeds every system, from the harbor stand to the shotgun.
// input.js — keyboard + mouse state. The game reads keys by code, and
// the camera reads the mouse deltas that pointer lock produces. Arrow
// keys also turn the camera, so the game stays playable without pointer lock.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    locked: false,
    anyKey: false,
  };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") e.preventDefault();
    if (!e.repeat) input.anyKey = true;
    input.keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => input.keys.delete(e.code));
  window.addEventListener("blur", () => input.keys.clear());

  canvas.addEventListener("click", () => {
    if (!input.locked && document.pointerLockElement !== canvas) {
      try {
        canvas.requestPointerLock();
      } catch (err) {
        // Pointer lock is a nicety, not a requirement.
      }
    }
  });
  document.addEventListener("pointerlockchange", () => {
    input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener("mousemove", (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX ?? 0;
      input.mouseDY += e.movementY ?? 0;
    }
  });
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) input.mouseDown = true;
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) input.mouseDown = false;
  });

  return input;
}

export function down(input, ...codes) {
  for (const c of codes) if (input.keys.has(c)) return true;
  return false;
}

// Consume the accumulated mouse deltas (call once per frame).
export function takeMouse(input) {
  const deltaX = input.mouseDX;
  const deltaY = input.mouseDY;
  input.mouseDX = 0;
  input.mouseDY = 0;
  return { dx: deltaX, dy: deltaY };
}
