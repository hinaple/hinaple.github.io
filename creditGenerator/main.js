import { createAudioExportController } from './audio-export.js';
import { createFontGroupManager } from './font-groups.js';
import { createPreviewController } from './preview.js';
import { framePlan } from './render.js';

const $ = (id) => document.getElementById(id);

const fields = {
  text: $('text'),
  wrap: $('wrap'),
  textAlign: $('textAlign'),
  textColor: $('textColor'),
  textColorPicker: $('textColorPicker'),
  backgroundColor: $('backgroundColor'),
  backgroundColorPicker: $('backgroundColorPicker'),
  padding: $('padding'),
  width: $('width'),
  height: $('height'),
  fps: $('fps'),
  duration: $('duration'),
  blankStart: $('blankStart'),
  blankEnd: $('blankEnd'),
  durationMode: $('durationMode'),
  volume: $('volume'),
  audioStart: $('audioStart'),
};

const errorEl = $('error');
const infoEl = $('info');
let config = null;
let layout = null;
let rebuildToken = 0;
let updateTimer = 0;

function setError(message) {
  errorEl.textContent = message;
}

function numberValue(input, name, { min = -Infinity, max = Infinity } = {}) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
  return value;
}

function validateColor(value, name) {
  if (!CSS.supports('color', value)) throw new Error(`${name} 값이 올바른 CSS 색상이 아닙니다.`);
  return value;
}

const previewController = createPreviewController({
  canvas: $('preview'),
  timeline: $('timeline'),
  timelineTime: $('timelineTime'),
  playButton: $('play'),
  pauseButton: $('pause'),
  restartButton: $('restart'),
});

let scheduleRebuild = () => {};

const audioExportController = createAudioExportController({
  audioInput: $('audioFile'),
  audioInfo: $('audioInfo'),
  exportButton: $('export'),
  progress: $('progress'),
  status: $('status'),
  onAudioChange: () => scheduleRebuild(),
  onError: setError,
});

const fontGroupManager = createFontGroupManager({
  container: $('fontGroups'),
  addButton: $('addFontGroup'),
  textInput: fields.text,
  onChange: () => scheduleRebuild(),
  onError: setError,
});

function readConfig() {
  const width = Math.round(numberValue(fields.width, '너비', { min: 2 }));
  const height = Math.round(numberValue(fields.height, '높이', { min: 2 }));
  const padding = numberValue(fields.padding, '가로 여백', { min: 0 });
  if (padding * 2 >= width) throw new Error('가로 여백을 제외한 텍스트 영역의 너비가 0보다 커야 합니다.');
  const fps = numberValue(fields.fps, '프레임레이트', { min: 1, max: 120 });
  const duration = numberValue(fields.duration, '크레딧 길이', { min: 0.001 });
  const blankStart = numberValue(fields.blankStart, '시작 공백', { min: 0 });
  const blankEnd = numberValue(fields.blankEnd, '끝 공백', { min: 0 });
  const volume = numberValue(fields.volume, '볼륨', { min: 0, max: 2 });
  const audioStart = numberValue(fields.audioStart, '음성 시작', { min: 0 });
  const durationMode = fields.durationMode.value;
  const audioDuration = audioExportController.getDuration();
  if (durationMode === 'audio' && audioDuration === 0) throw new Error('음성 파일 길이를 사용하려면 음성 파일을 추가하세요.');
  const text = fields.text.value.replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new Error('크레딧 문구를 입력하세요.');

  return {
    text,
    wrap: fields.wrap.checked,
    textAlign: fields.textAlign.value,
    textColor: validateColor(fields.textColor.value.trim(), '글자색'),
    backgroundColor: validateColor(fields.backgroundColor.value.trim(), '배경색'),
    padding,
    width,
    height,
    fps,
    duration,
    blankStart,
    blankEnd,
    durationMode,
    volume,
    audioStart,
    audioDuration,
  };
}

function updateInfo() {
  if (!config) return;
  const plan = framePlan(config);
  const source = config.durationMode === 'audio' ? '음성' : '크레딧';
  infoEl.textContent = `${config.width}×${config.height} / ${config.fps} fps / ${plan.totalFrames}프레임 / ${plan.total.toFixed(3)}초 (${source} 기준)`;
}

async function rebuild() {
  const token = ++rebuildToken;
  try {
    setError('');
    const nextConfig = readConfig();
    const nextLayout = await fontGroupManager.prepareLayout(nextConfig.text, {
      wrap: nextConfig.wrap,
      width: nextConfig.width,
      padding: nextConfig.padding,
    });
    if (token !== rebuildToken || !nextLayout) return false;

    config = nextConfig;
    layout = nextLayout;
    updateInfo();
    previewController.setScene(config, layout);
    return true;
  } catch (error) {
    if (token !== rebuildToken) return false;
    setError(error instanceof Error ? error.message : String(error));
    return false;
  }
}

scheduleRebuild = () => {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(rebuild, 120);
};

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

fields.textColorPicker.addEventListener('input', () => {
  fields.textColor.value = fields.textColorPicker.value;
  scheduleRebuild();
});
fields.backgroundColorPicker.addEventListener('input', () => {
  fields.backgroundColor.value = fields.backgroundColorPicker.value;
  scheduleRebuild();
});
fields.textColor.addEventListener('input', () => {
  syncPickerFromText(fields.textColor, fields.textColorPicker);
  scheduleRebuild();
});
fields.backgroundColor.addEventListener('input', () => {
  syncPickerFromText(fields.backgroundColor, fields.backgroundColorPicker);
  scheduleRebuild();
});

for (const [key, field] of Object.entries(fields)) {
  if (key.includes('Color')) continue;
  field.addEventListener('input', scheduleRebuild);
  field.addEventListener('change', scheduleRebuild);
}

$('export').addEventListener('click', async () => {
  if (!await rebuild() || !config || !layout || errorEl.textContent) return;
  await audioExportController.exportVideo(config, layout);
});

function initTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panels = [...document.querySelectorAll('[role="tabpanel"]')];

  function activateTab(tab, focus = false) {
    const name = tab.dataset.tab;
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== name;
    if (focus) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      activateTab(next, true);
    });
  }

  if (tabs[0]) activateTab(tabs[0]);
}

initTabs();
rebuild();
