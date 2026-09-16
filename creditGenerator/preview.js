import { framePlan, paintCreditsAtTime } from './render.js';

export function createPreviewController({ canvas, timeline, timelineTime, toggleButton, restartButton }) {
  const ctx = canvas.getContext('2d');
  let config = null;
  let layout = null;
  let playing = false;
  let previewTime = 0;
  let playStartedAt = 0;
  let animationFrame = 0;

  function updateToggleLabel() {
    toggleButton.textContent = playing ? '일시정지' : '재생';
    toggleButton.setAttribute('aria-pressed', String(playing));
  }

  function updateTimeline() {
    if (!config) return;
    const total = framePlan(config).total;
    previewTime = Math.min(Math.max(0, previewTime), total);
    timeline.max = String(total);
    timeline.value = String(previewTime);
    timelineTime.textContent = `${previewTime.toFixed(3)} / ${total.toFixed(3)}초`;
  }

  function draw() {
    if (!config || !layout) return;
    const scale = Math.min(1, 800 / config.width);
    canvas.width = Math.max(1, Math.round(config.width * scale));
    canvas.height = Math.max(1, Math.round(config.height * scale));
    ctx.save();
    ctx.scale(scale, scale);
    paintCreditsAtTime(ctx, config, layout, previewTime);
    ctx.restore();
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(animationFrame);
    updateToggleLabel();
  }

  function tick(now) {
    if (!playing || !config) return;
    const total = framePlan(config).total;
    previewTime = (now - playStartedAt) / 1000;
    if (previewTime >= total) {
      previewTime = total;
      playing = false;
    }
    draw();
    updateTimeline();
    updateToggleLabel();
    if (playing) animationFrame = requestAnimationFrame(tick);
  }

  toggleButton.addEventListener('click', () => {
    if (!config || !layout) return;
    if (playing) {
      stop();
      return;
    }
    const total = framePlan(config).total;
    if (previewTime >= total) previewTime = 0;
    playing = true;
    playStartedAt = performance.now() - previewTime * 1000;
    updateToggleLabel();
    animationFrame = requestAnimationFrame(tick);
  });

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

  updateToggleLabel();

  return {
    setScene(nextConfig, nextLayout) {
      config = nextConfig;
      layout = nextLayout;
      previewTime = Math.min(previewTime, framePlan(config).total);
      draw();
      updateTimeline();
    },
  };
}
