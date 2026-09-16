import {
  materializeRichInlineLineRange,
  prepareRichInline,
  walkRichInlineLineRanges,
} from 'https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.8/dist/rich-inline.js';

const DEFAULT_FONT_URL = 'https://cdn.jsdelivr.net/gh/projectnoonnu/pretendard@1.0/Pretendard-Thin.woff2';
const FONT_GROUP_ID_RE = /^[A-Za-z0-9_-]+$/;
const $ = (id) => document.getElementById(id);

const fields = {
  text: $('text'), wrap: $('wrap'), textAlign: $('textAlign'),
  textColor: $('textColor'), textColorPicker: $('textColorPicker'),
  backgroundColor: $('backgroundColor'), backgroundColorPicker: $('backgroundColorPicker'),
  padding: $('padding'), width: $('width'), height: $('height'), fps: $('fps'),
  duration: $('duration'), blankStart: $('blankStart'), blankEnd: $('blankEnd'),
  audioFile: $('audioFile'), durationMode: $('durationMode'), volume: $('volume'), audioStart: $('audioStart'),
};

const fontGroupsEl = $('fontGroups');
const addFontGroupButton = $('addFontGroup');
const preview = $('preview');
const ctx = preview.getContext('2d');
const errorEl = $('error');
const infoEl = $('info');
const audioInfoEl = $('audioInfo');
const statusEl = $('status');
const progressEl = $('progress');
const exportButton = $('export');
const timelineEl = $('timeline');
const timelineTimeEl = $('timelineTime');

let fontGroups = [
  {
    id: '0',
    fontUrl: DEFAULT_FONT_URL,
    fontSize: '48',
    fontWeight: '400',
    lineHeight: '1.2',
  },
];
let nextFontGroupId = 1;
let layout = null;
let config = null;
let loadedFontFaces = [];
let loadedFontSignature = '';
let loadedFontFamiliesByUrl = new Map();
let updateToken = 0;
let updateTimer = 0;
let audioDecodeToken = 0;
let audioBuffer = null;
let audioFileName = '';
let playing = false;
let previewTime = 0;
let playStartedAt = 0;
let animationFrame = 0;

function numberValue(input, name, { min = -Infinity, max = Infinity } = {}) {
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
  return value;
}

function optionalNumberValue(raw, fallback, name, { min = -Infinity, max = Infinity } = {}) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return fallback;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
  return value;
}

function validateColor(value, name) {
  if (!CSS.supports('color', value)) throw new Error(`${name} 값이 올바른 CSS 색상이 아닙니다.`);
  return value;
}

function resolveLineHeight(value, fontSize) {
  const raw = String(value).trim();
  if (!raw) throw new Error('행간을 입력하세요.');
  if (/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(raw)) {
    const ratio = Number(raw);
    if (!(ratio > 0)) throw new Error('행간은 0보다 커야 합니다.');
    return ratio * fontSize;
  }
  const probe = document.createElement('span');
  probe.style.cssText = `position:absolute;visibility:hidden;font-size:${fontSize}px;line-height:${raw}`;
  probe.textContent = 'M';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).lineHeight;
  probe.remove();
  const px = Number.parseFloat(computed);
  if (!Number.isFinite(px) || px <= 0) throw new Error('행간은 단위 없는 배율 또는 올바른 CSS 값이어야 합니다.');
  return px;
}

