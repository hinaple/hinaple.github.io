import { framePlan, paintCreditsAtTime } from './render.js';

export function createPreviewController({
  canvas,
  timeline,
  timelineTime,
  playButton,
  pauseButton,
  restartButton,
}) {
  const ctx = canvas.getContext('2d');
  let config = null;
  let layout = null;
  let previewTime = 0;
  let playing = false;
  let playStartedAt = 0;
  let animationFrame = 0;

  function totalTime() {
    return config ? framePlan(config).total : 0;
  }

  function updateTimeline() {
    if (!config) return;
    const total = totalTime();
    previewTime = Math.min(Math.max(0, previewTime), total);
    timeline.max = String(total);
    timeline.value = String(previewTime);
    timelineTime.textContent = `${previewTime.toFixed(3)} / ${total.toFixed(3)}초`;
  }

  function resizeCanvas() {
    if (!config) return 1;
    const scale = Math.min(1, 800 / config.width);
    const width = Math.max(1, Math.round(config.width * scale));
    const height = Math.max(1, Math.round(config.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return scale;
  }

  function draw() {
    if (!config || !layout) return;
    const scale = resizeCanvas();
    ctx.save();
    ctx.scale(scale, scale);
    paintCreditsAtTime(ctx, config, layout, previewTime);
    ctx.restore();
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(animationFrame);
  }

  function tick(now) {
    if (!playing || !config) return;
    const total = totalTime();
    previewTime = (now - playStartedAt) / 1000;
    if (previewTime >= total) {
      previewTime = total;
      playing = false;
    }
    draw();
    updateTimeline();
    if (playing) animationFrame = requestAnimationFrame(tick);
  }

  function setScene(nextConfig, nextLayout) {
    config = nextConfig;
    layout = nextLayout;
    previewTime = Math.min(previewTime, totalTime());
    if (playing) playStartedAt = performance.now() - previewTime * 1000;
    updateTimeline();
    draw();
  }

  playButton.addEventListener('click', () => {
    if (!config || !layout || playing) return;
    const total = totalTime();
    if (previewTime >= total) previewTime = 0;
    playing = true;
    playStartedAt = performance.now() - previewTime * 1000;
    updateTimeline();
    animationFrame = requestAnimationFrame(tick);
  });

  pauseButton.addEventListener('click', stop);

  restartButton.addEventListener('click', () => {
    stop();
    previewTime = 0;
    draw();
    updateTimeline();
  });

  timeline.addEventListener('input', () => {
    if (!config || !layout) return;
    previewTime = Number(timeline.value);
    if (playing) playStartedAt = performance.now() - previewTime * 1000;
    draw();
    updateTimeline();
  });

  return { setScene, stop };
}
