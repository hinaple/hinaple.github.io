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

function bitrateFor(width, height, fps) {
  return Math.max(1_000_000, Math.min(50_000_000, Math.round(width * height * fps * 0.15)));
}

async function loadFont(config) {
  if (!config.fontUrl) return;
  if (typeof FontFace === 'undefined' || !self.fonts) throw new Error('Custom fonts are not supported inside this browser worker.');
  const face = new FontFace('CreditGeneratorFont', `url(${JSON.stringify(config.fontUrl)})`);
  self.fonts.add(face);
  await face.load();
}

function paintFrame(ctx, canvas, config, layout, plan, frameIndex) {
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (frameIndex < plan.startFrames || frameIndex >= plan.startFrames + plan.creditFrames) return;
  const creditFrame = frameIndex - plan.startFrames;
  const progress = creditFrame / plan.creditFrames;
  const startY = config.height - 1;
  const endY = -layout.visualHeight;
  const y = startY + (endY - startY) * progress;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, config.width, config.height);
  ctx.clip();
  ctx.fillStyle = config.textColor;
  ctx.font = layout.font;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = config.textAlign;
  const x = config.textAlign === 'left' ? config.padding : config.textAlign === 'right' ? config.width - config.padding : config.width / 2;
  for (const line of layout.lines) ctx.fillText(line.text, x, y + line.baseline);
  ctx.restore();
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
    if (typeof OffscreenCanvas === 'undefined') throw new Error('OffscreenCanvas is not supported by this browser.');
    if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs VideoEncoder is not supported by this browser.');
    const videoBitrate = bitrateFor(config.width, config.height, config.fps);
    const canEncodeAvc = await canEncodeVideo('avc', {
      width: config.width,
      height: config.height,
      bitrate: videoBitrate,
    });
    if (!canEncodeAvc) throw new Error('H.264 (AVC) encoding is not supported for this size in this browser.');
    if (audio) {
      const canEncodeAac = await canEncodeAudio('aac', {
        numberOfChannels: audio.numberOfChannels,
        sampleRate: audio.sampleRate,
        bitrate: 192_000,
      });
      if (!canEncodeAac) throw new Error('AAC audio encoding is not supported for this audio file in this browser.');
    }
    await loadFont(config);

    const canvas = new OffscreenCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create a 2D canvas context.');

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
      self.postMessage({ type: 'status', message: 'Encoding audio...' });
      await addAudio(audioSource, audio, config, plan);
      audioSource.close();
    }

    const frameDuration = 1 / config.fps;
    const keyInterval = Math.max(1, Math.round(config.fps * 2));
    for (let frame = 0; frame < plan.totalFrames; frame++) {
      paintFrame(ctx, canvas, config, layout, plan, frame);
      await source.add(frame * frameDuration, frameDuration, { keyFrame: frame % keyInterval === 0 });
      if (frame % 5 === 0 || frame + 1 === plan.totalFrames) {
        self.postMessage({ type: 'progress', frame: frame + 1, total: plan.totalFrames });
      }
    }

    source.close();
    await output.finalize();
    if (!target.buffer) throw new Error('MP4 output buffer was not created.');
    self.postMessage({ type: 'done', buffer: target.buffer }, [target.buffer]);
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