function framePlan({ fps, duration, blankStart, blankEnd, durationMode, audioStart, audioDuration }) {
  const startFrames = Math.max(0, Math.round(blankStart * fps));
  const creditFrames = Math.max(1, Math.round(duration * fps));
  const endFrames = Math.max(0, Math.round(blankEnd * fps));
  const creditTotalFrames = startFrames + creditFrames + endFrames;
  const audioTotalFrames = Math.max(1, Math.round((audioStart + audioDuration) * fps));
  const totalFrames = durationMode === 'audio' ? audioTotalFrames : creditTotalFrames;
  return {
    startFrames, creditFrames, endFrames, totalFrames,
    start: startFrames / fps,
    duration: creditFrames / fps,
    end: endFrames / fps,
    total: totalFrames / fps,
    creditTotal: creditTotalFrames / fps,
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderFontGroups() {
  const base = fontGroups[0];
  fontGroupsEl.innerHTML = fontGroups.map((group, index) => {
    const isBase = index === 0;
    const inherited = (prop) => escapeHtml(base[prop]);
    return `
      <section class="font-group" data-font-group-index="${index}">
        <div class="font-group-header">
          <div class="group-id-wrap">
            <h3>${isBase ? '기본 글꼴' : '글꼴 그룹'}</h3>
            ${isBase
              ? '<span class="muted">ID 0</span>'
              : `<label>ID <input type="text" value="${escapeHtml(group.id)}" data-group-id-index="${index}" spellcheck="false"></label>`}
          </div>
          ${isBase ? '' : `<button type="button" class="remove-group" data-remove-group-index="${index}">삭제</button>`}
        </div>
        <div class="font-group-grid">
          <label>폰트 URL
            <input type="url" value="${escapeHtml(group.fontUrl)}" data-font-group-index="${index}" data-font-prop="fontUrl" ${isBase ? '' : `placeholder="${inherited('fontUrl')}"`}>
            ${isBase ? '' : `<span class="inherit-hint" data-inherit-prop="fontUrl">기본값: ${inherited('fontUrl') || '없음'}</span>`}
          </label>
          <label>글자 크기 (px)
            <input type="number" min="1" step="1" value="${escapeHtml(group.fontSize)}" data-font-group-index="${index}" data-font-prop="fontSize" ${isBase ? '' : `placeholder="${inherited('fontSize')}"`}>
            ${isBase ? '' : `<span class="inherit-hint" data-inherit-prop="fontSize">기본값: ${inherited('fontSize')}px</span>`}
          </label>
          <label>굵기
            <input type="number" min="1" max="1000" step="1" value="${escapeHtml(group.fontWeight)}" data-font-group-index="${index}" data-font-prop="fontWeight" ${isBase ? '' : `placeholder="${inherited('fontWeight')}"`}>
            ${isBase ? '' : `<span class="inherit-hint" data-inherit-prop="fontWeight">기본값: ${inherited('fontWeight')}</span>`}
          </label>
          <label>행간
            <input type="text" value="${escapeHtml(group.lineHeight)}" data-font-group-index="${index}" data-font-prop="lineHeight" ${isBase ? '' : `placeholder="${inherited('lineHeight')}"`}>
            ${isBase ? '' : `<span class="inherit-hint" data-inherit-prop="lineHeight">기본값: ${inherited('lineHeight')}</span>`}
          </label>
        </div>
      </section>
    `;
  }).join('');
}

function updateInheritanceHints() {
  const base = fontGroups[0];
  for (const el of fontGroupsEl.querySelectorAll('[data-inherit-prop]')) {
    const prop = el.dataset.inheritProp;
    const suffix = prop === 'fontSize' ? 'px' : '';
    el.textContent = `기본값: ${base[prop] || '없음'}${base[prop] ? suffix : ''}`;
  }
  for (const input of fontGroupsEl.querySelectorAll('[data-font-group-index]:not([data-font-group-index="0"])[data-font-prop]')) {
    const prop = input.dataset.fontProp;
    input.placeholder = base[prop] || '';
  }
}

function validateFontGroupId(id, currentIndex = -1) {
  if (!id) throw new Error('글꼴 그룹 ID를 입력하세요.');
  if (!FONT_GROUP_ID_RE.test(id)) throw new Error('글꼴 그룹 ID에는 영문, 숫자, _, -만 사용할 수 있습니다.');
  if (id === '0' && currentIndex !== 0) throw new Error('ID 0은 기본 글꼴 전용입니다.');
  if (fontGroups.some((group, index) => index !== currentIndex && group.id === id)) throw new Error(`글꼴 그룹 ID "${id}"가 중복됩니다.`);
}

function renameFontTags(text, oldId, newId) {
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\' && text[i + 1] === '<') {
      const end = text.indexOf('>', i + 2);
      if (end !== -1) {
        result += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    if (text[i] === '<') {
      const end = text.indexOf('>', i + 1);
      if (end !== -1) {
        const token = text.slice(i + 1, end);
        if (token === oldId) {
          result += `<${newId}>`;
          i = end + 1;
          continue;
        }
        if (token === `/${oldId}`) {
          result += `</${newId}>`;
          i = end + 1;
          continue;
        }
      }
    }
    result += text[i];
    i++;
  }
  return result;
}

function parseStyledText(text, groupMap) {
  const segments = [];
  let activeId = '0';
  let openTag = null;
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    const last = segments.at(-1);
    if (last?.groupId === activeId) last.text += buffer;
    else segments.push({ text: buffer, groupId: activeId });
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\' && text[i + 1] === '<') {
      buffer += '<';
      i += 2;
      continue;
    }

    if (text[i] === '<') {
      const end = text.indexOf('>', i + 1);
      if (end !== -1) {
        const token = text.slice(i + 1, end);
        const match = token.match(/^(\/)?([A-Za-z0-9_-]+)$/);
        if (match) {
          const closing = Boolean(match[1]);
          const id = match[2];
          if (!groupMap.has(id)) throw new Error(`존재하지 않는 글꼴 그룹 "${id}"가 사용되었습니다.`);
          flush();
          if (closing) {
            if (openTag !== id) {
              if (openTag === null) throw new Error(`열리지 않은 글꼴 태그 </${id}>가 있습니다.`);
              throw new Error(`글꼴 태그 <${openTag}> 안에서 </${id}>로 닫을 수 없습니다.`);
            }
            openTag = null;
            activeId = '0';
          } else {
            if (openTag !== null) throw new Error('글꼴 태그는 중첩할 수 없습니다.');
            openTag = id;
            activeId = id;
          }
          i = end + 1;
          continue;
        }
      }
    }

    buffer += text[i];
    i++;
  }

  flush();
  if (openTag !== null) throw new Error(`글꼴 태그 <${openTag}>가 닫히지 않았습니다.`);
  return segments;
}

