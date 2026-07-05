import { pipeline } from '@huggingface/transformers';
import { TONE_CONFIG } from '../utils/config.js';
import { isWebGPUSupported } from '../utils/common.js';

const TONE_PROMPTS = {
  normal: (name) => `Write one interesting fun fact about the vegetable "${name}" in Indonesian language. Be informative and concise.`,
  funny: (name) => `Write one hilarious and funny fun fact about the vegetable "${name}" in Indonesian language. Be creative and humorous.`,
  professional: (name) => `Write one scientific and professional fun fact about the vegetable "${name}" in Indonesian language. Use formal language.`,
  casual: (name) => `Write one casual and friendly fun fact about the vegetable "${name}" in Indonesian language. Use relaxed, everyday language.`,
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

    this.generator = await pipeline(
      'text2text-generation',
      'Xenova/LaMini-Flan-T5-248M',
      {
        device,
        // Use quantized model to reduce memory usage on mobile
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
        max_new_tokens: 120,
        temperature: 0.8,
        top_p: 0.9,
        do_sample: true,
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
