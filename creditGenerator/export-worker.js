import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  AudioSampleSource,
  AudioSample,
  canEncodeVideo,
  canEncodeAudio,
} from 'https://cdn.jsdelivr.net/npm/mediabunny@1.56.3/+esm';
import { paintCreditsFrame } from './render.js';

function bitrateFor(width, height, fps) {
  return Math.max(1_000_000, Math.min(50_000_000, Math.round(width * height * fps * 0.15)));
}

async function loadFonts(layout) {
  if (!layout.fonts?.length) return;
  if (typeof FontFace === 'undefined' || !self.fonts) throw new Error('이 브라우저의 worker에서는 사용자 글꼴을 사용할 수 없습니다.');
  for (const font of layout.fonts) {
    const face = new FontFace(font.family, `url(${JSON.stringify(font.url)})`, { weight: String(font.weight) });
    self.fonts.add(face);
    await face.load();
  }
}

async function addAudio(audioSource, audio, config, plan) {
  const source = new Float32Array(audio.data);
  const availableSeconds = Math.max(0, plan.total - config.audioStart);
  const framesToWrite = Math.min(audio.numberOfFrames, Math.floor(availableSeconds * audio.sampleRate));
  if (framesToWrite <= 0) return;

  const chunkFrames = Math.max(1, Math.round(audio.sampleRate));
  for (let offset = 0; offset < framesToWrite; offset += chunkFrames) {
    const count = Math.min(chunkFrames, framesToWrite - offset);
    const chunk = new Float32Array(count * audio.numberOfChannels);
    for (let channel = 0; channel < audio.numberOfChannels; channel++) {
      const sourceStart = channel * audio.numberOfFrames + offset;
      const targetStart = channel * count;
      chunk.set(source.subarray(sourceStart, sourceStart + count), targetStart);
    }
    if (config.volume !== 1) {
      for (let i = 0; i < chunk.length; i++) chunk[i] *= config.volume;
    }

    const sample = new AudioSample({
      data: chunk,
      format: 'f32-planar',
      numberOfChannels: audio.numberOfChannels,
      sampleRate: audio.sampleRate,
      timestamp: config.audioStart + offset / audio.sampleRate,
    });
    try {
      await audioSource.add(sample);
    } finally {
      sample.close();
    }
  }
}

self.onmessage = async ({ data }) => {
  if (data.type !== 'export') return;
  try {
    const { config, layout, plan, audio } = data;
    if (typeof OffscreenCanvas === 'undefined') throw new Error('이 브라우저에서는 OffscreenCanvas를 사용할 수 없습니다.');
    if (typeof VideoEncoder === 'undefined') throw new Error('이 브라우저에서는 WebCodecs VideoEncoder를 사용할 수 없습니다.');

    const videoBitrate = bitrateFor(config.width, config.height, config.fps);
    const canEncodeAvc = await canEncodeVideo('avc', {
      width: config.width,
      height: config.height,
      bitrate: videoBitrate,
    });
    if (!canEncodeAvc) throw new Error('이 브라우저에서는 현재 크기의 H.264 영상을 인코딩할 수 없습니다.');

    if (audio) {
      const canEncodeAac = await canEncodeAudio('aac', {
        numberOfChannels: audio.numberOfChannels,
        sampleRate: audio.sampleRate,
        bitrate: 192_000,
      });
      if (!canEncodeAac) throw new Error('이 브라우저에서는 이 음성 파일을 AAC로 인코딩할 수 없습니다.');
    }

    await loadFonts(layout);

    const canvas = new OffscreenCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D Canvas context를 만들 수 없습니다.');

    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target,
    });
    const source = new CanvasSource(canvas, {
      codec: 'avc',
      bitrate: videoBitrate,
    });
    output.addVideoTrack(source, { frameRate: config.fps });

    let audioSource = null;
    const audioFitsTimeline = audio && config.audioStart < plan.total && audio.numberOfFrames > 0;
    if (audioFitsTimeline) {
      audioSource = new AudioSampleSource({ codec: 'aac', bitrate: 192_000 });
      output.addAudioTrack(audioSource);
    }

    await output.start();

    if (audioSource) {
      self.postMessage({ type: 'status', message: '음성 인코딩 중...' });
      await addAudio(audioSource, audio, config, plan);
      audioSource.close();
    }

    const frameDuration = 1 / config.fps;
    const keyInterval = Math.max(1, Math.round(config.fps * 2));
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      paintCreditsFrame(ctx, config, layout, plan, frame);
      await source.add(frame * frameDuration, frameDuration, { keyFrame: frame % keyInterval === 0 });
      if (frame % 5 === 0 || frame + 1 === plan.totalFrames) {
        self.postMessage({ type: 'progress', frame: frame + 1, total: plan.totalFrames });
      }
    }

    source.close();
    await output.finalize();
    if (!target.buffer) throw new Error('MP4 출력 버퍼를 만들지 못했습니다.');
    self.postMessage({ type: 'done', buffer: target.buffer }, [target.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
