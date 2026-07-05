import { useRef, useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CameraSection from './components/CameraSection';
import InfoPanel from './components/InfoPanel';
import { useAppState } from './hooks/useAppState';
import { DetectionService } from './services/DetectionService';
import { CameraService } from './services/CameraService';
import { RootFactsService } from './services/RootFactsService';
import { APP_CONFIG, isValidDetection } from './utils/config';
import { createDelay } from './utils/common';

function App() {
  const { state, actions } = useAppState();
  const detectionCleanupRef = useRef(null);
  const isRunningRef = useRef(false);
  const [currentTone, setCurrentTone] = useState('normal');

  // TODO [Basic] Inisialisasi layanan deteksi, kamera, dan generator fakta saat aplikasi dimuat
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const detector = new DetectionService();
    const camera = new CameraService();
    const generator = new RootFactsService();

    actionsRef.current.setServices({ detector, camera, generator });

    let detectorProgress = 0;
    let generatorProgress = 0;
    let lastReported = 0;

    const updateStatus = () => {
      // detector covers 0-50%, generator covers 50-100%
      const avg = Math.round((detectorProgress / 2) + (generatorProgress / 2));
      if (avg > lastReported) {
        lastReported = avg;
        actionsRef.current.setModelStatus(`Memuat Model... ${avg}%`);
      }
    };

    const onDetectorProgress = (p) => { detectorProgress = Math.max(detectorProgress, p); updateStatus(); };
    const onGeneratorProgress = (p) => { generatorProgress = Math.max(generatorProgress, p); updateStatus(); };

    // Load sequentially to avoid memory spike on mobile
    detector.loadModel(onDetectorProgress)
      .then(() => generator.loadModel(onGeneratorProgress))
      .then(() => actionsRef.current.setModelStatus('Model AI Siap'))
      .catch((err) => {
        actionsRef.current.setModelStatus('Gagal Memuat Model');
        actionsRef.current.setError(err.message);
      });
  }, []); // run once on mount

  // TODO [Basic] Bersihkan sumber daya saat komponen ditinggalkan
  useEffect(() => {
    return () => {
      if (detectionCleanupRef.current) {
        detectionCleanupRef.current();
        detectionCleanupRef.current = null;
      }
      state.services.camera?.stopCamera();
    };
  }, [state.services.camera]);

  // TODO [Basic] Fungsi untuk memulai loop deteksi
  const startDetectionLoop = useCallback((detector, camera, generator) => {
    isRunningRef.current = true;
    let animFrameId = null;
    let lastFrameTime = 0;
    let isProcessing = false;

    const loop = async (timestamp) => {
      if (!isRunningRef.current) return;

      const fps = camera.fps ?? 30;
      const interval = 1000 / fps;

      if (!isProcessing && timestamp - lastFrameTime >= interval) {
        lastFrameTime = timestamp;

        if (camera.isReady()) {
          const result = await detector.predict(camera.video);

          if (isValidDetection(result)) {
            isProcessing = true;

            actions.setDetectionResult(result);
            actions.setAppState('analyzing');

            await createDelay(APP_CONFIG.analyzingDelay);

            if (!isRunningRef.current) return;

            actions.setAppState('result');
            actions.setFunFactData(null);

            const fact = await generator.generateFacts(result.className);
            actions.setFunFactData(fact ?? 'error');

            isProcessing = false;
          }
        }
      }

      animFrameId = requestAnimationFrame(loop);
    };

    animFrameId = requestAnimationFrame(loop);

    detectionCleanupRef.current = () => {
      isRunningRef.current = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [actions]);

  // TODO [Basic] Fungsi untuk memulai dan menghentikan kamera
  const handleToggleCamera = useCallback(async () => {
    const { detector, camera, generator } = state.services;

    if (state.isRunning) {
      isRunningRef.current = false;
      if (detectionCleanupRef.current) {
        detectionCleanupRef.current();
        detectionCleanupRef.current = null;
      }
      camera.stopCamera();
      actions.setRunning(false);
      actions.resetResults();
    } else {
      try {
        await camera.startCamera();
        actions.setRunning(true);
        actions.resetResults();
        startDetectionLoop(detector, camera, generator);
      } catch (err) {
        actions.setError(err.message);
      }
    }
  }, [state.isRunning, state.services, actions, startDetectionLoop]);

  // TODO [Advance] Fungsi untuk mengubah nada fakta yang dihasilkan
  const handleToneChange = useCallback((tone) => {
    setCurrentTone(tone);
    state.services.generator?.setTone(tone);
  }, [state.services.generator]);

  // TODO [Skilled] Fungsi untuk menyalin fakta ke clipboard
  const handleCopyFact = useCallback(() => {
    if (state.funFactData && state.funFactData !== 'error') {
      navigator.clipboard.writeText(state.funFactData).catch(() => {});
    }
  }, [state.funFactData]);

  return (
    <div className="app-container">
      <Header modelStatus={state.modelStatus} />

      <main className="main-content">
        <CameraSection
          isRunning={state.isRunning}
          onToggleCamera={handleToggleCamera}
          onToneChange={handleToneChange}
          services={state.services}
          modelStatus={state.modelStatus}
          error={state.error}
          currentTone={currentTone}
        />

        <InfoPanel
          appState={state.appState}
          detectionResult={state.detectionResult}
          funFactData={state.funFactData}
          error={state.error}
          onCopyFact={handleCopyFact}
        />
      </main>

      <footer className="footer">
        <p>Powered by TensorFlow.js & Transformers.js</p>
      </footer>

      {state.error && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: '380px',
          padding: '0.875rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          color: '#991b1b',
          fontSize: '0.8125rem',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 1000
        }}>
          <strong>Error:</strong> {state.error}
          <button
            onClick={() => actions.setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#991b1b',
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
