import { framePlan } from './render.js';

export function createAudioExportController({
  audioInput,
  audioInfo,
  exportButton,
  progress,
  status,
  onAudioChange,
  onError,
}) {
  let audioDecodeToken = 0;
  let audioBuffer = null;
  let audioFileName = '';

  function updateAudioInfo() {
    if (!audioBuffer) {
      audioInfo.textContent = '음성 파일 없음';
      return;
    }
    audioInfo.textContent = `${audioFileName} / ${audioBuffer.duration.toFixed(3)}초 / ${audioBuffer.sampleRate}Hz / ${audioBuffer.numberOfChannels}채널`;
  }

  function getDuration() {
    return audioBuffer?.duration ?? 0;
  }

  function createAudioPayload() {
    if (!audioBuffer) return null;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const numberOfFrames = audioBuffer.length;
    const planar = new Float32Array(numberOfChannels * numberOfFrames);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      planar.set(audioBuffer.getChannelData(channel), channel * numberOfFrames);
    }
    return {
      data: planar.buffer,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels,
      numberOfFrames,
    };
  }

  async function exportVideo(config, layout) {
    exportButton.disabled = true;
    progress.value = 0;
    status.textContent = '시작 중...';

    const worker = new Worker('./export-worker.js', { type: 'module' });
    const plan = framePlan(config);
    const audio = createAudioPayload();

    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        progress.value = data.frame / data.total;
        status.textContent = `렌더링 중 ${data.frame} / ${data.total}`;
      } else if (data.type === 'status') {
        status.textContent = data.message;
      } else if (data.type === 'done') {
        const blob = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'credits.mp4';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        progress.value = 1;
        status.textContent = '완료';
        exportButton.disabled = false;
        worker.terminate();
      } else if (data.type === 'error') {
        onError(data.message);
        status.textContent = '실패';
        exportButton.disabled = false;
        worker.terminate();
      }
    };

    worker.onerror = (event) => {
      onError(event.message || '내보내기 작업을 실행하지 못했습니다.');
      status.textContent = '실패';
      exportButton.disabled = false;
      worker.terminate();
    };

    const transfer = audio ? [audio.data] : [];
    worker.postMessage({ type: 'export', config, layout, plan, audio }, transfer);
  }

  audioInput.addEventListener('change', async () => {
    const token = ++audioDecodeToken;
    const file = audioInput.files?.[0];
    audioBuffer = null;
    audioFileName = '';
    updateAudioInfo();
    if (!file) {
      onAudioChange();
      return;
    }

    audioInfo.textContent = '음성 파일 읽는 중...';
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('이 브라우저에서는 Web Audio API를 사용할 수 없습니다.');
      const audioContext = new AudioContextClass();
      try {
        const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
        if (token !== audioDecodeToken) return;
        audioBuffer = decoded;
        audioFileName = file.name;
        updateAudioInfo();
        onError('');
      } finally {
        await audioContext.close();
      }
    } catch (error) {
      if (token !== audioDecodeToken) return;
      audioBuffer = null;
      audioFileName = '';
      audioInfo.textContent = '음성 파일을 읽을 수 없습니다.';
      onError(error instanceof Error ? error.message : String(error));
    }
    onAudioChange();
  });

  updateAudioInfo();
  return { getDuration, exportVideo };
}
