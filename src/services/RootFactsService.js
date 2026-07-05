import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';

const TONE_PROMPTS = {
  normal: (name) => `What is one interesting fact about ${name}?`,
  funny: (name) => `What is one funny or surprising fact about ${name}?`,
  professional: (name) => `What is one scientific fact about ${name}?`,
  casual: (name) => `Tell me something cool about ${name}.`,
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
  async loadModel(onProgress) {
    // Transformers.js supports 'webgpu' or 'wasm' (not 'webgl')
    const device = isWebGPUSupported() ? 'webgpu' : 'wasm';
    this.currentBackend = device;

    onProgress?.(10);

    // flan-t5-small ~80MB, much lighter than LaMini-Flan-T5-248M ~250MB
    this.generator = await pipeline(
      'text2text-generation',
      'Xenova/flan-t5-small',
      {
        device,
        dtype: 'q8',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.progress != null) {
            onProgress?.(10 + Math.round(p.progress * 0.85));
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
        repetition_penalty: 1.3,
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
