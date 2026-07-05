import { getCameraErrorMessage } from '../utils/common.js';

export class CameraService {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
    this.config = null;
    this.fps = 30;
    this.cameras = [];
  }

  setVideoElement(videoElement) {
    this.video = videoElement;
  }

  setCanvasElement(canvasElement) {
    this.canvas = canvasElement;
  }

  // TODO [Basic] Tambahkan konfigurasi kamera untuk mendapatkan daftar perangkat input video
  // TODO [Basic] Dapatkan constraints kamera berdasarkan konfigurasi dan kamera yang dipilih
  async loadCameras() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.cameras = devices.filter((d) => d.kind === 'videoinput');
    return this.cameras;
  }

  _getConstraints(selectedCameraId) {
    if (selectedCameraId && selectedCameraId !== 'default') {
      return { video: { deviceId: { exact: selectedCameraId } }, audio: false };
    }
    // Use 'environment' on mobile, fall back to true for desktop
    return { video: { facingMode: { ideal: 'environment' } }, audio: false };
  }

  // TODO [Basic] Memulai kamera dengan perangkat yang dipilih dan menampilkan pada elemen video
  async startCamera(selectedCameraId) {
    try {
      if (this.stream) this.stopCamera();

      const constraints = this._getConstraints(selectedCameraId);
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.video) {
        this.video.srcObject = this.stream;

        // Wait for video metadata to be loaded before playing
        await new Promise((resolve, reject) => {
          this.video.onloadedmetadata = resolve;
          this.video.onerror = reject;
        });

        await this.video.play();
      }
    } catch (error) {
      throw new Error(getCameraErrorMessage(error));
    }
  }

  // TODO [Basic] Menghentikan siaran kamera dan membersihkan sumber daya
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  // TODO [Skilled] Implementasikan metode untuk mengatur FPS kamera
  setFPS(fps) {
    this.fps = fps;
  }

  // TODO [Basic] Periksa apakah kamera sedang aktif
  isActive() {
    return this.stream !== null && this.stream.active;
  }

  // TODO [Basic] Periksa apakah elemen video siap untuk digunakan
  isReady() {
    return (
      this.video !== null &&
      this.video.readyState >= 2 &&
      this.video.videoWidth > 0
    );
  }
}
