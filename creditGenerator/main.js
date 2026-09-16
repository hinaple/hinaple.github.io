import {
  prepareWithSegments,
  layoutWithLines,
  measureNaturalWidth,
} from 'https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.8/+esm';

const $ = (id) => document.getElementById(id);
const fields = {
  text: $('text'), wrap: $('wrap'), fontUrl: $('fontUrl'), fontSize: $('fontSize'),
  fontWeight: $('fontWeight'), lineHeight: $('lineHeight'), textAlign: $('textAlign'),
  textColor: $('textColor'), textColorPicker: $('textColorPicker'),
  backgroundColor: $('backgroundColor'), backgroundColorPicker: $('backgroundColorPicker'),
  padding: $('padding'), width: $('width'), height: $('height'), fps: $('fps'),
  duration: $('duration'), blankStart: $('blankStart'), blankEnd: $('blankEnd'),
};
const preview = $('preview');
const ctx = preview.getContext('2d');
const errorEl = $('error');
const infoEl = $('info');
const statusEl = $('status');
const progressEl = $('progress');
const exportButton = $('export');

let layout = null;
let config = null;
let fontFace = null;
let loadedFontUrl = '';
let updateToken = 0;
let updateTimer = 0;
let playing = false;
let previewTime = 0;
let playStartedAt = 0;
let animationFrame = 0;

function numberValue(input, name, { min = -Infinity, max = Infinity } = {}) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} is invalid.`);
  return value;
}

function validateColor(value, name) {
  if (!CSS.supports('color', value)) throw new Error(`${name} is not a valid CSS color.`);
  return value;
}

function resolveLineHeight(value, fontSize) {
  const raw = value.trim();
  if (!raw) throw new Error('Line height is empty.');
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) {
    const ratio = Number(raw);
    if (!(ratio > 0)) throw new Error('Line height must be greater than 0.');
    return ratio * fontSize;
  }
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;font-size:${fontSize}px;line-height:${raw}`;
  probe.textContent = 'M';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).lineHeight;
  probe.remove();
  const px = Number.parseFloat(computed);
  if (!Number.isFinite(px) || px <= 0) throw new Error('Line height must be unitless or a valid CSS line-height value.');
  return px;
}

function framePlan({ fps, duration, blankStart, blankEnd }) {
  const startFrames = Math.max(0, Math.round(blankStart * fps));
  const creditFrames = Math.max(1, Math.round(duration * fps));
  const endFrames = Math.max(0, Math.round(blankEnd * fps));
  const totalFrames = startFrames + creditFrames + endFrames;
  return {
    startFrames, creditFrames, endFrames, totalFrames,
    start: startFrames / fps,
    duration: creditFrames / fps,
    end: endFrames / fps,
    total: totalFrames / fps,
  };
}

async function ensureFont(url) {
  const trimmed = url.trim();
  if (!trimmed) {
    if (fontFace) document.fonts.delete(fontFace);
    fontFace = null;
    loadedFontUrl = '';
    return 'Arial, sans-serif';
  }
  if (trimmed === loadedFontUrl && fontFace?.status === 'loaded') return 'CreditGeneratorFont';
  if (fontFace) document.fonts.delete(fontFace);
  const next = new FontFace('CreditGeneratorFont', `url(${JSON.stringify(trimmed)})`);
  document.fonts.add(next);
  await next.load();
  fontFace = next;
  loadedFontUrl = trimmed;
  return 'CreditGeneratorFont';
}

