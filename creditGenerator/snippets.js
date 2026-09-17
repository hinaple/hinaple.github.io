function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function createSnippetManager({ container, addButton, onChange }) {
  let snippets = [{ search: '', replacement: '' }];

  function render() {
    container.innerHTML = snippets.map((snippet, index) => `
      <section class="snippet-item" data-snippet-index="${index}">
        <div class="snippet-header">
          <h3>스니펫 ${index + 1}</h3>
          <button type="button" data-remove-snippet="${index}" ${snippets.length === 1 ? 'disabled' : ''}>삭제</button>
        </div>
        <label>검색 문자열
          <input type="text" value="${escapeHtml(snippet.search)}" data-snippet-prop="search" data-snippet-index="${index}" spellcheck="false">
        </label>
        <label>치환할 문자열
          <textarea class="snippet-replacement" rows="4" data-snippet-prop="replacement" data-snippet-index="${index}">${escapeHtml(snippet.replacement)}</textarea>
        </label>
      </section>
    `).join('');
  }

  container.addEventListener('input', (event) => {
    const input = event.target.closest('[data-snippet-prop]');
    if (!input) return;
    const index = Number(input.dataset.snippetIndex);
    const prop = input.dataset.snippetProp;
    if (!snippets[index] || !prop) return;
    snippets[index][prop] = input.value;
    onChange();
  });

  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-snippet]');
    if (!button || snippets.length === 1) return;
    snippets.splice(Number(button.dataset.removeSnippet), 1);
    render();
    onChange();
  });

  addButton.addEventListener('click', () => {
    snippets.push({ search: '', replacement: '' });
    render();
    onChange();
  });

  render();

  return {
    apply(source) {
      let result = source;
      for (const snippet of snippets) {
        if (!snippet.search) continue;
        result = result.split(snippet.search).join(snippet.replacement);
      }
      return result;
    },
  };
}