function splitIntoLogicalLines(segments) {
  const lines = [{ items: [], emptyGroupId: '0' }];
  for (const segment of segments) {
    const parts = segment.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const line = lines.at(-1);
      if (parts[i]) {
        const last = line.items.at(-1);
        if (last?.groupId === segment.groupId) last.text += parts[i];
        else line.items.push({ text: parts[i], groupId: segment.groupId });
      } else if (!line.items.length) {
        line.emptyGroupId = segment.groupId;
      }
      if (i < parts.length - 1) lines.push({ items: [], emptyGroupId: segment.groupId });
    }
  }
  return lines;
}

function resolveFontGroups() {
  const base = fontGroups[0];
  if (!base) throw new Error('기본 글꼴이 없습니다.');
  validateFontGroupId(base.id, 0);

  const baseFontSize = optionalNumberValue(base.fontSize, NaN, '기본 글자 크기', { min: 1 });
  const baseFontWeight = optionalNumberValue(base.fontWeight, NaN, '기본 굵기', { min: 1, max: 1000 });
  if (!Number.isFinite(baseFontSize)) throw new Error('기본 글자 크기를 입력하세요.');
  if (!Number.isFinite(baseFontWeight)) throw new Error('기본 굵기를 입력하세요.');
  const baseLineHeightRaw = String(base.lineHeight).trim();
  if (!baseLineHeightRaw) throw new Error('기본 행간을 입력하세요.');

  return fontGroups.map((group, index) => {
    validateFontGroupId(group.id, index);
    const fontSize = index === 0
      ? baseFontSize
      : optionalNumberValue(group.fontSize, baseFontSize, `글꼴 그룹 ${group.id} 글자 크기`, { min: 1 });
    const fontWeight = index === 0
      ? baseFontWeight
      : optionalNumberValue(group.fontWeight, baseFontWeight, `글꼴 그룹 ${group.id} 굵기`, { min: 1, max: 1000 });
    const lineHeightRaw = index === 0 ? baseLineHeightRaw : String(group.lineHeight).trim() || baseLineHeightRaw;
    const fontUrl = index === 0 ? String(base.fontUrl).trim() : String(group.fontUrl).trim() || String(base.fontUrl).trim();
    return {
      id: group.id,
      fontUrl,
      fontSize,
      fontWeight,
      lineHeightRaw,
      lineHeight: resolveLineHeight(lineHeightRaw, fontSize),
    };
  });
}

