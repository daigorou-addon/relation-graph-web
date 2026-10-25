// ===================================================================
// web-bridge.js
// Electron版のpreload.js（window.api）が提供していた機能を、
// ブラウザのネイティブAPIだけで再実装したもの。
// renderer.js は一切変更せず、この橋渡しレイヤーだけで動くようにする。
// ===================================================================

(() => {
  const LOCALES = ['ja', 'en', 'ko', 'zh_CN', 'zh_TW', 'es'];

  function pickFile(accept){
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      let done = false;
      const finish = (file) => {
        if(done) return;
        done = true;
        input.remove();
        resolve(file || null);
      };
      input.addEventListener('change', () => finish(input.files[0]));
      // キャンセル時（対応ブラウザのみ発火）
      input.addEventListener('cancel', () => finish(null));
      document.body.appendChild(input);
      input.click();
      // 'cancel'イベント非対応ブラウザ向けの保険：
      // ウィンドウにフォーカスが戻ってからしばらく反応が無ければキャンセル扱い
      window.addEventListener('focus', function onFocus(){
        window.removeEventListener('focus', onFocus);
        setTimeout(() => finish(input.files[0] || null), 400);
      }, { once: true });
    });
  }

  function downloadBlob(blob, filename){
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  window.api = {
    // ---- 画像選択（ノードに貼る画像） ----
    async openImage(){
      const file = await pickFile('image/*');
      if(!file) return null;
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    },

    // ---- PNG保存 ----
    async savePng(dataUrl){
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
      downloadBlob(new Blob([bytes], {type:'image/png'}), 'graph.png');
      return true;
    },
    async savePngFromSvg(dataUrl){
      return this.savePng(dataUrl);
    },

    // ---- SVG保存 ----
    async saveSvg(svgText){
      downloadBlob(new Blob([svgText], {type:'image/svg+xml;charset=utf-8'}), 'graph.svg');
      return true;
    },

    // ---- プロジェクト保存/読込（.rg = JSON） ----
    async saveProject(json){
      downloadBlob(new Blob([json], {type:'application/json'}), 'project.rg');
      return 'project.rg';
    },
    async openProject(){
      const file = await pickFile('.rg,application/json');
      if(!file) return null;
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },

    // ---- 多言語 ----
    async getLocale(lang){
      try{
        const res = await fetch(`locales/${lang}.json`);
        if(!res.ok) throw new Error('not found');
        return await res.json();
      } catch(e){
        const res = await fetch('locales/ja.json');
        return await res.json();
      }
    },
    async getLocales(){
      return LOCALES;
    },

    // ---- ネイティブメニュー由来のイベント（Web版には存在しないため何もしない） ----
    onMenuEvent(){},
    onLang(){},

    // ---- バージョン ----
    async getAppVersion(){
      return document.querySelector('meta[name="app-version"]')?.content || '';
    },
  };
})();
