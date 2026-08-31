const { JSDOM } = require('jsdom');
(async () => {
  const dom = await JSDOM.fromURL('http://localhost:8897/index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window){
      window.fetch = (url, opts) => fetch(new URL(url, window.location.href).href, opts);
      window.URL.createObjectURL = () => 'blob:mock-url';
      window.URL.revokeObjectURL = () => {};
    }
  });
  const win = dom.window; const doc = win.document;
  let errors = [];
  win.addEventListener('error', e => errors.push(e.message));

  let downloads = [];
  const origClick = win.HTMLAnchorElement.prototype.click;
  win.HTMLAnchorElement.prototype.click = function(){
    if(this.download){ downloads.push(this.download); }
    return origClick.call(this);
  };

  await new Promise(r => setTimeout(r, 2000));
  console.log('=== エラー ===', errors.length ? errors : 'なし');
  console.log('=== 英語ロケール反映 ===');
  console.log('btn-new:', doc.getElementById('btn-new').textContent);
  console.log('戻るリンク:', doc.querySelector('.toolbar-back-link').textContent);

  const sel = doc.getElementById('lang-select');
  sel.value = 'ja';
  sel.dispatchEvent(new win.Event('change', {bubbles:true}));
  await new Promise(r => setTimeout(r, 600));
  console.log('=== 日本語切替後 ===');
  console.log('btn-new:', doc.getElementById('btn-new').textContent);
  console.log('戻るリンク:', doc.querySelector('.toolbar-back-link').textContent);

  const result = await win.api.saveProject(JSON.stringify({nodes:[],edges:[],texts:[]}));
  console.log('=== saveProject ===', result, downloads);

  process.exit(0);
})().catch(e => { console.log('FATAL:', e); process.exit(1); });
