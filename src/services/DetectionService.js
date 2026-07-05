import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { isWebGPUSupported, validateModelMetadata } from '../utils/common.js';

export class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = null;
  }

  // TODO [Basic] Muat model dan metadata secara bersamaan, lalu simpan ke instance
  // TODO [Advance] Implementasikan strategi Backend Adaptive
  async loadModel(onProgress) {
    if (isWebGPUSupported()) {
      try {
        await import('@tensorflow/tfjs-backend-webgpu');
        await tf.setBackend('webgpu');
        await tf.ready();
      } catch {
        await tf.setBackend('webgl');
        await tf.ready();
      }
    } else {
      await tf.setBackend('webgl');
      await tf.ready();
    }

    onProgress?.(20);

    // Load metadata first
    const metaRes = await fetch('/model/metadata.json');
    const metadata = await metaRes.json();
    if (!validateModelMetadata(metadata)) throw new Error('Metadata model tidak valid');
    this.labels = metadata.labels;
    this.config = metadata;

    onProgress?.(50);

    // Use URL-based loader so TF.js fetches weights.bin automatically
    this.model = await tf.loadLayersModel('/model/model.json');

    onProgress?.(90);

    // Warm-up run
    tf.tidy(() => {
      const dummy = tf.zeros([1, metadata.imageSize, metadata.imageSize, 3]);
      this.model.predict(dummy);
    });

    onProgress?.(100);
  }

  // TODO [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  async predict(imageElement) {
    if (!this.isLoaded()) return null;

    const imageSize = this.config?.imageSize ?? 224;

    return tf.tidy(() => {
      const tensor = tf.browser
        .fromPixels(imageElement)
        .resizeBilinear([imageSize, imageSize])
        .toFloat()
        .div(127.5)
        .sub(1)
        .expandDims(0);

      const predictions = this.model.predict(tensor);
      const scores = predictions.dataSync();

      let maxIdx = 0;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > scores[maxIdx]) maxIdx = i;
      }

      const confidence = Math.round(scores[maxIdx] * 100);
      return {
        className: this.labels[maxIdx],
        score: scores[maxIdx],
        confidence,
        isValid: confidence > 0,
      };
    });
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isLoaded() {
    return this.model !== null && this.labels.length > 0;
  }
}
