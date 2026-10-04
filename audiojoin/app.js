(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const i18n = ToolI18n.create();
  const t = (key, values) => i18n.t(key, values);
  const setText = (id, key, values) => i18n.setText($(id), key, values);
  const { parseWav, differences, makeHeader, mergeWavs } = WavJoiner;
  let items = [], busy = false, resultUrl = null, outputNameEdited = false;
  const filenameOrder = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
  function compareByFilename(a, b) {
    const order = filenameOrder.compare(a.file.name, b.file.name);
    if (order) return order;
    // Resolve case/zero-padding ties consistently; identical names retain import order.
    return a.file.name < b.file.name ? -1 : a.file.name > b.file.name ? 1 : 0;
  }
  const sizeLabel = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    const unit = bytes < 1024 ** 2 ? 1 : bytes < 1024 ** 3 ? 2 : 3;
    return `${(bytes / 1024 ** unit).toFixed(unit === 1 ? 0 : 2)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
  };
  const timeLabel = seconds => {
    const ms = Math.round(seconds * 1000), sec = Math.floor(ms / 1000);
    const hours = Math.floor(sec / 3600);
    return `${hours ? `${String(hours).padStart(2, '0')}:` : ''}${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
  };
  const rateLabel = fmt => `${fmt.rate / 1000} kHz / ${fmt.bits}-bit${fmt.validBits !== fmt.bits ? t('（有效 {bits}）', { bits: fmt.validBits }) : ''}${fmt.encoding === 3 ? ' Float' : ''}`;
  const fieldLabel = fields => fields.map(field => t(field)).join(i18n.language === 'en' ? ', ' : '、');
  function errorLabel(error) {
    if (Object.hasOwn(ToolTranslations.messages, error?.message)) return t(error.message);
    const mismatch = error?.message?.match(/^第 (\d+) 个文件的(.+)与第一个文件不一致。$/);
    if (mismatch) return t('第 {index} 个文件的{fields}与第一个文件不一致。', { index: mismatch[1], fields: fieldLabel(mismatch[2].split('、')) });
    return t('无法读取或处理音频文件，请确认文件完整且格式受支持。');
  }
  function message(value, info = false, values) {
    setText('message', value, values);
    $('message').hidden = !value;
    $('message').classList.toggle('info', info);
  }
  function clearResult() {
    $('resultAudio').pause(); $('resultAudio').removeAttribute('src'); $('resultAudio').load();
    $('result').hidden = true;
    $('download').removeAttribute('href');
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
  }
  function invalidate() { clearResult(); message(''); }
  function setBusy(value) {
    busy = value;
    $('fileInput').disabled = value; $('dropzone').disabled = value;
    $('gapRange').disabled = value; $('outputName').disabled = value;
    document.querySelectorAll('[data-gap]').forEach(button => { button.disabled = value; });
    render();
  }
  function rowButton(label, glyph, disabled, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = glyph;
    b.title = label; b.setAttribute('aria-label', label); b.disabled = disabled || busy;
    b.addEventListener('click', action); return b;
  }
  function render() {
    items.sort(compareByFilename);
    const first = items[0], gap = Number($('gapRange').value);
    if (!outputNameEdited) $('outputName').value = first ? first.file.name.replace(/\.wav$/i, '') : '';
    $('outputSuffix').hidden = /\.wav$/i.test($('outputName').value.trim());
    const incompatible = first ? items.some(item => differences(first.fmt, item.fmt).length) : false;
    $('count').textContent = items.length;
    $('empty').hidden = !!items.length; $('listHead').hidden = !items.length;
    $('clearBtn').disabled = busy || !items.length;
    $('mergeBtn').disabled = busy || !items.length || incompatible;
    $('fileList').replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement('li'); row.className = 'file-row'; row.dataset.id = item.id;
      const number = document.createElement('span'); number.className = 'number'; number.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('div'); info.className = 'file-info';
      const name = document.createElement('span'); name.className = 'file-name'; name.textContent = item.file.name; name.title = item.file.name; name.tabIndex = -1;
      const meta = document.createElement('div'); meta.className = 'file-meta';
      const diff = differences(first.fmt, item.fmt);
      meta.textContent = `${timeLabel(item.duration)} · ${rateLabel(item.fmt)} · ${t('{count} 声道', { count: item.fmt.channels })}`;
      if (diff.length) { meta.textContent += ` · ${t('{fields}不一致', { fields: fieldLabel(diff) })}`; meta.classList.add('error'); row.classList.add('incompatible'); }
      info.append(name, meta);
      const actions = document.createElement('div'); actions.className = 'row-actions';
      actions.append(rowButton(t('移除 {name}', { name: item.file.name }), '×', false, () => {
        items = items.filter(i => i.id !== item.id);
        if (!items.length) outputNameEdited = false;
        invalidate(); render();
      }));
      row.append(number, info, actions);
      $('fileList').append(row);
    });
    $('specRate').textContent = first ? rateLabel(first.fmt) : t('等待读取文件');
    $('specChannels').textContent = first ? first.fmt.channels === 1 ? t('单声道') : first.fmt.channels === 2 ? t('立体声 · 2 声道') : t('{count} 声道', { count: first.fmt.channels }) : '—';
    $('specFormat').textContent = first ? `WAV · ${first.fmt.encoding === 1 ? 'PCM' : 'IEEE Float'}` : t('WAV · 原始参数');
    const compat = $('compatibility');
    compat.classList.toggle('error', incompatible); compat.classList.toggle('good', !!first && !incompatible);
    compat.textContent = t(incompatible ? '有文件参数与第一项不一致。请移除这些文件，或换用参数一致的音频后再合并。' : first ? '✓ 所有文件参数一致，原始采样数据将完整保留。' : '所有文件需使用相同的采样率、位深和声道。不同参数会提示，避免自动转换。');
    if (first && !incompatible) {
      const frames = items.reduce((sum, i) => sum + i.frames, 0) + Math.round(gap * first.fmt.rate) * (items.length - 1);
      const header = makeHeader(first.fmt, frames * first.fmt.blockAlign);
      $('totalTime').textContent = timeLabel(frames / first.fmt.rate); $('totalSize').textContent = sizeLabel(header.totalSize);
      if (header.rf64) $('specFormat').textContent += ' · RF64';
    } else { $('totalTime').textContent = incompatible ? t('参数不一致') : '00:00.000'; $('totalSize').textContent = '—'; }
  }
  async function addFiles(files) {
    if (busy) { message('正在读取或导出，请稍后再添加文件。', true); return; }
    const batch = [...files]; if (!batch.length) return;
    if (items.length + batch.length > 500) { message('一次合并最多支持 500 个文件，请分批处理。'); return; }
    invalidate(); setBusy(true); const errors = [];
    try {
      for (let index = 0; index < batch.length; index++) {
        message('正在读取 {index} / {count}：{name}', true, { index: index + 1, count: batch.length, name: batch[index].name });
        try {
          const parsed = await parseWav(batch[index]);
          parsed.id = `f${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
          items.push(parsed);
        } catch (error) { errors.push({ name: batch[index].name, error }); }
      }
      message(errors.length ? '以下文件未添加：\n{errors}' : '', false, () => ({ errors: errors.map(({ name, error }) => `${name}: ${errorLabel(error)}`).join('\n') }));
    } finally { setBusy(false); $('fileInput').value = ''; }
  }
  $('dropzone').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', event => addFiles(event.target.files));
  window.addEventListener('dragover', event => {
    if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); if (!busy) $('dropzone').classList.add('over'); }
  });
  window.addEventListener('dragleave', event => { if (!event.relatedTarget) $('dropzone').classList.remove('over'); });
  window.addEventListener('drop', event => {
    if (!event.dataTransfer.files.length) return;
    event.preventDefault(); $('dropzone').classList.remove('over'); addFiles(event.dataTransfer.files);
  });
  $('clearBtn').addEventListener('click', () => { if (busy) return; items = []; outputNameEdited = false; invalidate(); render(); });
  function changeGap(value) {
    $('gapRange').value = value; $('gapValue').textContent = Number(value).toFixed(1);
    document.querySelectorAll('[data-gap]').forEach(button => {
      const selected = Number(button.dataset.gap) === Number(value);
      button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    });
    invalidate(); render();
  }
  $('gapRange').addEventListener('input', event => changeGap(event.target.value));
  document.querySelectorAll('[data-gap]').forEach(button => button.addEventListener('click', () => changeGap(button.dataset.gap)));
  function outputFilename() {
    const enteredName = $('outputName').value.trim() || (items[0] ? items[0].file.name : t('合并音频'));
    const name = enteredName.replace(/\.wav$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '') || t('合并音频');
    return `${/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? '_' : ''}${name}.wav`;
  }
  $('outputName').addEventListener('input', () => {
    outputNameEdited = !!$('outputName').value.trim();
    $('outputSuffix').hidden = /\.wav$/i.test($('outputName').value.trim());
    if (resultUrl) $('download').download = outputFilename();
  });
  $('mergeBtn').addEventListener('click', async () => {
    if (busy) return;
    setBusy(true); message('正在组装音频，保留原始采样数据…', true);
    try {
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
      const merged = mergeWavs([...items].sort(compareByFilename), Number($('gapRange').value));
      clearResult(); resultUrl = URL.createObjectURL(merged.blob);
      $('download').href = resultUrl; $('download').download = outputFilename();
      const clipCount = items.length;
      setText('resultInfo', '{count} 个片段 · {duration} · {rate} · {size}', () => ({ count: clipCount, duration: timeLabel(merged.duration), rate: rateLabel(merged.fmt), size: sizeLabel(merged.blob.size) }));
      setText('previewNote', merged.rf64 ? '已输出 RF64 WAV。浏览器可能无法试听，可下载后在音频软件中打开。' : '试听是否可用取决于浏览器；导出的音频参数不会因试听而改变。');
      $('resultAudio').src = resultUrl; $('result').hidden = false;
      message(''); $('result').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
      $('download').focus({ preventScroll: true });
    } catch (error) { message('合并失败：{error}', false, () => ({ error: errorLabel(error) })); }
    finally { setBusy(false); }
  });
  $('resultAudio').addEventListener('error', () => {
    if (resultUrl) setText('previewNote', '当前浏览器无法试听这个 WAV 编码，仍可保存文件并用音频软件播放。');
  });
  window.addEventListener('beforeunload', () => { if (resultUrl) URL.revokeObjectURL(resultUrl); });
  if (location.search.includes('desktop=1')) {
    $('homeLink').removeAttribute('href'); i18n.setAttribute($('homeLink'), 'aria-label', 'Music Tools 音频合并');
    setText('homeLabel', '音频合并');
    i18n.onChange(() => { document.title = t('音频合并 · 离线桌面工具'); });
    document.title = t('音频合并 · 离线桌面工具');
  }
  i18n.onChange(render);
  render();
})();