async function ensureFontFamilies(groups, token) {
  const urls = [...new Set(groups.map((group) => group.fontUrl).filter(Boolean))];
  const signature = JSON.stringify(urls);
  let familiesByUrl = loadedFontFamiliesByUrl;

  if (signature !== loadedFontSignature) {
    const nextFaces = [];
    const nextFamiliesByUrl = new Map();
    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        const family = `CreditGeneratorFont_${token}_${i}`;
        const face = new FontFace(family, `url(${JSON.stringify(url)})`);
        document.fonts.add(face);
        await face.load();
        nextFaces.push(face);
        nextFamiliesByUrl.set(url, family);
      }
    } catch (error) {
      for (const face of nextFaces) document.fonts.delete(face);
      throw error;
    }

    if (token !== updateToken) {
      for (const face of nextFaces) document.fonts.delete(face);
      return null;
    }

    for (const face of loadedFontFaces) document.fonts.delete(face);
    loadedFontFaces = nextFaces;
    loadedFontFamiliesByUrl = nextFamiliesByUrl;
    loadedFontSignature = signature;
    familiesByUrl = nextFamiliesByUrl;
  }

  return groups.map((group) => {
    const fontFamily = group.fontUrl ? familiesByUrl.get(group.fontUrl) : 'Arial, sans-serif';
    return {
      ...group,
      fontFamily,
      font: `${group.fontWeight} ${group.fontSize}px ${fontFamily}`,
    };
  });
}

function readConfig(resolvedFontGroups) {
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
  const audioDuration = audioBuffer?.duration ?? 0;
  if (durationMode === 'audio' && !audioBuffer) throw new Error('음성 파일 길이를 사용하려면 음성 파일을 추가하세요.');
  const text = fields.text.value.replace(/\r\n?/g, '\n');
  if (!text.trim()) throw new Error('크레딧 문구를 입력하세요.');
  return {
    text,
    wrap: fields.wrap.checked,
    textAlign: fields.textAlign.value,
    fontGroups: resolvedFontGroups,
    textColor: validateColor(fields.textColor.value.trim(), '글자색'),
    backgroundColor: validateColor(fields.backgroundColor.value.trim(), '배경색'),
    padding, width, height, fps, duration, blankStart, blankEnd,
    durationMode, volume, audioStart, audioDuration,
  };
}

function metricsForRun(measure, text, style) {
  if (!text || !text.trim()) return { ascent: 0, descent: 0, visible: false };
  measure.font = style.font;
  const metrics = measure.measureText(text);
  return {
    ascent: metrics.actualBoundingBoxAscent || style.fontSize * 0.8,
    descent: metrics.actualBoundingBoxDescent || style.fontSize * 0.2,
    visible: true,
  };
}

