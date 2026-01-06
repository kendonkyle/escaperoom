import { AccessController, AccessState } from "./stateMachine";
import {
  CameraScanner,
  CodeScanner,
  isBarcodeDetectorAvailable,
} from "./scanner";

export interface AppOptions {
  root?: HTMLElement;
  allowedCodes?: string[];
  denyResetMs?: number;
  scanner?: CodeScanner;
}

const DEFAULT_ALLOWED_CODES = [
  "ALLOWED-123",
  "OPEN-SESAME",
  "please-ulock-Door",
];
const DEFAULT_DENY_RESET_MS = 1800;

function createLayout(root: HTMLElement) {
  root.innerHTML = `
    <div class="app-shell">
      <div class="video-layer">
        <video
          class="camera-feed"
          data-testid="camera-feed"
          playsinline
          muted
          autoplay
        ></video>
        <div class="status-card">
          <p class="eyebrow">Entry / Exit Lock</p>
          <h1 data-testid="status-primary" class="status-text">Awaiting authentication</h1>
          <p data-testid="status-secondary" class="status-subtext">
            Align a QR code or barcode inside the frame
          </p>
          <div class="pill-row">
            <span class="pill" data-testid="camera-status">Camera starting…</span>
            <span class="pill pill-muted">
              ${
                isBarcodeDetectorAvailable()
                  ? "Fast scan mode"
                  : "Fallback scanner"
              }
            </span>
          </div>
        </div>
      </div>
      <section class="controls">
        <form class="manual-form" data-testid="manual-form">
          <label class="form-label" for="manual-code">Manual code (fallback)</label>
          <div class="manual-row">
            <input
              id="manual-code"
              name="manual-code"
              data-testid="manual-code-input"
              autocomplete="off"
              placeholder="Enter access code"
              inputmode="text"
              spellcheck="false"
            />
            <button type="submit" data-testid="manual-submit" class="primary-btn">
              Submit
            </button>
          </div>
          <p class="helper">Use this if the camera is unavailable or for desk-based testing.</p>
        </form>
        <div class="control-row">
          <button type="button" data-testid="reset-button" class="ghost-btn">Reset</button>
        </div>
      </section>
    </div>
  `;
}

function playAccessDeniedTone() {
  const audioPath = "/assets/sounds/access-denied-1.mp3"; // adjust if the filename differs
  try {
    if (typeof window === "undefined") return;
    if (navigator.userAgent?.includes("jsdom")) return;
    const audio = new Audio(audioPath);
    audio.volume = 0.7;
    const playResult = audio.play?.();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch((err) => {
        console.warn("MP3 playback failed, using oscillator fallback", err);
        fallbackTone();
      });
    }
  } catch (err) {
    console.warn("Unable to play MP3, using oscillator fallback", err);
    fallbackTone();
  }

  function fallbackTone() {
    try {
      const AudioCtx =
        (window as unknown as { webkitAudioContext?: AudioContext })
          .webkitAudioContext ?? window.AudioContext;
      if (typeof AudioCtx !== "function") return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = 120;
      gain.gain.value = 0.25;

      osc.connect(gain).connect(ctx.destination);

      const now = ctx.currentTime;
      osc.start(now);
      osc.frequency.setValueAtTime(160, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc.stop(now + 0.6);
    } catch (err) {
      console.warn("Unable to play fallback tone", err);
    }
  }
}

function playAccessGrantedTone() {
  const audioPath = "/assets/sounds/access-granted.mp3";
  try {
    if (typeof window === "undefined") return;
    if (navigator.userAgent?.includes("jsdom")) return;
    const audio = new Audio(audioPath);
    audio.volume = 0.65;
    const playResult = audio.play?.();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch((err) => {
        console.warn("Access granted sound failed to play", err);
      });
    }
  } catch (err) {
    console.warn("Unable to play access granted sound", err);
  }
}

function updateStatus(
  root: HTMLElement,
  state: AccessState,
  code: string | null
) {
  root.dataset.state = state;
  const primary = root.querySelector(
    '[data-testid="status-primary"]'
  ) as HTMLElement;
  const secondary = root.querySelector(
    '[data-testid="status-secondary"]'
  ) as HTMLElement;

  if (!primary || !secondary) return;

  if (state === "awaiting") {
    primary.textContent = "Awaiting authentication";
    secondary.textContent = "Scan a QR code or barcode to continue";
    return;
  }

  if (state === "granted") {
    primary.textContent = "Access granted";
    secondary.textContent = code ? `Code: ${code}` : "Welcome";
    return;
  }

  primary.textContent = "ACCESS DENIED";
  secondary.textContent = code ? `Code rejected: ${code}` : "Invalid code";
}

export async function initApp(options: AppOptions = {}) {
  const root = options.root ?? document.getElementById("app") ?? document.body;
  createLayout(root);

  const controller = new AccessController({
    allowedCodes: options.allowedCodes ?? DEFAULT_ALLOWED_CODES,
    denyResetMs: options.denyResetMs ?? DEFAULT_DENY_RESET_MS,
  });

  const video = root.querySelector(
    '[data-testid="camera-feed"]'
  ) as HTMLVideoElement | null;

  const cameraStatus = root.querySelector(
    '[data-testid="camera-status"]'
  ) as HTMLElement | null;

  const scanner: CodeScanner =
    options.scanner ??
    (video
      ? new CameraScanner(video)
      : { start: async () => {}, stop: () => {} });

  const manualForm = root.querySelector(
    '[data-testid="manual-form"]'
  ) as HTMLFormElement | null;
  const manualInput = root.querySelector(
    '[data-testid="manual-code-input"]'
  ) as HTMLInputElement | null;
  const resetButton = root.querySelector(
    '[data-testid="reset-button"]'
  ) as HTMLButtonElement | null;

  const unsubscribe = controller.onStateChange((state, code) => {
    console.log("Code: ", code);
    updateStatus(root, state, code);
    if (state === "denied") {
      playAccessDeniedTone();
    } else if (state === "granted") {
      playAccessGrantedTone();
    }
  });

  manualForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = manualInput?.value ?? "";
    controller.handleCode(value);
    if (manualInput) {
      manualInput.value = "";
      manualInput.focus();
    }
  });

  resetButton?.addEventListener("click", () => controller.reset());

  updateStatus(root, controller.state, null);

  try {
    await scanner.start((code) => controller.handleCode(code));
    cameraStatus && (cameraStatus.textContent = "Camera live");
  } catch (err) {
    console.error("Unable to start scanner", err);
    cameraStatus && (cameraStatus.textContent = "Camera unavailable");
    if (manualInput) {
      manualInput.placeholder = "Enter code (camera unavailable)";
    }
  }

  return {
    controller,
    destroy: () => {
      unsubscribe();
      scanner.stop();
      root.innerHTML = "";
    },
  };
}