function readConfig(fontFamily) {
  const width = Math.round(numberValue(fields.width, 'Width', { min: 2 }));
  const height = Math.round(numberValue(fields.height, 'Height', { min: 2 }));
  const padding = numberValue(fields.padding, 'Horizontal padding', { min: 0 });
  if (padding * 2 >= width) throw new Error('Horizontal padding must leave a positive text width.');
  const fontSize = numberValue(fields.fontSize, 'Font size', { min: 1 });
  const fontWeight = numberValue(fields.fontWeight, 'Font weight', { min: 1, max: 1000 });
  const lineHeight = resolveLineHeight(fields.lineHeight.value, fontSize);
  const fps = numberValue(fields.fps, 'Frame rate', { min: 1, max: 120 });
  const duration = numberValue(fields.duration, 'Credit duration', { min: 0.001 });
  const blankStart = numberValue(fields.blankStart, 'Blank start', { min: 0 });
  const blankEnd = numberValue(fields.blankEnd, 'Blank end', { min: 0 });
  const text = fields.text.value.replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new Error('Text is empty.');
  return {
    text, wrap: fields.wrap.checked, fontUrl: fields.fontUrl.value.trim(), fontFamily,
    fontSize, fontWeight, lineHeight, textAlign: fields.textAlign.value,
    textColor: validateColor(fields.textColor.value.trim(), 'Text color'),
    backgroundColor: validateColor(fields.backgroundColor.value.trim(), 'Background color'),
    padding, width, height, fps, duration, blankStart, blankEnd,
  };
}

function buildLayout(c) {
  const font = `${c.fontWeight} ${c.fontSize}px ${c.fontFamily}`;
  const prepared = prepareWithSegments(c.text, font, { whiteSpace: 'pre-wrap' });
  const contentWidth = c.width - c.padding * 2;
  const layoutWidth = c.wrap
    ? contentWidth
    : Math.max(contentWidth, Math.ceil(measureNaturalWidth(prepared)) + 1);
  const result = layoutWithLines(prepared, layoutWidth, c.lineHeight);
  if (!result.lines.length) throw new Error('Text layout produced no lines.');

  const measureCanvas = document.createElement('canvas');
  const measure = measureCanvas.getContext('2d');
  measure.font = font;
  measure.textBaseline = 'alphabetic';

  const rawBaselines = result.lines.map((_, i) => c.fontSize + i * c.lineHeight);
  let inkTop = Infinity;
  let inkBottom = -Infinity;
  for (let i = 0; i < result.lines.length; i++) {
    const line = result.lines[i].text;
    if (!line.trim()) continue;
    const metrics = measure.measureText(line);
    const ascent = metrics.actualBoundingBoxAscent || c.fontSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || c.fontSize * 0.2;
    inkTop = Math.min(inkTop, rawBaselines[i] - ascent);
    inkBottom = Math.max(inkBottom, rawBaselines[i] + descent);
  }
  if (!Number.isFinite(inkTop) || !Number.isFinite(inkBottom)) throw new Error('Text has no visible characters.');

  return {
    lines: result.lines.map((line, i) => ({ text: line.text, baseline: rawBaselines[i] - inkTop })),
    visualHeight: Math.max(1, inkBottom - inkTop),
    font,
  };
}

function scrollYAt(t, c, plan, l) {
  if (t < plan.start || t >= plan.start + plan.duration) return null;
  const progress = (t - plan.start) / plan.duration;
  const startY = c.height - 1;
  const endY = -l.visualHeight;
  return startY + (endY - startY) * progress;
}

function paint(target, c, l, t, plan) {
  target.fillStyle = c.backgroundColor;
  target.fillRect(0, 0, c.width, c.height);
  const y = scrollYAt(t, c, plan, l);
  if (y === null) return;
  target.save();
  target.beginPath();
  target.rect(0, 0, c.width, c.height);
  target.clip();
  target.fillStyle = c.textColor;
  target.font = l.font;
  target.textBaseline = 'alphabetic';
  target.textAlign = c.textAlign;
  const x = c.textAlign === 'left' ? c.padding : c.textAlign === 'right' ? c.width - c.padding : c.width / 2;
  for (const line of l.lines) target.fillText(line.text, x, y + line.baseline);
  target.restore();
}

function drawPreview() {
  if (!config || !layout) return;
  const plan = framePlan(config);
  const maxPreviewWidth = 800;
  const scale = Math.min(1, maxPreviewWidth / config.width);
  preview.width = Math.max(1, Math.round(config.width * scale));
  preview.height = Math.max(1, Math.round(config.height * scale));
  ctx.save();
  ctx.scale(scale, scale);
  paint(ctx, config, layout, previewTime, plan);
  ctx.restore();
}