function finalizeLine(runs, width, measure, baseStyle) {
  if (!runs.length) {
    return {
      runs: [], width: 0, lineHeight: baseStyle.lineHeight,
      ascent: 0, descent: 0, visible: false, baseline: 0,
    };
  }

  let lineHeight = 0;
  let ascent = 0;
  let descent = 0;
  let visible = false;
  for (const run of runs) {
    lineHeight = Math.max(lineHeight, run.lineHeight);
    const metrics = metricsForRun(measure, run.text, run);
    if (metrics.visible) {
      visible = true;
      ascent = Math.max(ascent, metrics.ascent);
      descent = Math.max(descent, metrics.descent);
    }
  }
  return {
    runs, width,
    lineHeight: lineHeight || baseStyle.lineHeight,
    ascent, descent, visible, baseline: 0,
  };
}

function layoutUnwrappedLine(items, stylesById, measure, baseStyle) {
  let x = 0;
  const runs = [];
  for (const item of items) {
    if (!item.text) continue;
    const style = stylesById.get(item.groupId);
    measure.font = style.font;
    const width = measure.measureText(item.text).width;
    runs.push({
      text: item.text,
      x,
      width,
      font: style.font,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
    });
    x += width;
  }
  return [finalizeLine(runs, x, measure, baseStyle)];
}

function layoutWrappedLine(items, stylesById, measure, baseStyle, contentWidth) {
  if (!items.length || items.every((item) => !item.text.trim())) {
    return [finalizeLine([], 0, measure, baseStyle)];
  }

  const richItems = items
    .filter((item) => item.text.length > 0)
    .map((item) => {
      const style = stylesById.get(item.groupId);
      return { text: item.text, font: style.font, groupId: item.groupId };
    });
  if (!richItems.length) return [finalizeLine([], 0, measure, baseStyle)];

  const prepared = prepareRichInline(richItems.map(({ text, font }) => ({ text, font })));
  const lines = [];
  walkRichInlineLineRanges(prepared, contentWidth, (range) => {
    const materialized = materializeRichInlineLineRange(prepared, range);
    const runs = [];
    let x = 0;
    for (const fragment of materialized.fragments) {
      const source = richItems[fragment.itemIndex];
      const style = stylesById.get(source.groupId);
      x += fragment.gapBefore;
      runs.push({
        text: fragment.text,
        x,
        width: fragment.occupiedWidth,
        font: style.font,
        fontSize: style.fontSize,
        lineHeight: style.lineHeight,
      });
      x += fragment.occupiedWidth;
    }
    lines.push(finalizeLine(runs, materialized.width, measure, baseStyle));
  });
  return lines.length ? lines : [finalizeLine([], 0, measure, baseStyle)];
}

