import { BrowserMultiFormatReader } from "@zxing/browser";

type CodeListener = (code: string) => void;

export interface CodeScanner {
  start(onCode: CodeListener): Promise<void>;
  stop(): void;
}

const FORMATS = [
  "qr_code",
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
] as const;

export function isBarcodeDetectorAvailable() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export class CameraScanner implements CodeScanner {
  private stream: MediaStream | null = null;
  private detector: BarcodeDetector | null = null;
  private rafId: number | null = null;
  private lastCode: string | null = null;
  private readonly debounceMs = 2000;
  private zxing: BrowserMultiFormatReader | null = null;
  private running = false;

  constructor(private readonly video: HTMLVideoElement) {}

  async start(onCode: CodeListener) {
    if (this.running) return;
    this.running = true;

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    this.video.srcObject = this.stream;
    this.video.playsInline = true;
    this.video.muted = true;
    await this.video.play();

    if (isBarcodeDetectorAvailable()) {
      this.detector = new BarcodeDetector({ formats: [...FORMATS] });
      this.scanWithDetector(onCode);
    } else {
      await this.scanWithZxing(onCode);
    }
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.zxing) {
      this.zxing.reset();
      this.zxing = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  private scanWithDetector(onCode: CodeListener) {
    const detect = async () => {
      if (!this.detector || !this.running) return;
      try {
        const barcodes = await this.detector.detect(this.video);
        const value = barcodes[0]?.rawValue?.trim();
        if (value) this.emitIfNew(value, onCode);
      } catch (err) {
        console.warn("Barcode detection failed", err);
      }
      this.rafId = requestAnimationFrame(detect);
    };

    detect();
  }

  private async scanWithZxing(onCode: CodeListener) {
    this.zxing = new BrowserMultiFormatReader();
    await this.zxing.decodeFromVideoDevice(
      undefined,
      this.video,
      (result, error, controls) => {
        if (!this.running) {
          controls?.stop();
          return;
        }
        if (result) {
          const value = result.getText().trim();
          if (value) this.emitIfNew(value, onCode);
        } else if (error) {
          // Ignore not found errors to keep scanning.
        }
      }
    );
  }

  private emitIfNew(code: string, onCode: CodeListener) {
    if (code === this.lastCode) return;
    this.lastCode = code;
    onCode(code);
    window.setTimeout(() => {
      this.lastCode = null;
    }, this.debounceMs);
  }
}
