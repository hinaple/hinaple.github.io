import {
  materializeRichInlineLineRange,
  prepareRichInline,
  walkRichInlineLineRanges,
} from 'https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.8/dist/rich-inline.js';

export const DEFAULT_FONT_URL = 'https://github.com/orioncactus/pretendard/raw/refs/heads/main/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';
const FONT_GROUP_ID_RE = /^[A-Za-z0-9_-]+$/;

const INITIAL_FONT_GROUPS = [
  {
    id: '0',
    fontUrl: DEFAULT_FONT_URL,
    fontSize: '36',
    fontWeight: '400',
    lineHeight: '2',
  },
  {
    id: 'b',
    fontUrl: '',
    fontSize: '48',
    fontWeight: '800',
    lineHeight: '2.2',
  },
];

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function optionalNumberValue(raw, fallback, name, { min = -Infinity, max = Infinity } = {}) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return fallback;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
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
      runs: [],
      width: 0,
      lineHeight: baseStyle.lineHeight,
      ascent: 0,
      descent: 0,
      visible: false,
      baseline: 0,
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
    runs,
    width,
    lineHeight: lineHeight || baseStyle.lineHeight,
    ascent,
    descent,
    visible,
    baseline: 0,
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

function buildLayout(text, groups, { wrap, width, padding }) {
  const groupMap = new Map(groups.map((group) => [group.id, group]));
  const parsed = parseStyledText(text, groupMap);
  const logicalLines = splitIntoLogicalLines(parsed);
  const measureCanvas = document.createElement('canvas');
  const measure = measureCanvas.getContext('2d');
  measure.textBaseline = 'alphabetic';
  const baseStyle = groups[0];
  const contentWidth = width - padding * 2;
  const lines = [];

  for (const logicalLine of logicalLines) {
    const emptyStyle = groupMap.get(logicalLine.emptyGroupId) || baseStyle;
    const laidOut = wrap
      ? layoutWrappedLine(logicalLine.items, groupMap, measure, emptyStyle, contentWidth)
      : layoutUnwrappedLine(logicalLine.items, groupMap, measure, emptyStyle);
    lines.push(...laidOut);
  }

  let rawBaseline = 0;
  let previousLineHeight = 0;
  let inkTop = Infinity;
  let inkBottom = -Infinity;
  let maxAscent = 0;
  let maxDescent = 0;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) rawBaseline += previousLineHeight;
    const line = lines[i];
    line.baseline = rawBaseline;
    previousLineHeight = line.lineHeight;
    if (!line.visible) continue;
    inkTop = Math.min(inkTop, rawBaseline - line.ascent);
    inkBottom = Math.max(inkBottom, rawBaseline + line.descent);
    maxAscent = Math.max(maxAscent, line.ascent);
    maxDescent = Math.max(maxDescent, line.descent);
  }

  if (!Number.isFinite(inkTop) || !Number.isFinite(inkBottom)) throw new Error('표시할 수 있는 문자가 없습니다.');
  for (const line of lines) line.baseline -= inkTop;

  const fonts = [...new Map(
    groups
      .filter((group) => group.fontUrl)
      .map((group) => [group.fontFamily, {
        family: group.fontFamily,
        url: group.fontUrl,
        weight: group.fontWeight,
      }]),
  ).values()];

  return {
    lines,
    visualHeight: Math.max(1, inkBottom - inkTop),
    maxAscent,
    maxDescent,
    fonts,
  };
}