function buildLayout(c) {
  const groupMap = new Map(c.fontGroups.map((group) => [group.id, group]));
  const parsed = parseStyledText(c.text, groupMap);
  const logicalLines = splitIntoLogicalLines(parsed);
  const measureCanvas = document.createElement('canvas');
  const measure = measureCanvas.getContext('2d');
  measure.textBaseline = 'alphabetic';
  const baseStyle = c.fontGroups[0];
  const contentWidth = c.width - c.padding * 2;
  const lines = [];

  for (const logicalLine of logicalLines) {
    const emptyStyle = groupMap.get(logicalLine.emptyGroupId) || baseStyle;
    const laidOut = c.wrap
      ? layoutWrappedLine(logicalLine.items, groupMap, measure, emptyStyle, contentWidth)
      : layoutUnwrappedLine(logicalLine.items, groupMap, measure, emptyStyle);
    lines.push(...laidOut);
  }

  let rawBaseline = 0;
  let previousLineHeight = 0;
  let inkTop = Infinity;
  let inkBottom = -Infinity;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) rawBaseline += previousLineHeight;
    const line = lines[i];
    line.baseline = rawBaseline;
    previousLineHeight = line.lineHeight;
    if (!line.visible) continue;
    inkTop = Math.min(inkTop, rawBaseline - line.ascent);
    inkBottom = Math.max(inkBottom, rawBaseline + line.descent);
  }

  if (!Number.isFinite(inkTop) || !Number.isFinite(inkBottom)) throw new Error('표시할 수 있는 문자가 없습니다.');
  for (const line of lines) line.baseline -= inkTop;

  const fonts = [...new Map(
    c.fontGroups
      .filter((group) => group.fontUrl)
      .map((group) => [group.fontFamily, { family: group.fontFamily, url: group.fontUrl }]),
  ).values()];

  return {
    lines,
    visualHeight: Math.max(1, inkBottom - inkTop),
    fonts,
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
  target.textBaseline = 'alphabetic';
  target.textAlign = 'left';

  for (const line of l.lines) {
    let originX;
    if (c.textAlign === 'left') originX = c.padding;
    else if (c.textAlign === 'right') originX = c.width - c.padding - line.width;
    else originX = (c.width - line.width) / 2;

    for (const run of line.runs) {
      target.font = run.font;
      target.fillText(run.text, originX + run.x, y + line.baseline);
    }
  }
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

function updateAudioInfo() {
  if (!audioBuffer) {
    audioInfoEl.textContent = '음성 파일 없음';
    return;
  }
  audioInfoEl.textContent = `${audioFileName} / ${audioBuffer.duration.toFixed(3)}초 / ${audioBuffer.sampleRate}Hz / ${audioBuffer.numberOfChannels}채널`;
}

function updateInfo() {
  if (!config) return;
  const plan = framePlan(config);
  const source = config.durationMode === 'audio' ? '음성' : '크레딧';
  infoEl.textContent = `${config.width}×${config.height} / ${config.fps} fps / ${plan.totalFrames}프레임 / ${plan.total.toFixed(3)}초 (${source} 기준)`;
}

function updateTimeline() {
  if (!config) return;
  const total = framePlan(config).total;
  previewTime = Math.min(Math.max(0, previewTime), total);
  timelineEl.max = String(total);
  timelineEl.value = String(previewTime);
  timelineTimeEl.textContent = `${previewTime.toFixed(3)} / ${total.toFixed(3)}초`;
}

async function rebuild() {
  const token = ++updateToken;
  try {
    errorEl.textContent = '';
    const unresolvedGroups = resolveFontGroups();
    const resolvedGroups = await ensureFontFamilies(unresolvedGroups, token);
    if (token !== updateToken || !resolvedGroups) return;
    const nextConfig = readConfig(resolvedGroups);
    const nextLayout = buildLayout(nextConfig);
    config = nextConfig;
    layout = nextLayout;
    previewTime = Math.min(previewTime, framePlan(config).total);
    updateInfo();
    updateTimeline();
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
  updateTimeline();
  if (playing) animationFrame = requestAnimationFrame(tick);
}

function stopPlayback() {
  playing = false;
  cancelAnimationFrame(animationFrame);
}

$('play').addEventListener('click', () => {
  if (!config || !layout || playing) return;
  const total = framePlan(config).total;
  if (previewTime >= total) previewTime = 0;
  playing = true;
  playStartedAt = performance.now() - previewTime * 1000;
  updateTimeline();
  animationFrame = requestAnimationFrame(tick);
});

$('pause').addEventListener('click', stopPlayback);

$('restart').addEventListener('click', () => {
  stopPlayback();
  previewTime = 0;
  drawPreview();
  updateTimeline();
});

timelineEl.addEventListener('input', () => {
  if (!config || !layout) return;
  previewTime = Number(timelineEl.value);
  if (playing) playStartedAt = performance.now() - previewTime * 1000;
  drawPreview();
  updateTimeline();
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

fields.audioFile.addEventListener('change', async () => {
  const token = ++audioDecodeToken;
  const file = fields.audioFile.files?.[0];
  audioBuffer = null;
  audioFileName = '';
  updateAudioInfo();
  if (!file) {
    scheduleRebuild();
    return;
  }

  audioInfoEl.textContent = '음성 파일 읽는 중...';
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
    } finally {
      await audioContext.close();
    }
  } catch (error) {
    if (token !== audioDecodeToken) return;
    audioBuffer = null;
    audioFileName = '';
    audioInfoEl.textContent = '음성 파일을 읽을 수 없습니다.';
    errorEl.textContent = error instanceof Error ? error.message : String(error);
  }
  scheduleRebuild();
});

fontGroupsEl.addEventListener('input', (event) => {
  const input = event.target.closest('[data-font-prop]');
  if (!input) return;
  const index = Number(input.dataset.fontGroupIndex);
  const prop = input.dataset.fontProp;
  if (!fontGroups[index] || !prop) return;
  fontGroups[index][prop] = input.value;
  if (index === 0) updateInheritanceHints();
  scheduleRebuild();
});

fontGroupsEl.addEventListener('change', (event) => {
  const input = event.target.closest('[data-group-id-index]');
  if (!input) return;
  const index = Number(input.dataset.groupIdIndex);
  const group = fontGroups[index];
  if (!group) return;
  const oldId = group.id;
  const newId = input.value.trim();
  try {
    validateFontGroupId(newId, index);
    group.id = newId;
    fields.text.value = renameFontTags(fields.text.value, oldId, newId);
    errorEl.textContent = '';
    scheduleRebuild();
  } catch (error) {
    input.value = oldId;
    errorEl.textContent = error instanceof Error ? error.message : String(error);
  }
});

fontGroupsEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-group-index]');
  if (!button) return;
  const index = Number(button.dataset.removeGroupIndex);
  if (!(index > 0) || !fontGroups[index]) return;
  fontGroups.splice(index, 1);
  renderFontGroups();
  scheduleRebuild();
});

