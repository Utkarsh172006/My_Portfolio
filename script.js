const FRAME_COUNT = 240;
const FRAME_DIRECTORY = "./Boy_typing_frames_24fps/";
const PRELOAD_BEHIND = 4;
const PRELOAD_AHEAD = 12;
const MAX_CACHED_FRAMES = 30;

const canvas = document.querySelector(".scene__canvas");
const context = canvas.getContext("2d");
const progressBar = document.querySelector(".scene__progress-value");
const menuToggle = document.querySelector(".menu-toggle");
const mobileNavigation = document.querySelector(".mobile-nav");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const frameCache = new Map();

let currentFrame = 0;
let lastFrame = -1;
let scrollDirection = 1;
let previousScrollY = window.scrollY;
let renderQueued = false;
let viewportWidth = 0;
let viewportHeight = 0;
let pixelRatio = 1;

function frameUrl(index) {
  return `${FRAME_DIRECTORY}frame_${String(index + 1).padStart(4, "0")}.png`;
}

function loadFrame(index) {
  if (index < 0 || index >= FRAME_COUNT) return null;

  let image = frameCache.get(index);
  if (image) return image;

  image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (index === currentFrame) queueRender();
  };
  image.onerror = () => {
    console.error(`Unable to load animation frame ${index + 1}: ${image.src}`);
  };
  frameCache.set(index, image);
  image.src = frameUrl(index);
  trimFrameCache();
  return image;
}

function trimFrameCache() {
  if (frameCache.size <= MAX_CACHED_FRAMES) return;

  const retained = new Set();
  for (let offset = -PRELOAD_BEHIND; offset <= PRELOAD_AHEAD; offset += 1) {
    const index = currentFrame + offset * (scrollDirection < 0 ? -1 : 1);
    if (index >= 0 && index < FRAME_COUNT) retained.add(index);
  }

  for (const index of frameCache.keys()) {
    if (frameCache.size <= MAX_CACHED_FRAMES) break;
    if (!retained.has(index)) frameCache.delete(index);
  }
}

function preloadNearbyFrames() {
  const behind = scrollDirection < 0 ? PRELOAD_AHEAD : PRELOAD_BEHIND;
  const ahead = scrollDirection < 0 ? PRELOAD_BEHIND : PRELOAD_AHEAD;

  for (let offset = -behind; offset <= ahead; offset += 1) {
    loadFrame(currentFrame + offset);
  }
  trimFrameCache();
}

function nearestLoadedFrame() {
  for (let distance = 1; distance < FRAME_COUNT; distance += 1) {
    const before = frameCache.get(currentFrame - distance);
    if (before?.complete && before.naturalWidth) return before;

    const after = frameCache.get(currentFrame + distance);
    if (after?.complete && after.naturalWidth) return after;
  }
  return null;
}

function drawFrame() {
  renderQueued = false;
  const image = loadFrame(currentFrame);

  context.clearRect(0, 0, viewportWidth, viewportHeight);

  const drawable = image?.complete && image.naturalWidth ? image : nearestLoadedFrame();
  if (!drawable) return;

  const scale = Math.max(viewportWidth / drawable.naturalWidth, viewportHeight / drawable.naturalHeight);
  const width = drawable.naturalWidth * scale;
  const height = drawable.naturalHeight * scale;
  const x = (viewportWidth - width) / 2;
  const y = (viewportHeight - height) / 2;

  context.drawImage(drawable, x, y, width, height);
  lastFrame = currentFrame;
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(drawFrame);
}

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  viewportWidth = bounds.width;
  viewportHeight = bounds.height;
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(viewportWidth * pixelRatio);
  canvas.height = Math.round(viewportHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  queueRender();
}

function updateFromScroll() {
  const scrollY = window.scrollY;
  if (scrollY !== previousScrollY) {
    scrollDirection = scrollY > previousScrollY ? 1 : -1;
    previousScrollY = scrollY;
  }

  const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
  const scrollProgress = scrollRange > 0 ? Math.min(1, Math.max(0, scrollY / scrollRange)) : 0;
  const progress = reducedMotion.matches ? 0 : scrollProgress;
  const nextFrame = Math.round(progress * (FRAME_COUNT - 1));

  progressBar.style.transform = `scaleX(${progress})`;
  if (nextFrame !== currentFrame || lastFrame < 0) {
    currentFrame = nextFrame;
    preloadNearbyFrames();
    queueRender();
  }
}

window.addEventListener("scroll", updateFromScroll, { passive: true });
window.addEventListener("resize", resizeCanvas, { passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  renderQueued = false;
  resizeCanvas();
});
reducedMotion.addEventListener("change", updateFromScroll);

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  menuToggle.setAttribute("aria-label", isExpanded ? "Open navigation" : "Close navigation");
  mobileNavigation.hidden = isExpanded;
});

mobileNavigation.addEventListener("click", (event) => {
  if (!event.target.closest("a")) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  mobileNavigation.hidden = true;
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || mobileNavigation.hidden) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open navigation");
  mobileNavigation.hidden = true;
  menuToggle.focus();
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());

resizeCanvas();
preloadNearbyFrames();
updateFromScroll();
