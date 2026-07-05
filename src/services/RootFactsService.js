import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';

const TONE_PROMPTS = {
  normal: (name) => `Give one specific and interesting fact about the vegetable ${name}.`,
  funny: (name) => `Give one funny or surprising fact about the vegetable ${name}.`,
  professional: (name) => `Give one scientific or nutritional fact about the vegetable ${name}.`,
  casual: (name) => `Share one cool or unexpected fact about the vegetable ${name} in a friendly way.`,
};

export class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = null;
    this.currentBackend = null;
    this.currentTone = TONE_CONFIG.defaultTone;
  }

  // TODO [Basic] Muat model dan inisialisasi pipeline text2text-generation
  // TODO [Advance] Implementasikan strategi Backend Adaptive
  async loadModel(onProgress, onStatusText) {
    const device = isWebGPUSupported() ? 'webgpu' : 'wasm';
    this.currentBackend = device;

    // Track per-file progress: encoder_model and decoder_model
    const fileProgress = {};

    this.generator = await pipeline(
      'text2text-generation',
      'Xenova/flan-t5-base',
      {
        device,
        dtype: 'fp32',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress != null && p.file) {
            fileProgress[p.file] = p.progress;

            const encoderPct = Math.round(fileProgress[Object.keys(fileProgress).find(k => k.includes('encoder')) ?? ''] ?? 0);
            const decoderPct = Math.round(fileProgress[Object.keys(fileProgress).find(k => k.includes('decoder')) ?? ''] ?? 0);

            const parts = [];
            if (encoderPct > 0) parts.push(`Encoder ${encoderPct}%`);
            if (decoderPct > 0) parts.push(`Decoder ${decoderPct}%`);
            if (parts.length > 0) onStatusText?.(`Mengunduh ${parts.join(' | ')}`);

            const values = Object.values(fileProgress);
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            onProgress?.(Math.round(avg));
          } else if (p.status === 'done' && p.file) {
            fileProgress[p.file] = 100;
          }
        },
      },
    );

    this.isModelLoaded = true;
    onProgress?.(100);
  }

  // TODO [Advance] Konfigurasi tone fakta yang dihasilkan
  setTone(tone) {
    if (TONE_CONFIG.availableTones.some((t) => t.value === tone)) {
      this.currentTone = tone;
    }
  }

  // TODO [Basic] Lakukan prediksi pada elemen gambar yang diberikan dan kembalikan hasilnya
  // TODO [Skilled] Konfigurasikan parameter generasi berdasarkan kebutuhan
  // TODO [Advance] Implemenasikan parameter tone untuk mengatur nada fakta yang dihasilkan
  async generateFacts(vegetableName) {
    if (!this.isReady() || this.isGenerating) return null;

    this.isGenerating = true;
    try {
      const promptFn = TONE_PROMPTS[this.currentTone] ?? TONE_PROMPTS.normal;
      const prompt = promptFn(vegetableName);

      const result = await this.generator(prompt, {
        max_new_tokens: 80,
        do_sample: false,
        repetition_penalty: 1.5,
        no_repeat_ngram_size: 3,
      });

      return result?.[0]?.generated_text ?? null;
    } finally {
      this.isGenerating = false;
    }
  }

  // TODO [Basic] Periksa apakah model sudah dimuat dan siap digunakan
  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }
}