addFontGroupButton.addEventListener('click', () => {
  const used = new Set(fontGroups.map((group) => group.id));
  while (used.has(String(nextFontGroupId))) nextFontGroupId++;
  fontGroups.push({
    id: String(nextFontGroupId++),
    fontUrl: '',
    fontSize: '',
    fontWeight: '',
    lineHeight: '',
  });
  renderFontGroups();
  scheduleRebuild();
});

for (const [key, field] of Object.entries(fields)) {
  if (key.includes('Color') || key === 'audioFile') continue;
  field.addEventListener('input', scheduleRebuild);
  field.addEventListener('change', scheduleRebuild);
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

exportButton.addEventListener('click', async () => {
  await rebuild();
  if (!config || !layout || errorEl.textContent) return;
  exportButton.disabled = true;
  progressEl.value = 0;
  statusEl.textContent = '시작 중...';

  const worker = new Worker('./export-worker.js', { type: 'module' });
  const plan = framePlan(config);
  const audio = createAudioPayload();
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      progressEl.value = data.frame / data.total;
      statusEl.textContent = `렌더링 중 ${data.frame} / ${data.total}`;
    } else if (data.type === 'status') {
      statusEl.textContent = data.message;
    } else if (data.type === 'done') {
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'credits.mp4';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      progressEl.value = 1;
      statusEl.textContent = '완료';
      exportButton.disabled = false;
      worker.terminate();
    } else if (data.type === 'error') {
      errorEl.textContent = data.message;
      statusEl.textContent = '실패';
      exportButton.disabled = false;
      worker.terminate();
    }
  };
  worker.onerror = (event) => {
    errorEl.textContent = event.message || '내보내기 작업을 실행하지 못했습니다.';
    statusEl.textContent = '실패';
    exportButton.disabled = false;
    worker.terminate();
  };
  const transfer = audio ? [audio.data] : [];
  worker.postMessage({ type: 'export', config, layout, plan, audio }, transfer);
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
renderFontGroups();
updateAudioInfo();
rebuild();