export function createFontGroupManager({ container, addButton, textInput, onChange, onError }) {
  let fontGroups = INITIAL_FONT_GROUPS.map((group) => ({ ...group }));
  let nextFontGroupId = 1;
  let loadedFontFaces = [];
  let loadedFontSignature = '';
  let loadedFontFamiliesByKey = new Map();
  let prepareGeneration = 0;

  function validateFontGroupId(id, currentIndex = -1) {
    if (!id) throw new Error('글꼴 그룹 ID를 입력하세요.');
    if (!FONT_GROUP_ID_RE.test(id)) throw new Error('글꼴 그룹 ID에는 영문, 숫자, _, -만 사용할 수 있습니다.');
    if (id === '0' && currentIndex !== 0) throw new Error('ID 0은 기본 글꼴 전용입니다.');
    if (fontGroups.some((group, index) => index !== currentIndex && group.id === id)) {
      throw new Error(`글꼴 그룹 ID "${id}"가 중복됩니다.`);
    }
  }

  function render() {
    const base = fontGroups[0];
    container.innerHTML = fontGroups.map((group, index) => {
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
    for (const el of container.querySelectorAll('[data-inherit-prop]')) {
      const prop = el.dataset.inheritProp;
      const suffix = prop === 'fontSize' ? 'px' : '';
      el.textContent = `기본값: ${base[prop] || '없음'}${base[prop] ? suffix : ''}`;
    }
    for (const input of container.querySelectorAll('[data-font-group-index]:not([data-font-group-index="0"])[data-font-prop]')) {
      const prop = input.dataset.fontProp;
      input.placeholder = base[prop] || '';
    }
  }

  function resolveGroups() {
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

  async function ensureFontFamilies(groups, generation) {
    const keys = [...new Set(groups
      .filter((group) => group.fontUrl)
      .map((group) => `${group.fontUrl}\u0000${group.fontWeight}`))];
    const signature = JSON.stringify(keys);
    let familiesByKey = loadedFontFamiliesByKey;

    if (signature !== loadedFontSignature) {
      const nextFaces = [];
      const nextFamiliesByKey = new Map();
      try {
        for (let i = 0; i < keys.length; i++) {
          const [url, weight] = keys[i].split('\u0000');
          const family = `CreditGeneratorFont_${generation}_${i}`;
          const face = new FontFace(family, `url(${JSON.stringify(url)})`, { weight });
          document.fonts.add(face);
          await face.load();
          nextFaces.push(face);
          nextFamiliesByKey.set(keys[i], family);
        }
      } catch (error) {
        for (const face of nextFaces) document.fonts.delete(face);
        throw error;
      }

      if (generation !== prepareGeneration) {
        for (const face of nextFaces) document.fonts.delete(face);
        return null;
      }

      for (const face of loadedFontFaces) document.fonts.delete(face);
      loadedFontFaces = nextFaces;
      loadedFontFamiliesByKey = nextFamiliesByKey;
      loadedFontSignature = signature;
      familiesByKey = nextFamiliesByKey;
    }

    return groups.map((group) => {
      const key = `${group.fontUrl}\u0000${group.fontWeight}`;
      const fontFamily = group.fontUrl ? familiesByKey.get(key) : 'Arial, sans-serif';
      return {
        ...group,
        fontFamily,
        font: `${group.fontWeight} ${group.fontSize}px ${fontFamily}`,
      };
    });
  }

  async function prepareLayout(text, options) {
    const generation = ++prepareGeneration;
    const groups = resolveGroups();
    const resolvedGroups = await ensureFontFamilies(groups, generation);
    if (!resolvedGroups || generation !== prepareGeneration) return null;
    return buildLayout(text, resolvedGroups, options);
  }

  container.addEventListener('input', (event) => {
    const input = event.target.closest('[data-font-prop]');
    if (!input) return;
    const index = Number(input.dataset.fontGroupIndex);
    const prop = input.dataset.fontProp;
    if (!fontGroups[index] || !prop) return;
    fontGroups[index][prop] = input.value;
    if (index === 0) updateInheritanceHints();
    onChange();
  });

  container.addEventListener('change', (event) => {
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
      textInput.value = renameFontTags(textInput.value, oldId, newId);
      onError('');
      onChange();
    } catch (error) {
      input.value = oldId;
      onError(error instanceof Error ? error.message : String(error));
    }
  });

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-group-index]');
    if (!button) return;
    const index = Number(button.dataset.removeGroupIndex);
    if (!(index > 0) || !fontGroups[index]) return;
    fontGroups.splice(index, 1);
    render();
    onChange();
  });

  addButton.addEventListener('click', () => {
    const used = new Set(fontGroups.map((group) => group.id));
    while (used.has(String(nextFontGroupId))) nextFontGroupId++;
    fontGroups.push({
      id: String(nextFontGroupId++),
      fontUrl: '',
      fontSize: '',
      fontWeight: '',
      lineHeight: '',
    });
    render();
    onChange();
  });

  render();

  return { prepareLayout };
}