function updateInfo() {
  if (!config) return;
  const plan = framePlan(config);
  infoEl.textContent = `${config.width}×${config.height} / ${config.fps} fps / ${plan.totalFrames} frames / ${plan.total.toFixed(3)} s (credit ${plan.duration.toFixed(3)} s)`;
}

async function rebuild() {
  const token = ++updateToken;
  try {
    errorEl.textContent = '';
    const family = await ensureFont(fields.fontUrl.value);
    if (token !== updateToken) return;
    const nextConfig = readConfig(family);
    const nextLayout = buildLayout(nextConfig);
    config = nextConfig;
    layout = nextLayout;
    const total = framePlan(config).total;
    previewTime = Math.min(previewTime, total);
    updateInfo();
    drawPreview();
  } catch (error) {
    if (token !== updateToken) return;
    errorEl.textContent = error instanceof Error ? error.message : String(error);
  }
}

function scheduleRebuild() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(rebuild, 120);
}

function tick(now) {
  if (!playing || !config) return;
  const total = framePlan(config).total;
  previewTime = (now - playStartedAt) / 1000;
  if (previewTime >= total) {
    previewTime = total;
    playing = false;
  }
  drawPreview();
  if (playing) animationFrame = requestAnimationFrame(tick);
}

$('play').addEventListener('click', () => {
  if (!config || !layout || playing) return;
  const total = framePlan(config).total;
  if (previewTime >= total) previewTime = 0;
  playing = true;
  playStartedAt = performance.now() - previewTime * 1000;
  animationFrame = requestAnimationFrame(tick);
});
$('pause').addEventListener('click', () => {
  playing = false;
  cancelAnimationFrame(animationFrame);
});
$('restart').addEventListener('click', () => {
  playing = false;
  cancelAnimationFrame(animationFrame);
  previewTime = 0;
  drawPreview();
});

function syncPickerFromText(textInput, picker) {
  const value = textInput.value.trim();
  if (!CSS.supports('color', value)) return;
  const c = document.createElement('canvas').getContext('2d');
  c.canvas.width = c.canvas.height = 1;
  c.clearRect(0, 0, 1, 1);
  c.fillStyle = value;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  picker.value = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

fields.textColorPicker.addEventListener('input', () => { fields.textColor.value = fields.textColorPicker.value; scheduleRebuild(); });
fields.backgroundColorPicker.addEventListener('input', () => { fields.backgroundColor.value = fields.backgroundColorPicker.value; scheduleRebuild(); });
fields.textColor.addEventListener('input', () => { syncPickerFromText(fields.textColor, fields.textColorPicker); scheduleRebuild(); });
fields.backgroundColor.addEventListener('input', () => { syncPickerFromText(fields.backgroundColor, fields.backgroundColorPicker); scheduleRebuild(); });

for (const [key, field] of Object.entries(fields)) {
  if (key.includes('Color')) continue;
  field.addEventListener('input', scheduleRebuild);
  field.addEventListener('change', scheduleRebuild);
}

exportButton.addEventListener('click', async () => {
  await rebuild();
  if (!config || !layout || errorEl.textContent) return;
  exportButton.disabled = true;
  progressEl.value = 0;
  statusEl.textContent = 'Starting...';

  const worker = new Worker('./export-worker.js', { type: 'module' });
  const plan = framePlan(config);
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      progressEl.value = data.frame / data.total;
      statusEl.textContent = `Rendering ${data.frame} / ${data.total}`;
    } else if (data.type === 'done') {
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'credits.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      progressEl.value = 1;
      statusEl.textContent = 'Done';
      exportButton.disabled = false;
      worker.terminate();
    } else if (data.type === 'error') {
      errorEl.textContent = data.message;
      statusEl.textContent = 'Failed';
      exportButton.disabled = false;
      worker.terminate();
    }
  };
  worker.onerror = (event) => {
    errorEl.textContent = event.message || 'Export worker failed.';
    statusEl.textContent = 'Failed';
    exportButton.disabled = false;
    worker.terminate();
  };
  worker.postMessage({ type: 'export', config, layout, plan });
});

rebuild();
