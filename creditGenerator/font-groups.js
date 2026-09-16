import ColorPicker from 'https://cdn.jsdelivr.net/gh/wipeautcrafter/jscolorpicker@main/dist/colorpicker.min.js';
import {
  materializeRichInlineLineRange,
  prepareRichInline,
  walkRichInlineLineRanges,
} from 'https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.8/dist/rich-inline.js';

export const DEFAULT_FONT_URL = 'https://rawcdn.githack.com/orioncactus/pretendard/refs/heads/main/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2';
const FONT_GROUP_ID_RE = /^[A-Za-z0-9_-]+$/;
const SPACER_CHAR = '\u200b';

const INITIAL_FONT_GROUPS = [
  { id: '0', fontUrl: DEFAULT_FONT_URL, fontSize: '36', fontWeight: '400', lineHeight: '2', color: '#ffffff' },
  { id: 'b', fontUrl: '', fontSize: '48', fontWeight: '800', lineHeight: '2.2', color: '' },
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

function validateCssColor(value, name) {
  if (!CSS.supports('color', value)) throw new Error(`${name} 값이 올바른 CSS 색상이 아닙니다.`);
  return value;
}

function renameFontTags(text, oldId, newId) {
  return text.replace(new RegExp(`<(/?)${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`, 'g'), `<$1${newId}>`);
}

function parseSource(text, groupMap) {
  const tokens = [];
  let activeId = '0';
  let openTag = null;
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    const last = tokens.at(-1);
    if (last?.kind === 'text' && last.groupId === activeId) last.text += buffer;
    else tokens.push({ kind: 'text', text: buffer, groupId: activeId });
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    if (text[i] === '\\' && (text[i + 1] === '<' || text[i + 1] === '{')) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (text.startsWith('{#', i)) {
      const end = text.indexOf('}', i + 2);
      if (end !== -1) {
        const body = text.slice(i + 2, end);
        const match = body.match(/^(width|height)=(\d+(?:\.\d+)?)$/);
        if (match) {
          const value = Number(match[2]);
          flush();
          tokens.push({ kind: match[1], value });
          i = end + 1;
          if (match[1] === 'height' && text[i] === '\n') i++;
          continue;
        }
      }
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
  return tokens;
}

function splitIntoLogicalLines(tokens) {
  const lines = [{ items: [], emptyGroupId: '0' }];
  const current = () => lines.at(-1);

  for (const token of tokens) {
    if (token.kind === 'height') {
      if (current().items.length) lines.push({ items: [], emptyGroupId: '0' });
      const line = current();
      line.spacerHeight = token.value;
      lines.push({ items: [], emptyGroupId: '0' });
      continue;
    }

    if (token.kind === 'width') {
      current().items.push({ kind: 'width', width: token.value });
      continue;
    }

    const parts = token.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const line = current();
      if (parts[i]) {
        const last = line.items.at(-1);
        if (last?.kind === 'text' && last.groupId === token.groupId) last.text += parts[i];
        else line.items.push({ kind: 'text', text: parts[i], groupId: token.groupId });
      } else if (!line.items.length) {
        line.emptyGroupId = token.groupId;
      }
      if (i < parts.length - 1) lines.push({ items: [], emptyGroupId: token.groupId });
    }
  }

  if (lines.length > 1 && !lines.at(-1).items.length && lines.at(-1).spacerHeight == null) lines.pop();
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

function finalizeLine(runs, width, measure, baseStyle, forcedHeight = null) {
  if (forcedHeight != null) {
    return { runs: [], width: 0, lineHeight: forcedHeight, ascent: 0, descent: 0, visible: false, baseline: 0 };
  }
  if (!runs.length) {
    return { runs: [], width: 0, lineHeight: baseStyle.lineHeight, ascent: 0, descent: 0, visible: false, baseline: 0 };
  }
  let lineHeight = 0;
  let ascent = 0;
  let descent = 0;
  let visible = false;
  for (const run of runs) {
    lineHeight = Math.max(lineHeight, run.lineHeight ?? baseStyle.lineHeight);
    if (run.kind === 'width') continue;
    const metrics = metricsForRun(measure, run.text, run);
    if (metrics.visible) {
      visible = true;
      ascent = Math.max(ascent, metrics.ascent);
      descent = Math.max(descent, metrics.descent);
    }
  }
  return { runs, width, lineHeight: lineHeight || baseStyle.lineHeight, ascent, descent, visible, baseline: 0 };
}

function layoutUnwrappedLine(items, stylesById, measure, baseStyle) {
  let x = 0;
  const runs = [];
  for (const item of items) {
    if (item.kind === 'width') {
      runs.push({ kind: 'width', x, width: item.width, lineHeight: baseStyle.lineHeight });
      x += item.width;
      continue;
    }
    if (!item.text) continue;
    const style = stylesById.get(item.groupId);
    measure.font = style.font;
    const width = measure.measureText(item.text).width;
    runs.push({ kind: 'text', text: item.text, x, width, font: style.font, fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color });
    x += width;
  }
  return [finalizeLine(runs, x, measure, baseStyle)];
}

function layoutWrappedLine(items, stylesById, measure, baseStyle, contentWidth) {
  if (!items.length) return [finalizeLine([], 0, measure, baseStyle)];

  const richItems = items.map((item) => {
    if (item.kind === 'width') {
      return { kind: 'width', text: SPACER_CHAR, font: `1px Arial`, extraWidth: item.width, groupId: null };
    }
    const style = stylesById.get(item.groupId);
    return { kind: 'text', text: item.text, font: style.font, extraWidth: 0, groupId: item.groupId };
  });

  const prepared = prepareRichInline(richItems.map((item) => ({
    text: item.text,
    font: item.font,
    break: item.kind === 'width' ? 'never' : 'normal',
    extraWidth: item.extraWidth,
  })));

  const lines = [];
  walkRichInlineLineRanges(prepared, contentWidth, (range) => {
    const materialized = materializeRichInlineLineRange(prepared, range);
    const runs = [];
    let x = 0;
    for (const fragment of materialized.fragments) {
      const source = richItems[fragment.itemIndex];
      x += fragment.gapBefore;
      if (source.kind === 'width') {
        runs.push({ kind: 'width', x, width: fragment.occupiedWidth, lineHeight: baseStyle.lineHeight });
      } else {
        const style = stylesById.get(source.groupId);
        runs.push({ kind: 'text', text: fragment.text, x, width: fragment.occupiedWidth, font: style.font, fontSize: style.fontSize, lineHeight: style.lineHeight, color: style.color });
      }
      x += fragment.occupiedWidth;
    }
    lines.push(finalizeLine(runs, materialized.width, measure, baseStyle));
  });
  return lines.length ? lines : [finalizeLine([], 0, measure, baseStyle)];
}

export function createFontGroupManager({ container, addButton, textInput, onChange, onError }) {
  let fontGroups = INITIAL_FONT_GROUPS.map((group) => ({ ...group }));
  let nextFontGroupId = 1;
  let loadedFontFaces = [];
  let loadedFontSignature = '';
  let loadedFontFamiliesByUrl = new Map();
  let colorPickers = [];

  function validateFontGroupId(id, currentIndex = -1) {
    if (!id) throw new Error('글꼴 그룹 ID를 입력하세요.');
    if (!FONT_GROUP_ID_RE.test(id)) throw new Error('글꼴 그룹 ID에는 영문, 숫자, _, -만 사용할 수 있습니다.');
    if (id === '0' && currentIndex !== 0) throw new Error('ID 0은 기본 글꼴 전용입니다.');
    if (fontGroups.some((group, index) => index !== currentIndex && group.id === id)) throw new Error(`글꼴 그룹 ID "${id}"가 중복됩니다.`);
  }

  function destroyColorPickers() {
    for (const picker of colorPickers) picker.destroy();
    colorPickers = [];
  }

  function attachColorPickers() {
    for (const input of container.querySelectorAll('[data-font-prop="color"]')) {
      const picker = new ColorPicker(input, {
        toggleStyle: 'input', submitMode: 'instant', enableAlpha: true,
        defaultFormat: 'hex', dialogPlacement: 'bottom-start',
      });
      picker.on('pick', (color) => {
        const index = Number(input.dataset.fontGroupIndex);
        if (!fontGroups[index]) return;
        const value = color ? color.string('hex') : '';
        input.value = value;
        fontGroups[index].color = value;
        if (index === 0) updateInheritanceHints();
        onChange();
      });
      colorPickers.push(picker);
    }
  }

  function render() {
    destroyColorPickers();
    const base = fontGroups[0];
    container.innerHTML = fontGroups.map((group, index) => {
      const isBase = index === 0;
      const inherited = (prop) => escapeHtml(base[prop]);
      return `
        <section class="font-group" data-font-group-index="${index}">
          <div class="font-group-header">
            <div class="group-id-wrap">
              <h3>${isBase ? '기본 글꼴' : '글꼴 그룹'}</h3>
              ${isBase ? '<span class="muted">ID 0</span>' : `<label>ID <input type="text" value="${escapeHtml(group.id)}" data-group-id-index="${index}" spellcheck="false"></label>`}
            </div>
            ${isBase ? '' : `<button type="button" class="remove-group" data-remove-group-index="${index}">삭제</button>`}
          </div>
          <div class="font-group-grid">
            <label class="font-url-field">폰트 URL
              <input type="url" value="${escapeHtml(group.fontUrl)}" data-font-group-index="${index}" data-font-prop="fontUrl" ${isBase ? '' : `placeholder="${inherited('fontUrl')}"`}>
            </label>
            <label>글자 크기 (px)<input type="number" min="1" step="1" value="${escapeHtml(group.fontSize)}" data-font-group-index="${index}" data-font-prop="fontSize" ${isBase ? '' : `placeholder="${inherited('fontSize')}"`}></label>
            <label>굵기<input type="number" min="1" max="1000" step="1" value="${escapeHtml(group.fontWeight)}" data-font-group-index="${index}" data-font-prop="fontWeight" ${isBase ? '' : `placeholder="${inherited('fontWeight')}"`}></label>
            <label>행간<input type="text" value="${escapeHtml(group.lineHeight)}" data-font-group-index="${index}" data-font-prop="lineHeight" ${isBase ? '' : `placeholder="${inherited('lineHeight')}"`}></label>
            <label>글자색<input type="text" value="${escapeHtml(group.color)}" data-font-group-index="${index}" data-font-prop="color" ${isBase ? '' : `placeholder="${inherited('color')}"`}></label>
          </div>
          ${isBase ? '' : '<p class="inherit-hint">비워 둔 값은 기본 글꼴 값을 사용합니다.</p>'}
        </section>`;
    }).join('');
    attachColorPickers();
  }

  function updateInheritanceHints() {
    const base = fontGroups[0];
    for (const input of container.querySelectorAll('[data-font-group-index]:not([data-font-group-index="0"])[data-font-prop]')) {
      const prop = input.dataset.fontProp;
      input.placeholder = base[prop] || '';
    }
  }

  function resolveFontGroups() {
    const base = fontGroups[0];
    validateFontGroupId(base.id, 0);
    const baseFontSize = optionalNumberValue(base.fontSize, NaN, '기본 글자 크기', { min: 1 });
    const baseFontWeight = optionalNumberValue(base.fontWeight, NaN, '기본 굵기', { min: 1, max: 1000 });
    const baseLineHeightRaw = String(base.lineHeight).trim();
    const baseColor = validateCssColor(String(base.color).trim(), '기본 글자색');
    if (!Number.isFinite(baseFontSize)) throw new Error('기본 글자 크기를 입력하세요.');
    if (!Number.isFinite(baseFontWeight)) throw new Error('기본 굵기를 입력하세요.');
    if (!baseLineHeightRaw) throw new Error('기본 행간을 입력하세요.');

    return fontGroups.map((group, index) => {
      validateFontGroupId(group.id, index);
      const fontSize = index === 0 ? baseFontSize : optionalNumberValue(group.fontSize, baseFontSize, `글꼴 그룹 ${group.id} 글자 크기`, { min: 1 });
      const fontWeight = index === 0 ? baseFontWeight : optionalNumberValue(group.fontWeight, baseFontWeight, `글꼴 그룹 ${group.id} 굵기`, { min: 1, max: 1000 });
      const lineHeightRaw = index === 0 ? baseLineHeightRaw : String(group.lineHeight).trim() || baseLineHeightRaw;
      const fontUrl = index === 0 ? String(base.fontUrl).trim() : String(group.fontUrl).trim() || String(base.fontUrl).trim();
      const color = index === 0 ? baseColor : validateCssColor(String(group.color).trim() || baseColor, `글꼴 그룹 ${group.id} 글자색`);
      return { id: group.id, fontUrl, fontSize, fontWeight, lineHeightRaw, lineHeight: resolveLineHeight(lineHeightRaw, fontSize), color };
    });
  }

  async function ensureFontFamilies(groups) {
    const urls = [...new Set(groups.map((group) => group.fontUrl).filter(Boolean))];
    const signature = JSON.stringify(urls);
    if (signature !== loadedFontSignature) {
      const nextFaces = [];
      const nextFamiliesByUrl = new Map();
      try {
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const family = `CreditGeneratorFont_${Date.now()}_${i}`;
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
      for (const face of loadedFontFaces) document.fonts.delete(face);
      loadedFontFaces = nextFaces;
      loadedFontFamiliesByUrl = nextFamiliesByUrl;
      loadedFontSignature = signature;
    }
    return groups.map((group) => {
      const fontFamily = group.fontUrl ? loadedFontFamiliesByUrl.get(group.fontUrl) : 'Arial, sans-serif';
      return { ...group, fontFamily, font: `${group.fontWeight} ${group.fontSize}px ${fontFamily}` };
    });
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
    fontGroups.push({ id: String(nextFontGroupId++), fontUrl: '', fontSize: '', fontWeight: '', lineHeight: '', color: '' });
    render();
    onChange();
  });

  render();

  return {
    getGroupIds() { return new Set(fontGroups.map((group) => group.id)); },
    async prepareLayout(text, { wrap, width, padding }) {
      const unresolved = resolveFontGroups();
      const groups = await ensureFontFamilies(unresolved);
      const groupMap = new Map(groups.map((group) => [group.id, group]));
      const tokens = parseSource(text, groupMap);
      const logicalLines = splitIntoLogicalLines(tokens);
      const measure = document.createElement('canvas').getContext('2d');
      measure.textBaseline = 'alphabetic';
      const baseStyle = groups[0];
      const contentWidth = width - padding * 2;
      const lines = [];

      for (const logicalLine of logicalLines) {
        if (logicalLine.spacerHeight != null) {
          lines.push(finalizeLine([], 0, measure, baseStyle, logicalLine.spacerHeight));
          continue;
        }
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
        maxAscent = Math.max(maxAscent, line.ascent);
        maxDescent = Math.max(maxDescent, line.descent);
        if (!line.visible) continue;
        inkTop = Math.min(inkTop, rawBaseline - line.ascent);
        inkBottom = Math.max(inkBottom, rawBaseline + line.descent);
      }
      if (!Number.isFinite(inkTop) || !Number.isFinite(inkBottom)) throw new Error('표시할 수 있는 문자가 없습니다.');
      for (const line of lines) line.baseline -= inkTop;
      const totalAdvance = lines.length ? lines.at(-1).baseline + lines.at(-1).lineHeight : 0;
      const visualHeight = Math.max(inkBottom - inkTop, totalAdvance);
      const fonts = [...new Map(groups.filter((group) => group.fontUrl).map((group) => [group.fontFamily, { family: group.fontFamily, url: group.fontUrl, weight: group.fontWeight }])).values()];
      return { lines, visualHeight: Math.max(1, visualHeight), maxAscent, maxDescent, fonts };
    },
  };
}
