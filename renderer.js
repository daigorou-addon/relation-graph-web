'use strict';

// ===== i18n (先頭に宣言、renderAllから参照できるよう) =====
let _i18n={};
function t(key){return _i18n[key]||'';}

// ===== CONSTANTS =====
const NODE_W = 100, NODE_H = 124, IMG_H = 88;
const NODE_COLORS  = ['#667eea','#ff6b9d','#ffa502','#2ed573','#1e90ff','#ff4757','#a29bfe','#fd79a8','#00b894','#fdcb6e','#000000'];
const EDGE_COLORS  = ['#ff6b9d','#667eea','#ffa502','#2ed573','#ff4757','#a29bfe','#1e90ff','#fd79a8','#e17055','#00cec9','#000000'];
const TEXT_COLORS  = ['#333333','#667eea','#ff6b9d','#ffa502','#2ed573','#ff4757','#ffffff','#764ba2','#e17055','#00cec9','#000000'];
const GROUP_COLORS = ['#667eea','#ff6b9d','#ffa502','#2ed573','#ff4757','#a29bfe','#e17055','#00cec9','#fd79a8','#fdcb6e','#000000'];
const FONTS = ['Yu Gothic UI,Meiryo,sans-serif','Yu Mincho,Georgia,serif','serif','monospace','Impact,Arial Black,sans-serif','cursive'];
const NODE_STYLES = { card:{w:100,h:124}, compact:{w:84,h:104}, simple:{w:110,h:52}, circle:{w:84,h:84}, 'family-v':{w:60,h:160}, 'family-h':{w:200,h:80} };

// ===== STATE =====
const S = {
  nodes:[], edges:[], texts:[], groups:[], freeLines:[], forks:[],
  sel:{type:null,id:null},
  edgeSrc:null,
  nextId:1,
  tool:'select',
  drag:null, pan:null, groupDraw:null,
  ox:0, oy:0, scale:1,
  bgColor:'#f0f4ff',
  history:[],
  ctxPos:{x:0,y:0}, ctxTarget:null,
  hoverNodeId:null, dropNodeId:null, lineDraw:null,
  branchMode:false, branchOrigin:null,
  forkMode:false, forkSrc:null, forkDsts:[],
  pendingType:'solid', pendingColor:'#ff6b9d',
};

// ===== DOM =====
const $=id=>document.getElementById(id);
const container=$('canvas-container'), svg=$('graph');
const layerGroups=$('layer-groups'), layerEdges=$('layer-edges'), layerNodes=$('layer-nodes');
const edgeTypeBar=$('edge-type'), edgeColorBar=$('edge-color'), bgColorEl=$('bg-color');
const dropOverlay=$('drop-overlay'), groupPreview=$('group-preview');
const edgeHint=$('edge-hint'), connectBtn=$('connect-btn');
const panelNode=$('panel-node'),panelText=$('panel-text'),panelGroup=$('panel-group'),panelEdge=$('panel-edge');
const nodeNameEl=$('node-name'),nodeSubEl=$('node-sub'),nodeClipEl=$('node-clip'),nodeColorEl=$('node-color'),nodeStyleEl=$('node-style');
const nodeNameSizeEl=$('node-name-size'),nodeNameSizeVal=$('node-name-size-val');
const nodeNameColorEl=$('node-name-color'),nodeSubColorEl=$('node-sub-color');
const btnImgSet=$('btn-img-set'),btnImgClear=$('btn-img-clear'),btnNodeDel=$('btn-node-del');
const imgAdjust=$('img-adjust'),imgOxEl=$('img-ox'),imgOyEl=$('img-oy'),imgScaleEl=$('img-scale'),btnImgReset=$('btn-img-reset');
const textContentEl=$('text-content'),textSizeEl=$('text-size'),textSizeVal=$('text-size-val');
const textColorEl=$('text-color'),textBoldEl=$('text-bold'),textFontEl=$('text-font');
const textBorderEl=$('text-border'),textBgEl=$('text-bg'),textBgOpacityEl=$('text-bg-opacity'),textBgOpacityVal=$('text-bg-opacity-val');
const btnTextDel=$('btn-text-del');
const groupLabelEl=$('group-label'),groupColorEl=$('group-color'),groupOpacityEl=$('group-opacity'),groupOpacityVal=$('group-opacity-val'),groupStyleEl=$('group-style');
const btnGroupDel=$('btn-group-del');
const edgeLabelEl=$('edge-label'),edgeLabelSizeEl=$('edge-label-size'),edgeLabelSizeVal=$('edge-label-size-val');
const edgeLabelColorEl=$('edge-label-color'),edgeTypePanelEl=$('edge-type-panel');
const edgeWidthEl=$('edge-width'),edgeWidthVal=$('edge-width-val'),edgeColorPanelEl=$('edge-color-panel');
const edgeLabelShapeEl=$('edge-label-shape'),edgeLabelAngleEl=$('edge-label-angle'),edgeLabelAngleVal=$('edge-label-angle-val');
const edgeIconEl=null,edgeIconSizeEl=null,edgeIconSizeVal=null;
const btnEdgeDel=$('btn-edge-del');
const stNodes=$('st-nodes'),stEdges=$('st-edges'),stMsg=$('st-msg');
const ctxCanvas=$('ctx-canvas'),ctxNodeM=$('ctx-node'),ctxTextM=$('ctx-text'),ctxGroupM=$('ctx-group'),ctxEdgeM=$('ctx-edge');
const allCtx=[ctxCanvas,ctxNodeM,ctxTextM,ctxGroupM,ctxEdgeM];

// ===== HISTORY =====
function snap(){
  S.history.push(JSON.stringify({nodes:S.nodes,edges:S.edges,texts:S.texts,groups:S.groups,freeLines:S.freeLines||[],forks:S.forks||[],nextId:S.nextId}));
  if(S.history.length>60)S.history.shift();
  if(typeof markDirty==='function')markDirty();
}
function undo(){
  if(!S.history.length)return;
  const s=JSON.parse(S.history.pop());
  Object.assign(S,{nodes:s.nodes,edges:s.edges,texts:s.texts,groups:s.groups,freeLines:s.freeLines||[],forks:s.forks||[],nextId:s.nextId});
  clearSel();
}

// ===== HELPERS =====
function svgEl(tag,attrs={}){
  const el=document.createElementNS('http://www.w3.org/2000/svg',tag);
  for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);
  return el;
}
function svgPt(e){const r=container.getBoundingClientRect();return{x:(e.clientX-r.left-S.ox)/S.scale,y:(e.clientY-r.top-S.oy)/S.scale};}
function screenXY(sx,sy){const r=container.getBoundingClientRect();return{x:sx*S.scale+S.ox+r.left,y:sy*S.scale+S.oy+r.top};}
function selNode(){return S.nodes.find(n=>n.id===S.sel.id);}
function selEdge(){
  return S.edges.find(e=>e.id===S.sel.id)
      || S.freeLines.find(f=>f.id===S.sel.id)
      || null;
}
function selText(){return S.texts.find(t=>t.id===S.sel.id);}
function selGroup(){return S.groups.find(g=>g.id===S.sel.id);}
function nodeW(n){return n.w||(NODE_STYLES[n.style||'card']?.w??NODE_W);}
function nodeH(n){return n.h||(NODE_STYLES[n.style||'card']?.h??NODE_H);}

// ===== NODE 接触点（完全版）=====
// マーカー長さ（SVG座標系）
const MARKER_LEN = 12;

function nodeContactPt(node, dx, dy){
  const sty=node.style||'card';
  const W=nodeW(node), H=nodeH(node);
  const dist=Math.sqrt(dx*dx+dy*dy)||1;
  const nx=dx/dist, ny=dy/dist;
  if(sty==='circle'){
    const a=W/2, b=H/2;
    const t=1/Math.sqrt((nx/a)**2+(ny/b)**2);
    return{x:node.x+nx*t, y:node.y+ny*t};
  }
  // 矩形（card/compact/simple）
  const hw=W/2, hh=H/2;
  const tx=hw/Math.abs(nx||1e-9), ty=hh/Math.abs(ny||1e-9);
  const t=Math.min(tx,ty);
  return{x:node.x+nx*t, y:node.y+ny*t};
}

// マーカーがある場合に線を手前で止める
function shortenPt(px, py, tx, ty, len){
  const dx=px-tx, dy=py-ty, d=Math.sqrt(dx*dx+dy*dy)||1;
  if(d<=len)return{x:tx,y:ty};
  return{x:tx+dx/d*len, y:ty+dy/d*len};
}

// ===== TOOLS =====
['select','node','text','group'].forEach(t=>$('tool-'+t)&&$('tool-'+t).addEventListener('click',()=>setTool(t)));
function setTool(t){
  S.tool=t;
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  $('tool-'+t).classList.add('active');
  container.className=t==='node'||t==='group'?'tool-'+t:t==='text'?'tool-text':'';
  if(S.edgeSrc!==null)cancelEdge();
}

// ===== SWATCHES =====
function makeSwatches(cid,colors,fn){
  const el=$(cid);if(!el)return;el.innerHTML='';
  colors.forEach(c=>{
    const sw=document.createElement('div');sw.className='color-swatch';sw.style.background=c;
    sw.addEventListener('click',()=>{el.querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('active'));sw.classList.add('active');fn(c);});
    el.appendChild(sw);
  });
}
function initSwatches(){
  makeSwatches('node-color-swatches',NODE_COLORS,c=>{nodeColorEl.value=c;const n=selNode();if(n){snap();n.color=c;renderAll();}});
  makeSwatches('node-name-color-swatches',TEXT_COLORS,c=>{if(nodeNameColorEl)nodeNameColorEl.value=c;const n=selNode();if(n){n.nameColor=c;renderAll();}});
  makeSwatches('node-sub-color-swatches',TEXT_COLORS,c=>{if(nodeSubColorEl)nodeSubColorEl.value=c;const n=selNode();if(n){n.subColor=c;renderAll();}});
  makeSwatches('edge-color-swatches',EDGE_COLORS,c=>{edgeColorPanelEl.value=c;const e=selEdge();if(e){snap();e.color=c;renderAll();}});
  makeSwatches('text-color-swatches',TEXT_COLORS,c=>{textColorEl.value=c;const t=selText();if(t){t.color=c;renderAll();}});
  makeSwatches('group-color-swatches',GROUP_COLORS,c=>{groupColorEl.value=c;const g=selGroup();if(g){g.color=c;renderAll();}});
}
// ===== RENDER GROUP =====
function renderGroup(g){
  const isSel=S.sel.type==='group'&&S.sel.id===g.id;
  const fillColor=g.color||'#667eea';
  const strokeColor=g.strokeColor||fillColor;
  const da=g.style==='dashed'?'12,6':g.style==='none'?'1,0':'none';
  const op=(g.opacity||10)/100;
  const rx2=g.shape==='rect'?0:18;
  const el=svgEl('g',{class:'group-el'});el.dataset.groupId=g.id;
  el.appendChild(svgEl('rect',{x:g.x,y:g.y,width:g.w,height:g.h,rx:rx2,
    fill:fillColor,'fill-opacity':op,stroke:g.style==='none'?'none':strokeColor,
    'stroke-width':isSel?3:2,'stroke-dasharray':da,filter:isSel?'url(#shadow-sel)':'none'}));
  if(g.label){
    const lw=g.label.length*8+20;
    el.appendChild(svgEl('rect',{x:g.x+14,y:g.y-11,width:lw,height:22,rx:rx2>0?11:3,fill:strokeColor}));
    const t=svgEl('text',{x:g.x+14+lw/2,y:g.y+6,'text-anchor':'middle','dominant-baseline':'middle',
      fill:'#fff','font-size':'12','font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'});
    t.textContent=g.label;el.appendChild(t);
  }
  // リサイズハンドル（選択時）
  if(isSel){
    const handles=[
      {pos:'se',cx:g.x+g.w,cy:g.y+g.h,dw:1,dh:1},
      {pos:'e', cx:g.x+g.w,cy:g.y+g.h/2,dw:1,dh:0},
      {pos:'s', cx:g.x+g.w/2,cy:g.y+g.h,dw:0,dh:1},
      {pos:'sw',cx:g.x,cy:g.y+g.h,dw:-1,dh:1},
      {pos:'ne',cx:g.x+g.w,cy:g.y,dw:1,dh:-1},
    ];
    handles.forEach(h=>{
      const hEl=svgEl('circle',{cx:h.cx,cy:h.cy,r:5,fill:'#fff',stroke:'#667eea','stroke-width':2,
        cursor:h.pos+'-resize','pointer-events':'all'});
      hEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        const sp=svgPt(ev),sw=g.w,sh=g.h,sx=g.x,sy=g.y;
        function onMove(mv){
          const pt=svgPt(mv),dx=pt.x-sp.x,dy=pt.y-sp.y;
          if(h.dw>0){g.w=Math.max(40,sw+dx);}
          else if(h.dw<0){const r=sx+sw;g.x=Math.min(r-40,sx+dx);g.w=r-g.x;}
          if(h.dh>0){g.h=Math.max(30,sh+dy);}
          else if(h.dh<0){const b=sy+sh;g.y=Math.min(b-30,sy+dy);g.h=b-g.y;}
          renderAll();
        }
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      el.appendChild(hEl);
    });
  }
  el.addEventListener('click',e=>{e.stopPropagation();selectItem('group',g.id);});
  el.addEventListener('contextmenu',e=>{e.stopPropagation();e.preventDefault();S.ctxTarget={type:'group',id:g.id};showCtx(ctxGroupM,e.clientX,e.clientY);});
  el.addEventListener('mousedown',e=>{
    if(e.button!==0)return;e.stopPropagation();selectItem('group',g.id);
    const pt=svgPt(e);S.drag={type:'group',id:g.id,origX:g.x,origY:g.y,startX:pt.x,startY:pt.y,moved:false};
  });
  layerGroups.appendChild(el);
}

// ===== RENDER TEXT =====
function renderText(t){
  const isSel=S.sel.type==='text'&&S.sel.id===t.id;
  const size=t.size||18,color=t.color||'#333',bold=t.bold||false;
  const font=t.font||FONTS[0],hasBorder=t.border!==false;
  const borderColor=t.borderColor||color;
  const bgColor=t.bg||'#ffffff';
  const bgOp=(t.bgOpacity||0)/100;
  const borderRx=t.borderShape==='rect'?0:12;
  const lines=(t.content||'テキスト').split('\n');
  const lineH=size*1.45;
  const autoW=Math.max(...lines.map(l=>l.length||1))*size*0.62+28;
  const autoH=lines.length*lineH+20;
  const maxW=t.manualW||autoW;
  const totalH=t.manualH||autoH;
  const g=svgEl('g',{class:'textbox',transform:'translate('+t.x+','+t.y+')'});
  g.dataset.textId=t.id;
  if(bgOp>0){
    g.appendChild(svgEl('rect',{x:0,y:0,width:maxW,height:totalH,rx:borderRx,
      fill:bgColor,'fill-opacity':bgOp,stroke:hasBorder?borderColor:'none','stroke-width':'1.5'}));
  } else if(hasBorder){
    g.appendChild(svgEl('rect',{x:0,y:0,width:maxW,height:totalH,rx:borderRx,
      fill:'none',stroke:borderColor,'stroke-width':'1.5','stroke-dasharray':'6,3',opacity:'0.7'}));
  }
  if(isSel){
    g.appendChild(svgEl('rect',{x:-3,y:-3,width:maxW+6,height:totalH+6,rx:borderRx+1,
      fill:'none',stroke:'#667eea','stroke-width':2,'stroke-dasharray':'6,3'}));
    // リサイズハンドル（右下・右・下）
    [{cx:maxW,cy:totalH,cur:'se-resize',dw:1,dh:1},
     {cx:maxW,cy:totalH/2,cur:'e-resize',dw:1,dh:0},
     {cx:maxW/2,cy:totalH,cur:'s-resize',dw:0,dh:1}
    ].forEach(h=>{
      const hEl=svgEl('circle',{cx:h.cx,cy:h.cy,r:5,fill:'#fff',stroke:'#667eea',
        'stroke-width':2,cursor:h.cur,'pointer-events':'all'});
      hEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        const sp=svgPt(ev),sw=t.manualW||maxW,sh=t.manualH||totalH;
        function onMove(mv){
          const pt=svgPt(mv),dx=pt.x-sp.x,dy=pt.y-sp.y;
          if(h.dw)t.manualW=Math.max(60,sw+dx);
          if(h.dh)t.manualH=Math.max(30,sh+dy);
          renderAll();
        }
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      g.appendChild(hEl);
    });
  }
  if(t.vertical){
    // 縦書きモード
    const txt=svgEl('text',{x:maxW-14,y:14,fill:color,'font-size':size,
      'font-weight':bold?'bold':'normal','font-family':font,'pointer-events':'none',
      'writing-mode':'vertical-rl','text-orientation':'mixed'});
    txt.textContent=(t.content||'テキスト').split('\n').join('');
    g.appendChild(txt);
  } else {
    lines.forEach((line,i)=>{
      const txt=svgEl('text',{x:14,y:14+size+i*lineH,fill:color,'font-size':size,
        'font-weight':bold?'bold':'normal','font-family':font,'pointer-events':'none'});
      txt.textContent=line;g.appendChild(txt);
    });
  }
  g.addEventListener('click',e=>{e.stopPropagation();selectItem('text',t.id);});
  g.addEventListener('contextmenu',e=>{e.stopPropagation();e.preventDefault();S.ctxTarget={type:'text',id:t.id};showCtx(ctxTextM,e.clientX,e.clientY);});
  g.addEventListener('mousedown',e=>{
    if(e.button!==0)return;e.stopPropagation();selectItem('text',t.id);
    const pt=svgPt(e);S.drag={type:'text',id:t.id,origX:t.x,origY:t.y,startX:pt.x,startY:pt.y,moved:false};
  });
  layerNodes.appendChild(g);
}

// ===== MARKER BUILDER =====
function mkMarker(defs,id,tip,col,rev){
  defs.querySelector('#'+id)?.remove();
  const m=svgEl('marker',{id,markerWidth:'14',markerHeight:'14',
    refX:rev?'3':'11',refY:'7',orient:'auto','marker-units':'strokeWidth'});
  if(tip==='arrow'){
    const p=svgEl('path',{d:rev?'M11,3 L4,7 L11,11':'M3,3 L11,7 L3,11',
      fill:'none','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round'});
    p.setAttribute('stroke',col);m.appendChild(p);
  } else if(tip==='arrow-filled'){
    const p=svgEl('path',{d:rev?'M11,3 L4,7 L11,11 Z':'M3,3 L11,7 L3,11 Z'});
    p.setAttribute('fill',col);m.appendChild(p);
  } else if(tip==='circle'){
    const c=svgEl('circle',{cx:rev?'4':'10',cy:'7',r:'3.5'});
    c.setAttribute('fill',col);m.appendChild(c);
  } else if(tip==='diamond'){
    const p=svgEl('path',{d:rev?'M2,7 L6,3.5 L10,7 L6,10.5 Z':'M4,7 L8,3.5 L12,7 L8,10.5 Z'});
    p.setAttribute('fill',col);m.appendChild(p);
  } else if(tip==='bar'){
    const l=svgEl('line',{x1:rev?'4':'10',y1:'3',x2:rev?'4':'10',y2:'11','stroke-width':'2','stroke-linecap':'round'});
    l.setAttribute('stroke',col);m.appendChild(l);
  }
  defs.appendChild(m);
}

// ===== RENDER EDGE =====
function renderEdge(edge){
  const src=S.nodes.find(n=>n.id===edge.src), dst=S.nodes.find(n=>n.id===edge.dst);
  if(!src||!dst)return;
  const isSel=S.sel.type==='edge'&&S.sel.id===edge.id;
  const color=isSel?'#667eea':(edge.color||'#ff6b9d');
  const width=edge.width||3;
  const etype=edge.type||'solid';
  const defs=svg.querySelector('defs');
  const g=svgEl('g',{class:'edge'+(isSel?' selected':'')});
  g.dataset.edgeId=edge.id;

  // 矢印タイプ解析
  const TM={
    'arrow-single':      {e:'arrow'},
    'arrow-rev':         {s:'arrow'},
    'arrow-both':        {s:'arrow',e:'arrow'},
    'arrow-filled':      {e:'arrow-filled'},
    'arrow-filled-rev':  {s:'arrow-filled'},
    'arrow-filled-both': {s:'arrow-filled',e:'arrow-filled'},
    'arrow-circle':      {e:'circle'},
    'arrow-circle-both': {s:'circle',e:'circle'},
    'arrow-diamond':     {e:'diamond'},
    'arrow-bar':         {s:'bar',e:'bar'},
  };
  const tips=TM[etype]||{};
  const startTip=tips.s||null, endTip=tips.e||null;

  // 同ノード間の複数エッジ → ベジェカーブでオフセット
  const sameEdges=S.edges.filter(e=>(e.src===edge.src&&e.dst===edge.dst)||(e.src===edge.dst&&e.dst===edge.src));
  const edgeIdx=sameEdges.findIndex(e=>e.id===edge.id);
  const edgeCount=sameEdges.length;

  // 接触点
  const dx=dst.x-src.x, dy=dst.y-src.y;
  const p1=nodeContactPt(src,dx,dy);
  const p2=nodeContactPt(dst,-dx,-dy);

  // ユーザーが線をドラッグして動かしたオフセット（midOx/midOy）
  const midOx=edge.midOx||0, midOy=edge.midOy||0;

  let x1=p1.x, y1=p1.y, x2=p2.x, y2=p2.y;
  const baseMx=(x1+x2)/2+midOx, baseMy=(y1+y2)/2+midOy;

  const dist=Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2)||1;
  // 法線方向（垂直）
  const ndx=(p2.x-p1.x)/dist, ndy=(p2.y-p1.y)/dist;
  const pnx=-ndy, pny=ndx;

  // 複数エッジ: 平行直線オフセット（カーブなし）
  let parallelOff=0;
  if(edgeCount>1){
    parallelOff=(edgeIdx-(edgeCount-1)/2)*10;
  }
  // 平行オフセット適用
  x1=p1.x+pnx*parallelOff; y1=p1.y+pny*parallelOff;
  x2=p2.x+pnx*parallelOff; y2=p2.y+pny*parallelOff;

  // ユーザードラッグオフセット（SVG座標をそのまま加算）
  x1+=midOx; y1+=midOy;
  x2+=midOx; y2+=midOy;

  // マーカー分だけ接触点を引き込む
  if(endTip){
    const ep=shortenPt(x1,y1,x2,y2,MARKER_LEN*width*0.35);
    x2=ep.x;y2=ep.y;
  }
  if(startTip){
    const sp=shortenPt(x2,y2,x1,y1,MARKER_LEN*width*0.35);
    x1=sp.x;y1=sp.y;
  }

  const pathD=`M${x1},${y1} L${x2},${y2}`;
  const labelX=(x1+x2)/2;
  const labelY=(y1+y2)/2;
  const mx=labelX, my=labelY;

  // 線描画
  if(etype==='double'){
    const off=Math.max(3,width+1);
    const lw=Math.max(1,Math.ceil(width/2));
    g.appendChild(svgEl('line',{class:'edge-line',x1:x1+pnx*off,y1:y1+pny*off,x2:x2+pnx*off,y2:y2+pny*off,stroke:color,'stroke-width':lw,'stroke-linecap':'round'}));
    g.appendChild(svgEl('line',{class:'edge-line',x1:x1-pnx*off,y1:y1-pny*off,x2:x2-pnx*off,y2:y2-pny*off,stroke:color,'stroke-width':lw,'stroke-linecap':'round'}));
  } else {
    const da=etype==='dashed'?'10,6':etype==='dotted'?'3,6':'none';
    const attrs={class:'edge-line',d:pathD,fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':da,'stroke-linecap':'round'};
    if(endTip){
      const mId='arr-e-'+edge.id;mkMarker(defs,mId,endTip,color,false);
      attrs['marker-end']='url(#'+mId+')';
    }
    if(startTip){
      const mId='arr-s-'+edge.id;mkMarker(defs,mId,startTip,color,true);
      attrs['marker-start']='url(#'+mId+')';
    }
    g.appendChild(svgEl('path',attrs));
  }

  // ヒットボックス（ドラッグで線移動用）
  const hitEl=svgEl('path',{class:'edge-hitbox',d:pathD});
  hitEl.addEventListener('contextmenu',ev=>{
    ev.stopPropagation();ev.preventDefault();
    const pt=svgPt(ev);
    showCtxEdgeWithBranch(ctxEdgeM,ev.clientX,ev.clientY,'edge',edge.id,{x:pt.x,y:pt.y});
  });
  hitEl.addEventListener('mousedown',e=>{
    if(e.button!==0)return;
    e.stopPropagation();
    selectItem('edge',edge.id);
    const startPt=svgPt(e);
    const startOx=edge.midOx||0, startOy=edge.midOy||0;
    let moved=false;
    function onMove(mv){
      const pt=svgPt(mv);
      edge.midOx=startOx+(pt.x-startPt.x);
      edge.midOy=startOy+(pt.y-startPt.y);
      moved=true;renderAll();
    }
    function onUp(){
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      if(moved)snap();
    }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
  g.appendChild(hitEl);

  // ラベル
  if(edge.label&&edge.label.length>0){
    const fs=edge.labelSize||11;
    const lcol=edge.labelColor&&edge.labelColor!==''?edge.labelColor:color;
    const lox=edge.labelOx||0, loy=edge.labelOy||0;
    const angle=edge.labelAngle||0;
    const lw=Math.max(32,edge.label.length*fs*0.62+20);
    const lh=fs+12;
    const lx=labelX+lox, ly=labelY+loy;
    const lshape=edge.labelShape||'pill';

    const labelG=svgEl('g',{class:'edge-label-g',cursor:'move',transform:'rotate('+angle+','+lx+','+ly+')'});

    if(lshape!=='none'){
      const rx2=lshape==='pill'?lh/2:5;
      labelG.appendChild(svgEl('rect',{x:lx-lw/2,y:ly-lh/2,width:lw,height:lh,rx:rx2,
        fill:'#fff',stroke:lcol,'stroke-width':'1.5',filter:'url(#shadow)'}));
    }
    const lt=svgEl('text',{x:lx,y:ly,'text-anchor':'middle','dominant-baseline':'middle',
      fill:lcol,'font-size':fs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'});
    lt.textContent=edge.label;labelG.appendChild(lt);

    // ラベルドラッグ移動
    labelG.addEventListener('mousedown',ev=>{
      if(ev.button!==0)return;ev.stopPropagation();
      const sp=svgPt(ev), sox=edge.labelOx||0, soy=edge.labelOy||0;
      let moved=false;
      function onMove(mv){const pt=svgPt(mv);edge.labelOx=sox+(pt.x-sp.x);edge.labelOy=soy+(pt.y-sp.y);moved=true;renderAll();}
      function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);if(moved)snap();}
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });

    // ラベルリサイズ・角度ハンドル（選択時のみ）
    if(isSel){
      // リサイズハンドル（右端）
      const rhEl=svgEl('circle',{cx:lx+lw/2,cy:ly,r:5,fill:'#fff',stroke:'#667eea','stroke-width':2,cursor:'ew-resize','pointer-events':'all'});
      rhEl.setAttribute('transform','rotate('+angle+','+lx+','+ly+')');
      rhEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        const sp=svgPt(ev), sw=edge.labelW||lw;
        function onMove(mv){
          const pt=svgPt(mv);
          const dx2=pt.x-(lx);const dy2=pt.y-(ly);
          const cos=Math.cos(-angle*Math.PI/180),sin=Math.sin(-angle*Math.PI/180);
          const rx=dx2*cos-dy2*sin;
          edge.labelW=Math.max(30,rx*2);renderAll();
        }
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      g.appendChild(rhEl);

      // 角度ハンドル（上端）
      const ahEl=svgEl('circle',{cx:lx,cy:ly-lh/2-12,r:5,fill:'#ffa502',stroke:'#fff','stroke-width':1.5,cursor:'grab','pointer-events':'all'});
      ahEl.setAttribute('transform','rotate('+angle+','+lx+','+ly+')');
      ahEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        function onMove(mv){
          const pt=svgPt(mv);
          const ang=Math.atan2(pt.y-ly,pt.x-lx)*180/Math.PI+90;
          edge.labelAngle=Math.round(ang);
          edgeLabelAngleEl.value=edge.labelAngle;
          edgeLabelAngleVal.textContent=edge.labelAngle+'°';
          renderAll();
        }
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      g.appendChild(ahEl);
    }

    g.appendChild(labelG);
  }

  g.addEventListener('click',e=>{e.stopPropagation();selectItem('edge',edge.id);});
  g.addEventListener('contextmenu',e=>{e.stopPropagation();e.preventDefault();S.ctxTarget={type:'edge',id:edge.id};showCtx(ctxEdgeM,e.clientX,e.clientY);});
  layerEdges.appendChild(g);
}

// ===== RENDER NODE =====
let hoverTimer=null;
function renderNode(node){
  const isSel=S.sel.type==='node'&&S.sel.id===node.id;
  const isSrc=S.edgeSrc===node.id;
  const color=node.color||'#667eea';
  const sty=node.style||'card';
  // circleで画像ありの場合はnode.hをここで確定させる
  if(sty==='circle'&&node.image){
    const W=nodeW(node);
    const autoFs=Math.max(10,Math.round(W/7));
    const nameFs=node.nameFontSize&&node.nameFontSize>0?node.nameFontSize:autoFs;
    const subFs=Math.max(8,Math.round(nameFs*0.75));
    const neededH=W+Math.round(nameFs*1.6)+(node.sub?(subFs+4):0)+8;
    node.h=neededH;
  } else if(sty==='circle'&&!node.image&&node.h){
    delete node.h;
  }
  const W=nodeW(node), H=nodeH(node);

  const isForkSrc=S.forkMode&&node.id===S.forkSrc;
  const isForkDst=S.forkMode&&S.forkDsts.includes(node.id);
  const g=svgEl('g',{class:'node'+(isSel?' selected':'')+(isSrc||isForkSrc?' edge-source':'')+(isForkDst?' fork-dst':''),
    transform:'translate('+(node.x-W/2)+','+(node.y-H/2)+')'});
  g.dataset.nodeId=node.id;

  switch(sty){
    case 'compact':  renderNodeCard(g,node,isSel,isSrc,color,W,H,true);break;
    case 'simple':   renderNodeSimple(g,node,isSel,isSrc,color,W,H);break;
    case 'circle':   renderNodeCircle(g,node,isSel,isSrc,color,W,H);break;
    case 'family-v': renderNodeFamilyV(g,node,isSel,isSrc,color,W,H);break;
    case 'family-h': renderNodeFamilyH(g,node,isSel,isSrc,color,W,H);break;
    default:         renderNodeCard(g,node,isSel,isSrc,color,W,H,false);
  }

  // リサイズハンドル
  if(isSel){
    [{cx:0,cy:0,cur:'nw-resize',dx:-1,dy:-1},{cx:W,cy:0,cur:'ne-resize',dx:1,dy:-1},
     {cx:W,cy:H,cur:'se-resize',dx:1,dy:1},{cx:0,cy:H,cur:'sw-resize',dx:-1,dy:1},
     {cx:W/2,cy:0,cur:'n-resize',dx:0,dy:-1},{cx:W/2,cy:H,cur:'s-resize',dx:0,dy:1},
     {cx:W,cy:H/2,cur:'e-resize',dx:1,dy:0},{cx:0,cy:H/2,cur:'w-resize',dx:-1,dy:0}
    ].forEach(h=>{
      const hEl=svgEl('circle',{cx:h.cx,cy:h.cy,r:5,fill:'#fff',stroke:'#667eea','stroke-width':2,cursor:h.cur});
      hEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        const sp=svgPt(ev),sw=nodeW(node),sh=nodeH(node),sxn=node.x,syn=node.y;
        function onMove(mv){
          const pt=svgPt(mv),ddx=pt.x-sp.x,ddy=pt.y-sp.y;
          if(h.dx!==0){node.w=Math.max(40,sw+ddx*h.dx);node.x=sxn+(h.dx>0?(node.w-sw)/2:-(node.w-sw)/2);}
          if(h.dy!==0){node.h=Math.max(36,sh+ddy*h.dy);node.y=syn+(h.dy>0?(node.h-sh)/2:-(node.h-sh)/2);}
          renderAll();
        }
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      g.appendChild(hEl);
    });
  }

  // ホバー接続ボタン位置：ノード右上角に固定
  g.addEventListener('mouseenter',()=>{
    if(S.edgeSrc!==null||S.drag||S.tool!=='select')return;
    clearTimeout(hoverTimer);showConnectBtn(node);
  });
  g.addEventListener('mouseleave',()=>{
    hoverTimer=setTimeout(()=>{if(!connectBtn.matches(':hover'))hideConnectBtn();},220);
  });
  g.addEventListener('mousedown',e=>{
    if(e.button!==0)return;e.stopPropagation();hideConnectBtn();
    // フォークモード: 子ノードをトグル選択
    if(S.forkMode){
      if(node.id===S.forkSrc)return;
      const idx=S.forkDsts.indexOf(node.id);
      if(idx>=0){S.forkDsts.splice(idx,1);}
      else{S.forkDsts.push(node.id);}
      renderAll();return;
    }
    // ブランチモード: クリック点→このノードへフリー線
    if(S.branchMode&&S.branchOrigin){
      snap();
      const bo=S.branchOrigin;
      S.freeLines.push({id:S.nextId++,
        x1:bo.x,y1:bo.y,x2:node.x,y2:node.y,
        type:edgeTypeBar.value,color:edgeColorBar.value,width:2,
        waypoints:[],label:'',labelSize:11,labelColor:'',labelShape:'pill',
        labelAngle:0,icon:'',iconSize:24});
      S.branchMode=false;S.branchOrigin=null;
      cancelEdge();renderAll();return;
    }
    // 通常接続モード
    if(S.edgeSrc!==null){
      snap();
      const newEdge={id:S.nextId++,src:S.edgeSrc,dst:node.id,
        type:S.pendingType||edgeTypeBar.value,
        color:S.pendingColor||edgeColorBar.value,
        width:3,
        label:'',labelSize:11,labelColor:'',labelShape:'pill',labelAngle:0,
        icon:'',iconSize:24,heartSize:24,wavyAmp:8,labelOx:0,labelOy:0,midOx:0,midOy:0,
        waypoints:[]};
      S.edges.push(newEdge);
      cancelEdge();renderAll();return;
    }
    selectItem('node',node.id);
    const pt=svgPt(e);
    S.drag={type:'node',id:node.id,origX:node.x,origY:node.y,startX:pt.x,startY:pt.y,moved:false};
  });
  g.addEventListener('contextmenu',e=>{
    e.stopPropagation();e.preventDefault();
    S.ctxTarget={type:'node',id:node.id};showCtx(ctxNodeM,e.clientX,e.clientY);
  });
  layerNodes.appendChild(g);
}

// ===== NODE SHAPE RENDERERS =====
function renderNodeCard(g,node,isSel,isSrc,color,W,H,compact){
  const IH=compact?Math.round(H*0.60):Math.round(H*0.70);
  const TH=H-IH;
  const clip=node.clip||'roundrect';
  const R=12;
  const defs=svg.querySelector('defs');
  // 文字サイズ: 手動設定(nameFontSize>0)があればそれを使い、なければWから自動計算
  const autoFs=Math.max(10,Math.round(W/8));
  const nameFs=node.nameFontSize&&node.nameFontSize>0?node.nameFontSize:autoFs;
  const subFs=Math.max(8,Math.round(nameFs*0.75));
  const nameColor=node.nameColor||'#222222';
  const subColor=node.subColor||color;
  g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,rx:R,
    fill:'#fff',stroke:isSrc?'#ff4757':isSel?'#667eea':color,
    'stroke-width':isSrc||isSel?3:2,filter:isSel?'url(#shadow-sel)':'url(#shadow)'}));
  const clipId='nclip-'+node.id;
  defs.querySelector('#'+clipId)?.remove();
  const cl=svgEl('clipPath',{id:clipId});
  if(clip==='circle'){
    // 真円クリップ（IHとWの小さい方を直径に）
    const cr=Math.min(IH,W)/2;
    cl.appendChild(svgEl('circle',{cx:W/2,cy:IH/2,r:cr}));
  } else {
    // デフォルト: 角丸四角（ノード上部に合わせた形）
    cl.appendChild(svgEl('path',{d:`M${R},0 H${W-R} Q${W},0 ${W},${R} V${IH} H0 V${R} Q0,0 ${R},0 Z`}));
  }
  defs.appendChild(cl);
  if(node.image){
    const ox=node.imgOx||0,oy=node.imgOy||0,sc=(node.imgScale||100)/100;
    const iw=W*sc,ih=IH*sc,ix=(W-iw)/2+ox,iy=(IH-ih)/2+oy;
    g.appendChild(svgEl('image',{x:ix,y:iy,width:iw,height:ih,href:node.image,
      preserveAspectRatio:'xMidYMid slice','clip-path':'url(#'+clipId+')'}));
  } else {
    const phId='ph-'+node.id;
    defs.querySelector('#'+phId)?.remove();
    const grad=svgEl('linearGradient',{id:phId,x1:'0',y1:'0',x2:'0',y2:'1'});
    [['0%',color+'bb'],['100%',color+'44']].forEach(([off,col])=>{const s=svgEl('stop',{offset:off});s.setAttribute('stop-color',col);grad.appendChild(s);});
    defs.appendChild(grad);
    g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:IH,fill:'url(#'+phId+')','clip-path':'url(#'+clipId+')'}));
    const ph=svgEl('g',{'pointer-events':'none','clip-path':'url(#'+clipId+')'});
    ph.appendChild(svgEl('circle',{cx:W/2,cy:IH*0.33,r:IH*0.17,fill:'rgba(255,255,255,0.55)'}));
    ph.appendChild(svgEl('ellipse',{cx:W/2,cy:IH*0.78,rx:IH*0.21,ry:IH*0.19,fill:'rgba(255,255,255,0.4)'}));
    g.appendChild(ph);
  }
  g.appendChild(svgEl('rect',{x:0,y:IH,width:W,height:2.5,fill:color}));
  g.appendChild(svgEl('path',{d:`M0,${IH+2.5} H${W} V${H-R} Q${W},${H} ${W-R},${H} H${R} Q0,${H} 0,${H-R} Z`,fill:'#fff'}));
  const nameY=IH+2.5+TH*(node.sub?0.36:0.5);
  g.appendChild(Object.assign(svgEl('text',{x:W/2,y:nameY,'text-anchor':'middle','dominant-baseline':'middle',
    fill:nameColor,'font-size':nameFs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'}),
    {textContent:node.name||'名前'}));
  if(node.sub){
    g.appendChild(Object.assign(svgEl('text',{x:W/2,y:nameY+nameFs+2,'text-anchor':'middle','dominant-baseline':'middle',
      fill:subColor,'font-size':subFs,'font-family':'Yu Gothic UI,sans-serif','pointer-events':'none'}),
      {textContent:node.sub}));
  }
}

function renderNodeSimple(g,node,isSel,isSrc,color,W,H){
  const autoFs=Math.max(10,Math.round(W/8));
  const nameFs=node.nameFontSize&&node.nameFontSize>0?node.nameFontSize:autoFs;
  const subFs=Math.max(8,Math.round(nameFs*0.75));
  const nameColor=node.nameColor||color;
  const subColor=node.subColor||color;
  const R=10;
  const defs=svg.querySelector('defs');
  const hasImg=!!node.image;

  // 外枠
  g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,rx:R,
    fill:node.fillColor||'#fff',
    stroke:isSrc?'#ff4757':isSel?'#667eea':color,'stroke-width':isSrc||isSel?3:2.5,
    filter:isSel?'url(#shadow-sel)':'url(#shadow)'}));

  if(hasImg){
    // 画像あり: 上部に画像（枠の角丸に沿ってクリップ）、下部に名前・サブ
    const IH=Math.round(H*0.65);
    const TH=H-IH;
    const clipId='nclip-si-'+node.id;
    defs.querySelector('#'+clipId)?.remove();
    const cl=svgEl('clipPath',{id:clipId});
    // 上部のみ角丸（下は直線）
    cl.appendChild(svgEl('path',{d:`M${R},0 L${W-R},0 Q${W},0 ${W},${R} L${W},${IH} L0,${IH} L0,${R} Q0,0 ${R},0 Z`}));
    defs.appendChild(cl);
    g.appendChild(svgEl('image',{x:0,y:0,width:W,height:IH,href:node.image,
      preserveAspectRatio:'xMidYMid slice','clip-path':'url(#'+clipId+')'}));
    // 境界線
    g.appendChild(svgEl('line',{x1:0,y1:IH,x2:W,y2:IH,stroke:color,'stroke-width':1,'opacity':'0.3'}));
    const nameY=IH+TH*(node.sub?0.36:0.5);
    g.appendChild(Object.assign(svgEl('text',{x:W/2,y:nameY,'text-anchor':'middle','dominant-baseline':'middle',
      fill:nameColor,'font-size':nameFs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'}),
      {textContent:node.name||'名前'}));
    if(node.sub)g.appendChild(Object.assign(svgEl('text',{x:W/2,y:nameY+nameFs+2,'text-anchor':'middle','dominant-baseline':'middle',
      fill:subColor,'font-size':subFs,'font-family':'Yu Gothic UI,sans-serif','pointer-events':'none','opacity':'0.85'}),{textContent:node.sub}));
  } else {
    // 画像なし: 枠内にテキスト
    g.appendChild(Object.assign(svgEl('text',{x:W/2,y:H/2-(node.sub?nameFs*0.6:0),'text-anchor':'middle','dominant-baseline':'middle',
      fill:nameColor,'font-size':nameFs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'}),
      {textContent:node.name||'名前'}));
    if(node.sub)g.appendChild(Object.assign(svgEl('text',{x:W/2,y:H/2+nameFs*0.6+2,'text-anchor':'middle','dominant-baseline':'middle',
      fill:subColor,'font-size':subFs,'font-family':'Yu Gothic UI,sans-serif','pointer-events':'none','opacity':'0.85'}),{textContent:node.sub}));
  }
}

function renderNodeCircle(g,node,isSel,isSrc,color,W,H){
  const cx=W/2;
  const defs=svg.querySelector('defs');
  const hasImg=!!node.image;
  const autoFs=Math.max(10,Math.round(W/7));
  const nameFs=node.nameFontSize&&node.nameFontSize>0?node.nameFontSize:autoFs;
  const subFs=Math.max(8,Math.round(nameFs*0.75));
  const nameColor=node.nameColor||(hasImg?'#222222':'#ffffff');
  const subColor=node.subColor||(hasImg?color:'rgba(255,255,255,0.85)');

  if(hasImg){
    // node.hはrenderNode側で事前計算済み
    const r=W/2;
    const clipId='nclip-ci-'+node.id;
    defs.querySelector('#'+clipId)?.remove();
    const cl=svgEl('clipPath',{id:clipId});
    cl.appendChild(svgEl('circle',{cx,cy:r,r:r-1}));
    defs.appendChild(cl);
    g.appendChild(svgEl('image',{x:0,y:0,width:W,height:W,href:node.image,
      preserveAspectRatio:'xMidYMid slice','clip-path':'url(#'+clipId+')'}));
    g.appendChild(svgEl('circle',{cx,cy:r,r,fill:'none',
      stroke:isSrc?'#ff4757':isSel?'#667eea':color,'stroke-width':isSrc||isSel?3:2.5,
      filter:isSel?'url(#shadow-sel)':'url(#shadow)'}));
    const nameY=W+nameFs;
    g.appendChild(Object.assign(svgEl('text',{x:cx,y:nameY,'text-anchor':'middle','dominant-baseline':'middle',
      fill:nameColor,'font-size':nameFs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'}),
      {textContent:node.name||'名前'}));
    if(node.sub)g.appendChild(Object.assign(svgEl('text',{x:cx,y:nameY+nameFs+2,'text-anchor':'middle','dominant-baseline':'middle',
      fill:subColor,'font-size':subFs,'font-family':'Yu Gothic UI,sans-serif','pointer-events':'none'}),
      {textContent:node.sub}));
  } else {
    // 画像なし: 円内にテキスト
    const r=Math.min(W,H)/2;
    const cy=H/2;
    const phId='ph-c-'+node.id;
    defs.querySelector('#'+phId)?.remove();
    const grad=svgEl('radialGradient',{id:phId});
    [['0%',color+'aa'],['100%',color+'33']].forEach(([off,col])=>{const s=svgEl('stop',{offset:off});s.setAttribute('stop-color',col);grad.appendChild(s);});
    defs.appendChild(grad);
    g.appendChild(svgEl('circle',{cx,cy,r,fill:'url(#'+phId+')'}));
    g.appendChild(svgEl('circle',{cx,cy,r,fill:'none',stroke:isSrc?'#ff4757':isSel?'#667eea':color,
      'stroke-width':isSrc||isSel?3:2.5,filter:isSel?'url(#shadow-sel)':'url(#shadow)'}));
    g.appendChild(Object.assign(svgEl('text',{x:cx,y:cy-(node.sub?nameFs*0.6:0),'text-anchor':'middle','dominant-baseline':'middle',
      fill:nameColor,'font-size':nameFs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'}),
      {textContent:node.name||'名前'}));
    if(node.sub)g.appendChild(Object.assign(svgEl('text',{x:cx,y:cy+nameFs*0.7,'text-anchor':'middle','dominant-baseline':'middle',
      fill:subColor,'font-size':subFs,'font-family':'Yu Gothic UI,sans-serif','pointer-events':'none'}),
      {textContent:node.sub}));
  }
}

// ===== RENDER NODE FAMILY-V（家系図縦書き） =====
// レイアウト（右→左）: 旧姓など | 続柄 | 名前（中心） | 生年月日 | 没年月日
function renderNodeFamilyV(g,node,isSel,isSrc,color,W,H){
  const font=node.familyFont||'Yu Mincho,Georgia,serif';
  const nameFs=node.nameFontSize&&node.nameFontSize>0?node.nameFontSize:16;
  const subFs=Math.max(9,Math.round(nameFs*0.72));
  const dateFs=Math.max(8,Math.round(nameFs*0.65));
  // 白背景（フォーク線がノードを貫通して見えないようにする）
  g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,
    fill:'#ffffff',
    stroke:isSrc?'#ff4757':isSel?'#667eea':'none',
    'stroke-width':2,'fill-opacity':'1'}));
  // 各列のX位置（縦書きはx位置で列を制御）
  // 中央: 名前, 右: 続柄→旧姓, 左: 生年月日→没年月日
  const GAP=4;
  // 名前列X（中央）
  const nameColX=W/2;
  // 右側: 続柄
  const kinColX=nameColX+nameFs+GAP;
  // 右側: 旧姓など（続柄のさらに右）
  const otherColX=kinColX+subFs+GAP;
  // 左側: 生年月日
  const birthColX=nameColX-dateFs-GAP;
  // 左側: 没年月日（生年月日のさらに左）
  const deathColX=birthColX-dateFs-GAP;

  // 名前（縦書き）
  const nt=svgEl('text',{x:nameColX,y:8,
    fill:'#111111','font-size':nameFs,'font-weight':'bold','font-family':font,
    'writing-mode':'vertical-rl','text-orientation':'mixed',
    'dominant-baseline':'auto','text-anchor':'start','pointer-events':'none'});
  nt.textContent=node.name||'名前';
  g.appendChild(nt);

  // 続柄（名前の右）
  const kinship=node.kinship||'';
  if(kinship){
    const kt=svgEl('text',{x:kinColX,y:8,
      fill:'#444444','font-size':subFs,'font-family':font,
      'writing-mode':'vertical-rl','text-orientation':'mixed',
      'dominant-baseline':'auto','text-anchor':'start','pointer-events':'none'});
    kt.textContent=kinship;
    g.appendChild(kt);
  }

  // その他・旧姓（続柄の右）
  const other=node.other||'';
  if(other){
    const ot=svgEl('text',{x:otherColX,y:8,
      fill:'#888888','font-size':dateFs,'font-family':font,
      'writing-mode':'vertical-rl','text-orientation':'mixed',
      'dominant-baseline':'auto','text-anchor':'start','pointer-events':'none'});
    ot.textContent=other;
    g.appendChild(ot);
  }

  // 生年月日（名前の左、間隔あり）
  if(node.birth){
    const bt=svgEl('text',{x:birthColX,y:8,
      fill:'#555555','font-size':dateFs,'font-family':font,
      'writing-mode':'vertical-rl','text-orientation':'mixed',
      'dominant-baseline':'auto','text-anchor':'start','pointer-events':'none'});
    bt.textContent=node.birth;
    g.appendChild(bt);
  }

  // 没年月日（生年月日の左）
  if(node.death){
    const dt=svgEl('text',{x:deathColX,y:8,
      fill:'#888888','font-size':dateFs,'font-family':font,
      'writing-mode':'vertical-rl','text-orientation':'mixed',
      'dominant-baseline':'auto','text-anchor':'start','pointer-events':'none'});
    dt.textContent=node.death;
    g.appendChild(dt);
  }

  // 選択・接続元の枠（最前面）
  if(isSel||isSrc){
    g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,
      fill:'none',stroke:isSrc?'#ff4757':'#667eea','stroke-width':2,'rx':2}));
  }
}

// ===== RENDER NODE FAMILY-H（家系図横書き） =====
// レイアウト（上→下）: 続柄 → 名前 → 旧姓など → 生年月日 → 没年月日
function renderNodeFamilyH(g,node,isSel,isSrc,color,W,H){
  const font=node.familyFont||'Yu Mincho,Georgia,serif';
  const nameFs=node.nameFontSize&&node.nameFontSize>0?node.nameFontSize:15;
  const subFs=Math.max(9,Math.round(nameFs*0.72));
  const dateFs=Math.max(8,Math.round(nameFs*0.65));
  // 白背景（フォーク線がノードを貫通して見えないようにする）
  g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,
    fill:'#ffffff',
    stroke:isSrc?'#ff4757':isSel?'#667eea':'none',
    'stroke-width':2}));

  const kinship=node.kinship||'';
  const other=node.other||'';
  const lines=[];
  if(kinship)lines.push({text:kinship,fs:subFs,color:'#666666'});
  lines.push({text:node.name||'名前',fs:nameFs,color:'#111111',bold:true});
  if(other)lines.push({text:other,fs:dateFs,color:'#888888'});
  if(node.birth)lines.push({text:node.birth,fs:dateFs,color:'#555555'});
  if(node.death)lines.push({text:node.death,fs:dateFs,color:'#888888'});

  const totalH=lines.reduce((s,l)=>s+l.fs*1.4,0);
  let cy=(H-totalH)/2+lines[0].fs*0.7;
  lines.forEach(l=>{
    const el=svgEl('text',{x:10,y:cy,
      'dominant-baseline':'middle',
      fill:l.color,'font-size':l.fs,'font-family':font,'pointer-events':'none'});
    if(l.bold)el.setAttribute('font-weight','bold');
    el.textContent=l.text;
    g.appendChild(el);
    cy+=l.fs*1.4;
  });

  // 選択・接続元の枠（最前面）
  if(isSel||isSrc){
    g.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,
      fill:'none',stroke:isSrc?'#ff4757':'#667eea','stroke-width':2,'rx':2}));
  }
}
// ===== RENDER ELBOW EDGE =====
// エルボー線: ノード間を直角折れ線で接続、中継点（waypoints）をドラッグ可能
function renderElbowEdge(edge){
  const src=S.nodes.find(n=>n.id===edge.src), dst=S.nodes.find(n=>n.id===edge.dst);
  if(!src||!dst)return;
  const isSel=S.sel.type==='edge'&&S.sel.id===edge.id;
  const color=isSel?'#667eea':(edge.color||'#ff6b9d');
  const width=edge.width||3;
  const defs=svg.querySelector('defs');
  const g=svgEl('g',{class:'edge'+(isSel?' selected':'')});
  g.dataset.edgeId=edge.id;

  // 接触点
  const p1=nodeContactPt(src, dst.x-src.x, dst.y-src.y);
  const p2=nodeContactPt(dst, src.x-dst.x, src.y-dst.y);

  // デフォルトwaypoints生成（接触点方向に応じたL字）
  function makeDefaultWaypoints(){
    const mx=(p1.x+p2.x)/2;
    // 主に縦方向なら中間Y、横方向なら中間X
    const adx=Math.abs(p2.x-p1.x), ady=Math.abs(p2.y-p1.y);
    if(adx>ady){
      // 横が長い: p1→(mx,p1.y)→(mx,p2.y)→p2
      return [{x:mx,y:p1.y},{x:mx,y:p2.y}];
    } else {
      // 縦が長い: p1→(p1.x,my)→(p2.x,my)→p2
      const my=(p1.y+p2.y)/2;
      return [{x:p1.x,y:my},{x:p2.x,y:my}];
    }
  }
  if(!edge.waypoints||edge.waypoints.length===0){
    edge.waypoints=makeDefaultWaypoints();
  }

  // 全ポイント: p1 → waypoints → p2
  const pts=[{x:p1.x,y:p1.y},...edge.waypoints,{x:p2.x,y:p2.y}];

  // パス生成
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=1;i<pts.length;i++) d+=` L${pts[i].x},${pts[i].y}`;

  // 矢印マーカー
  const TM={
    'arrow-single':{e:'arrow'},'arrow-rev':{s:'arrow'},'arrow-both':{s:'arrow',e:'arrow'},
    'arrow-filled':{e:'arrow-filled'},'arrow-filled-rev':{s:'arrow-filled'},
    'arrow-filled-both':{s:'arrow-filled',e:'arrow-filled'},
  };
  const tips=TM[edge.type||'solid']||{};
  const da=edge.type==='dashed'?'10,6':edge.type==='dotted'?'3,6':'none';
  const attrs={class:'edge-line',d,fill:'none',stroke:color,'stroke-width':width,
    'stroke-dasharray':da,'stroke-linecap':'round','stroke-linejoin':'round'};
  if(tips.e){mkMarker(defs,'arr-e-'+edge.id,tips.e,color,false);attrs['marker-end']='url(#arr-e-'+edge.id+')';}
  if(tips.s){mkMarker(defs,'arr-s-'+edge.id,tips.s,color,true);attrs['marker-start']='url(#arr-s-'+edge.id+')';}
  g.appendChild(svgEl('path',attrs));

  // ヒットボックス（右クリックで中継点追加）
  const hitElbow=svgEl('path',{class:'edge-hitbox',d,fill:'none'});
  hitElbow.addEventListener('contextmenu',ev=>{
    ev.stopPropagation();ev.preventDefault();
    // エルボー線の右クリック→コンテキストメニューで選択
    const pt=svgPt(ev);
    S.ctxTarget={type:'edge',id:edge.id,branchPt:{x:pt.x,y:pt.y}};
    showCtxEdgeWithBranch(ctxEdgeM,ev.clientX,ev.clientY,'edge',edge.id,{x:pt.x,y:pt.y});
  });
  g.appendChild(hitElbow);

  // 中継点ハンドル（選択時）
  if(isSel){
    edge.waypoints.forEach((wp,i)=>{
      const hEl=svgEl('circle',{cx:wp.x,cy:wp.y,r:7,fill:'#fff',stroke:color,
        'stroke-width':2.5,cursor:'move','pointer-events':'all'});
      hEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        const sp=svgPt(ev),ox=wp.x,oy=wp.y;
        function onMove(mv){const pt=svgPt(mv);wp.x=ox+(pt.x-sp.x);wp.y=oy+(pt.y-sp.y);renderAll();}
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      // 右クリックで削除
      hEl.addEventListener('contextmenu',ev=>{
        ev.stopPropagation();ev.preventDefault();
        edge.waypoints.splice(i,1);snap();renderAll();
      });
      g.appendChild(hEl);
    });

    // 線分の中点に「点を追加」ボタン
    for(let i=0;i<pts.length-1;i++){
      const mx2=(pts[i].x+pts[i+1].x)/2, my2=(pts[i].y+pts[i+1].y)/2;
      const addEl=svgEl('circle',{cx:mx2,cy:my2,r:5,fill:color,opacity:'0.5',
        cursor:'crosshair','pointer-events':'all'});
      addEl.addEventListener('click',ev=>{
        ev.stopPropagation();
        // waypointsのインデックス（i=0はp1→wp[0]の間, i=1はwp[0]→wp[1]の間...）
        const wpIdx=i; // pts[i]からwaypoints[i-1]へのマッピング
        edge.waypoints.splice(Math.max(0,i),0,{x:mx2,y:my2});
        snap();renderAll();
      });
      g.appendChild(addEl);
    }
  }

  // ラベル
  const lx=pts[Math.floor(pts.length/2)].x+(edge.labelOx||0);
  const ly=pts[Math.floor(pts.length/2)].y+(edge.labelOy||0);
  if(edge.label){
    const fs=edge.labelSize||11,lcol=edge.labelColor||color;
    const lw=Math.max(32,edge.label.length*fs*0.62+20),lh=fs+12;
    const lshape=edge.labelShape||'pill';
    const labelG=svgEl('g',{class:'edge-label-g',cursor:'move',
      transform:'rotate('+(edge.labelAngle||0)+','+lx+','+ly+')'});
    if(lshape!=='none'){
      labelG.appendChild(svgEl('rect',{x:lx-lw/2,y:ly-lh/2,width:lw,height:lh,
        rx:lshape==='pill'?lh/2:5,fill:'#fff',stroke:lcol,'stroke-width':'1.5',filter:'url(#shadow)'}));
    }
    const lt=svgEl('text',{x:lx,y:ly,'text-anchor':'middle','dominant-baseline':'middle',
      fill:lcol,'font-size':fs,'font-weight':'bold','font-family':'Yu Gothic UI,Meiryo,sans-serif','pointer-events':'none'});
    lt.textContent=edge.label;labelG.appendChild(lt);
    labelG.addEventListener('mousedown',ev=>{
      if(ev.button!==0)return;ev.stopPropagation();
      const sp=svgPt(ev),sox=edge.labelOx||0,soy=edge.labelOy||0;
      function onMove(mv){const pt=svgPt(mv);edge.labelOx=sox+(pt.x-sp.x);edge.labelOy=soy+(pt.y-sp.y);renderAll();}
      function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    g.appendChild(labelG);
  }

  g.addEventListener('click',e=>{e.stopPropagation();selectItem('edge',edge.id);});
  g.addEventListener('contextmenu',e=>{
    e.stopPropagation();e.preventDefault();
    S.ctxTarget={type:'edge',id:edge.id};
    const _b=$('ctx-edge-branch'),_l=$('ctx-edge-label');
    if(_b)_b.style.display='';if(_l)_l.style.display='';
    showCtx(ctxEdgeM,e.clientX,e.clientY);
  });
  layerEdges.appendChild(g);
}

// ===== RENDER FREE LINE =====
function renderFreeLine(fl){
  const isSel=S.sel.type==='freeline'&&S.sel.id===fl.id;
  const color=isSel?'#667eea':(fl.color||'#333333');
  const width=fl.width||2;
  const g=svgEl('g',{class:'freeline'+(isSel?' selected':'')});
  g.dataset.freeLineId=fl.id;

  const pts=[{x:fl.x1,y:fl.y1},...(fl.waypoints||[]),{x:fl.x2,y:fl.y2}];
  let d=`M${pts[0].x},${pts[0].y}`;
  for(let i=1;i<pts.length;i++) d+=` L${pts[i].x},${pts[i].y}`;

  const defs=svg.querySelector('defs');
  const TM_FL={
    'arrow-single':{e:'arrow'},'arrow-rev':{s:'arrow'},'arrow-both':{s:'arrow',e:'arrow'},
    'arrow-filled':{e:'arrow-filled'},'arrow-filled-rev':{s:'arrow-filled'},
    'arrow-filled-both':{s:'arrow-filled',e:'arrow-filled'},
    'arrow-circle':{e:'circle'},'arrow-circle-both':{s:'circle',e:'circle'},
    'arrow-diamond':{e:'diamond'},'arrow-bar':{s:'bar',e:'bar'},
  };
  const tips=TM_FL[fl.type||'solid']||{};
  const da=fl.type==='dashed'?'10,6':fl.type==='dotted'?'3,6':'none';
  const attrs={class:'edge-line',d,fill:'none',stroke:color,'stroke-width':width,
    'stroke-dasharray':da,'stroke-linecap':'round','stroke-linejoin':'round'};
  if(tips.e){mkMarker(defs,'arr-fe-'+fl.id,tips.e,color,false);attrs['marker-end']='url(#arr-fe-'+fl.id+')';}
  if(tips.s){mkMarker(defs,'arr-fs-'+fl.id,tips.s,color,true);attrs['marker-start']='url(#arr-fs-'+fl.id+')';}
  g.appendChild(svgEl('path',attrs));

  // ヒットボックス
  const hit=svgEl('path',{class:'edge-hitbox',d,fill:'none'});
  hit.addEventListener('mousedown',ev=>{
    if(ev.button!==0)return;ev.stopPropagation();
    selectItem('freeline',fl.id);
    const sp=svgPt(ev),sox=fl.x1,soy=fl.y1,sex=fl.x2,sey=fl.y2;
    const swps=(fl.waypoints||[]).map(w=>({x:w.x,y:w.y}));
    let moved=false;
    function onMove(mv){
      const pt=svgPt(mv),dx=pt.x-sp.x,dy=pt.y-sp.y;
      fl.x1=sox+dx;fl.y1=soy+dy;fl.x2=sex+dx;fl.y2=sey+dy;
      fl.waypoints=(fl.waypoints||[]).map((w,i)=>({x:swps[i].x+dx,y:swps[i].y+dy}));
      moved=true;renderAll();
    }
    function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);if(moved)snap();}
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  });
  g.appendChild(hit);

  // 端点ハンドル（常に表示）
  [{key:'p1',cx:fl.x1,cy:fl.y1},{key:'p2',cx:fl.x2,cy:fl.y2}].forEach(h=>{
    const hEl=svgEl('circle',{cx:h.cx,cy:h.cy,r:isSel?7:5,
      fill:'#fff',stroke:color,'stroke-width':2,cursor:'move','pointer-events':'all'});
    hEl.addEventListener('mousedown',ev=>{
      ev.stopPropagation();ev.preventDefault();
      const sp=svgPt(ev),ox=h.key==='p1'?fl.x1:fl.x2,oy=h.key==='p1'?fl.y1:fl.y2;
      function onMove(mv){
        const pt=svgPt(mv);
        if(h.key==='p1'){fl.x1=ox+(pt.x-sp.x);fl.y1=oy+(pt.y-sp.y);}
        else{fl.x2=ox+(pt.x-sp.x);fl.y2=oy+(pt.y-sp.y);}
        renderAll();
      }
      function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    g.appendChild(hEl);
  });

  // 中継点ハンドル（選択時）
  if(isSel){
    (fl.waypoints||[]).forEach((wp,i)=>{
      const hEl=svgEl('circle',{cx:wp.x,cy:wp.y,r:6,fill:'#fff',stroke:color,
        'stroke-width':2,cursor:'move','pointer-events':'all'});
      hEl.addEventListener('mousedown',ev=>{
        ev.stopPropagation();ev.preventDefault();
        const sp=svgPt(ev),ox=wp.x,oy=wp.y;
        function onMove(mv){const pt=svgPt(mv);wp.x=ox+(pt.x-sp.x);wp.y=oy+(pt.y-sp.y);renderAll();}
        function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
      });
      hEl.addEventListener('contextmenu',ev=>{
        ev.stopPropagation();ev.preventDefault();
        fl.waypoints.splice(i,1);snap();renderAll();
      });
      g.appendChild(hEl);
    });
    // 線分中点に追加ボタン
    for(let i=0;i<pts.length-1;i++){
      const mx2=(pts[i].x+pts[i+1].x)/2,my2=(pts[i].y+pts[i+1].y)/2;
      const addEl=svgEl('circle',{cx:mx2,cy:my2,r:5,fill:color,opacity:'0.5',
        cursor:'crosshair','pointer-events':'all'});
      addEl.addEventListener('click',ev=>{
        ev.stopPropagation();
        if(!fl.waypoints)fl.waypoints=[];
        fl.waypoints.splice(i,0,{x:mx2,y:my2});
        snap();renderAll();
      });
      g.appendChild(addEl);
    }
  }

  g.addEventListener('click',e=>{e.stopPropagation();selectItem('freeline',fl.id);});
  g.addEventListener('contextmenu',e=>{
    e.stopPropagation();e.preventDefault();
    const pt=svgPt(e);
    const mx2=(fl.x1+fl.x2)/2, my2=(fl.y1+fl.y2)/2;
    showCtxEdgeWithBranch(ctxEdgeM,e.clientX,e.clientY,'freeline',fl.id,{x:mx2,y:my2});
  });
  layerEdges.appendChild(g);
}

// ===== RENDER FORK =====
// フォーク線: 親→分岐点→各子ノードへのT字/L字分岐
// 縦型: 親が上、子が下 → 親から下に幹線→横棒→各子へ縦線
// 横型: 親が左、子が右 → 親から右に幹線→縦棒→各子へ横線
function renderFork(fork){
  const src=S.nodes.find(n=>n.id===fork.srcId);
  if(!src)return;
  const dsts=fork.dsts.map(id=>S.nodes.find(n=>n.id===id)).filter(Boolean);
  if(dsts.length===0)return;

  const isSel=S.sel.type==='fork'&&S.sel.id===fork.id;
  const color=isSel?'#667eea':(fork.color||'#ff6b9d');
  const width=fork.width||3;
  const defs=svg.querySelector('defs');
  const g=svgEl('g',{class:'fork-group'+(isSel?' selected':'')});
  g.dataset.forkId=fork.id;

  // 子ノードの平均位置でメイン方向を決定
  const avgX=dsts.reduce((s,d)=>s+d.x,0)/dsts.length;
  const avgY=dsts.reduce((s,d)=>s+d.y,0)/dsts.length;
  const mainDir=Math.abs(avgY-src.y)>=Math.abs(avgX-src.x)?'v':'h';

  // forkPtデフォルト生成（リセット可能）
  if(!fork.forkPt){
    if(mainDir==='v'){
      // 縦型: 親の真下、子たちのY中間あたり
      fork.forkPt={x:src.x, y:src.y+nodeH(src)/2+(avgY-src.y-nodeH(src)/2)*0.45};
    } else {
      // 横型: 親の右、子たちのX中間あたり
      fork.forkPt={x:src.x+nodeW(src)/2+(avgX-src.x-nodeW(src)/2)*0.45, y:src.y};
    }
  }
  const fp=fork.forkPt;

  // 幹線: src接触点 → forkPt
  const sp=nodeContactPt(src, fp.x-src.x, fp.y-src.y);
  g.appendChild(svgEl('path',{
    d:`M${sp.x},${sp.y} L${fp.x},${fp.y}`,
    fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round'
  }));

  // 矢印ヘルパー
  const TM_FORK={'arrow-single':{e:'arrow'},'arrow-rev':{s:'arrow'},'arrow-both':{s:'arrow',e:'arrow'},
    'arrow-filled':{e:'arrow-filled'},'arrow-filled-rev':{s:'arrow-filled'},'arrow-filled-both':{s:'arrow-filled',e:'arrow-filled'}};
  const forkTips=(fork.type&&fork.type!=='solid'&&fork.type!=='dashed'&&fork.type!=='dotted')?
    (TM_FORK[fork.type]||{}):{};
  const forkDa=fork.type==='dashed'?'10,6':fork.type==='dotted'?'3,6':'none';

  if(mainDir==='v'){
    // ===== 縦型: T字 =====
    // 横棒: fp.yの高さで全子ノードのX範囲をカバー
    const minX=Math.min(...dsts.map(d=>d.x), fp.x);
    const maxX=Math.max(...dsts.map(d=>d.x), fp.x);
    g.appendChild(svgEl('line',{
      x1:minX,y1:fp.y,x2:maxX,y2:fp.y,
      stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-dasharray':forkDa
    }));
    // 各子ノードへ: (dst.x, fp.y) → dst接触点 の直線
    dsts.forEach(dst=>{
      const ep=nodeContactPt(dst, 0, dst.y-fp.y); // 真上から当たる
      const mId='arr-fk-'+fork.id+'-'+dst.id;
      const attrs={
        d:`M${dst.x},${fp.y} L${ep.x},${ep.y}`,
        fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-dasharray':forkDa
      };
      if(forkTips.e){mkMarker(defs,mId,forkTips.e,color,false);attrs['marker-end']='url(#'+mId+')';}
      g.appendChild(svgEl('path',attrs));
    });
  } else {
    // ===== 横型: T字 =====
    // 縦棒: fp.xの位置で全子ノードのY範囲をカバー
    const minY=Math.min(...dsts.map(d=>d.y), fp.y);
    const maxY=Math.max(...dsts.map(d=>d.y), fp.y);
    g.appendChild(svgEl('line',{
      x1:fp.x,y1:minY,x2:fp.x,y2:maxY,
      stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-dasharray':forkDa
    }));
    // 各子ノードへ: (fp.x, dst.y) → dst接触点 の直線
    dsts.forEach(dst=>{
      const ep=nodeContactPt(dst, dst.x-fp.x, 0); // 真横から当たる
      const mId='arr-fk-'+fork.id+'-'+dst.id;
      const attrs={
        d:`M${fp.x},${dst.y} L${ep.x},${ep.y}`,
        fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-dasharray':forkDa
      };
      if(forkTips.e){mkMarker(defs,mId,forkTips.e,color,false);attrs['marker-end']='url(#'+mId+')';}
      g.appendChild(svgEl('path',attrs));
    });
  }

  // 分岐点の丸マーク（ドラッグ可能）
  const fpDot=svgEl('circle',{cx:fp.x,cy:fp.y,r:isSel?7:5,
    fill:'#fff',stroke:color,'stroke-width':isSel?2.5:2,cursor:'move','pointer-events':'all'});
  fpDot.addEventListener('mousedown',ev=>{
    ev.stopPropagation();ev.preventDefault();
    const sp2=svgPt(ev),ox=fp.x,oy=fp.y;
    function onMove(mv){const pt=svgPt(mv);fp.x=ox+(pt.x-sp2.x);fp.y=oy+(pt.y-sp2.y);renderAll();}
    function onUp(){document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);snap();}
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  });
  g.appendChild(fpDot);

  // 選択時: forkPtリセットボタン（×）
  if(isSel){
    const resetDot=svgEl('circle',{cx:fp.x+14,cy:fp.y-14,r:8,
      fill:'#ff4757',stroke:'#fff','stroke-width':1.5,cursor:'pointer','pointer-events':'all'});
    const resetTxt=svgEl('text',{x:fp.x+14,y:fp.y-14,'text-anchor':'middle',
      'dominant-baseline':'middle',fill:'#fff','font-size':'10','pointer-events':'none'});
    resetTxt.textContent='↩';
    resetDot.addEventListener('click',ev=>{
      ev.stopPropagation();fork.forkPt=null;snap();renderAll();
    });
    g.appendChild(resetDot);g.appendChild(resetTxt);
  }

  // ヒット領域
  const hitD=`M${sp.x},${sp.y} L${fp.x},${fp.y}`;
  const hitEl=svgEl('path',{class:'edge-hitbox',d:hitD,fill:'none'});
  hitEl.addEventListener('mousedown',e=>{if(e.button!==0)return;e.stopPropagation();selectItem('fork',fork.id);});
  hitEl.addEventListener('contextmenu',e=>{
    e.stopPropagation();e.preventDefault();
    S.ctxTarget={type:'fork',id:fork.id};
    // フォーク時はbranch/label項目を隠す
    const branch=$('ctx-edge-branch'),label=$('ctx-edge-label');
    if(branch)branch.style.display='none';
    if(label)label.style.display='none';
    showCtx(ctxEdgeM,e.clientX,e.clientY);
  });
  g.appendChild(hitEl);

  g.addEventListener('click',e=>{e.stopPropagation();selectItem('fork',fork.id);});
  layerEdges.appendChild(g);
}

// ===== RENDER ALL =====
function renderAll(){
  layerGroups.innerHTML='';layerEdges.innerHTML='';layerNodes.innerHTML='';
  svg.querySelector('defs').querySelectorAll('clipPath,[id^="arr"],[id^="ph"]').forEach(c=>c.remove());
  for(const g of S.groups)renderGroup(g);
  for(const e of S.edges){
    if(e.type==='elbow')renderElbowEdge(e);
    else renderEdge(e);
  }
  for(const fl of (S.freeLines||[]))renderFreeLine(fl);
  for(const fk of (S.forks||[]))renderFork(fk);
  for(const t of S.texts) renderText(t);
  for(const n of S.nodes) renderNode(n);
  const tx='translate('+S.ox+','+S.oy+') scale('+S.scale+')';
  [layerGroups,layerEdges,layerNodes].forEach(l=>l.setAttribute('transform',tx));
  stNodes.textContent=(t('st_nodes')||'ノード')+': '+S.nodes.length;
  stEdges.textContent=(t('st_edges')||'線')+': '+(S.edges.length+(S.freeLines||[]).length);
  container.style.backgroundColor=S.bgColor;
  const rgb=hexToRgba(S.bgColor,0.45);
  container.style.backgroundImage='radial-gradient(circle,'+rgb+' 1px,transparent 1px)';
  updateConnectBtnPos();
  drawRulers();
  // フォークオーバーレイ更新
  const fo=$('fork-overlay');
  const fc=$('fork-count');
  if(fo&&fc){
    fo.style.display=S.forkMode?'flex':'none';
    const forkLabel=t('fork_count')||'子ノード: 0個選択中';
    fc.textContent=forkLabel.replace('0',S.forkDsts.length);
  }
}
function hexToRgba(hex,a){
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}

// ===== CONNECT BTN: ノード右上角に固定 =====
function showConnectBtn(node){
  S.hoverNodeId=node.id;
  updateConnectBtnPos();
  connectBtn.style.display='block';
}
function updateConnectBtnPos(){
  if(S.hoverNodeId===null){return;}
  const node=S.nodes.find(n=>n.id===S.hoverNodeId);
  if(!node){hideConnectBtn();return;}
  // ノードの右上角（SVG座標）
  const cornerX=node.x+nodeW(node)/2;
  const cornerY=node.y-nodeH(node)/2;
  const sp=screenXY(cornerX,cornerY);
  const r=container.getBoundingClientRect();
  connectBtn.style.left=(sp.x-r.left-6)+'px';
  connectBtn.style.top=(sp.y-r.top-6)+'px';
}
function hideConnectBtn(){S.hoverNodeId=null;connectBtn.style.display='none';}
connectBtn.addEventListener('click',e=>{
  e.stopPropagation();if(S.hoverNodeId===null)return;
  S.edgeSrc=S.hoverNodeId;
  S.pendingType=edgeTypeBar.value;
  S.pendingColor=edgeColorBar.value;
  edgeHint.style.display='block';container.classList.add('mode-edge');hideConnectBtn();renderAll();
});
connectBtn.addEventListener('mouseleave',()=>{hoverTimer=setTimeout(hideConnectBtn,220);});
connectBtn.addEventListener('mouseenter',()=>clearTimeout(hoverTimer));
function cancelEdge(){
  S.edgeSrc=null;S.branchMode=false;S.branchOrigin=null;
  S.forkMode=false;S.forkSrc=null;S.forkDsts=[];
  edgeHint.style.display='none';
  edgeHint.textContent='ノードをクリックして接続 (Escでキャンセル)';
  container.classList.remove('mode-edge');
  // フォーク選択オーバーレイ非表示
  const fo=$('fork-overlay');if(fo)fo.style.display='none';
}

// ===== FORK MODE =====
function startForkMode(srcNodeId){
  S.forkMode=true;
  S.forkSrc=srcNodeId;
  S.forkDsts=[];
  const fo=$('fork-overlay');
  if(fo){fo.style.display='block';}
  edgeHint.textContent='子ノードをクリックして選択 (Enterで確定 / Escでキャンセル)';
  edgeHint.style.display='block';
  container.classList.add('mode-edge');
  renderAll();
}

function confirmFork(){
  if(!S.forkSrc||S.forkDsts.length===0){cancelEdge();return;}
  snap();
  S.forks.push({
    id:S.nextId++,
    srcId:S.forkSrc,
    dsts:[...S.forkDsts],
    forkPt:null,
    color:edgeColorBar.value,
    width:3,
    type:'solid',
  });
  cancelEdge();
  renderAll();
}

// ===== CTX MENUS =====
function showCtx(menu,x,y){
  hideCtx();
  const r=container.getBoundingClientRect();
  menu.style.left=Math.min(x,r.right-185)+'px';
  menu.style.top=Math.min(y,r.bottom-160)+'px';
  menu.style.display='block';
}
function hideCtx(){allCtx.forEach(m=>m.style.display='none');}
document.addEventListener('click',hideCtx);
container.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(S.edgeSrc!==null){cancelEdge();renderAll();return;}
  S.ctxPos=svgPt(e);showCtx(ctxCanvas,e.clientX,e.clientY);
});

function addNode(x,y){
  snap();
  const n={id:S.nextId++,x,y,name:'新しいノード',sub:'',style:'card',
    color:NODE_COLORS[S.nodes.length%NODE_COLORS.length],clip:'roundrect',
    image:null,imgOx:0,imgOy:0,imgScale:100};
  S.nodes.push(n);renderAll();selectItem('node',n.id);
  setTimeout(()=>{nodeNameEl.focus();nodeNameEl.select();},50);
}
function addText(x,y){
  snap();
  const t={id:S.nextId++,x,y,content:'テキスト',size:18,color:'#333333',bold:false,
    font:FONTS[0],border:true,bg:'#ffffff',bgOpacity:0};
  S.texts.push(t);renderAll();selectItem('text',t.id);
  setTimeout(()=>{textContentEl.focus();textContentEl.select();},50);
}
function addGroup(x,y,w,h){
  snap();
  const g={id:S.nextId++,x,y,w:Math.max(60,w),h:Math.max(40,h),
    label:'グループ',color:GROUP_COLORS[S.groups.length%GROUP_COLORS.length],opacity:10,style:'solid'};
  S.groups.push(g);renderAll();selectItem('group',g.id);
}

$('ctx-add-node').addEventListener('click',()=>{hideCtx();addNode(S.ctxPos.x,S.ctxPos.y);});
$('ctx-add-text').addEventListener('click',()=>{hideCtx();addText(S.ctxPos.x,S.ctxPos.y);});
$('ctx-add-group').addEventListener('click',()=>{hideCtx();addGroup(S.ctxPos.x-80,S.ctxPos.y-50,160,100);});
$('ctx-draw-edge').addEventListener('click',()=>{
  hideCtx();if(!S.ctxTarget)return;
  S.edgeSrc=S.ctxTarget.id;
  S.pendingType=edgeTypeBar.value;
  S.pendingColor=edgeColorBar.value;
  edgeHint.textContent=t('edge_hint')||'ノードをクリックして接続　Escでキャンセル';
  edgeHint.style.display='block';container.classList.add('mode-edge');renderAll();
});
$('ctx-fork-connect')?.addEventListener('click',()=>{
  hideCtx();if(!S.ctxTarget)return;
  startForkMode(S.ctxTarget.id);
});
$('ctx-node-image').addEventListener('click',async()=>{
  hideCtx();const n=S.nodes.find(n=>n.id===S.ctxTarget?.id);if(!n)return;
  const d=await window.api.openImage();if(d)openTrimDialog(d,n.id,null);
});
$('ctx-node-delete').addEventListener('click',()=>{hideCtx();deleteById('node',S.ctxTarget?.id);});
$('ctx-text-delete').addEventListener('click',()=>{hideCtx();deleteById('text',S.ctxTarget?.id);});
$('ctx-group-delete').addEventListener('click',()=>{hideCtx();deleteById('group',S.ctxTarget?.id);});
$('ctx-edge-label').addEventListener('click',()=>{hideCtx();selectItem(S.ctxTarget?.type||'edge',S.ctxTarget?.id);setTimeout(()=>{edgeLabelEl.focus();edgeLabelEl.select();},50);});
$('ctx-edge-branch')?.addEventListener('click',()=>{
  hideCtx();
  const bp=S.ctxTarget?.branchPt;
  if(!bp)return;
  // クリック点を起点にフリー線接続モードへ
  // branchPtをフリー線の始点として保存、接続先ノードをクリックで線を引く
  S.branchOrigin=bp;
  S.edgeSrc=null; // ノード接続モードではなくフリー線モード
  edgeHint.textContent='ノードをクリックして接続 (Escでキャンセル)';
  edgeHint.style.display='block';
  container.classList.add('mode-edge');
  S.branchMode=true;
  renderAll();
});
$('ctx-edge-delete').addEventListener('click',()=>{hideCtx();deleteById(S.ctxTarget?.type||'edge',S.ctxTarget?.id);});

function deleteById(type,id){
  if(!id)return;snap();
  if(type==='node'){S.edges=S.edges.filter(e=>e.src!==id&&e.dst!==id);S.nodes=S.nodes.filter(n=>n.id!==id);}
  if(type==='text')S.texts=S.texts.filter(t=>t.id!==id);
  if(type==='group')S.groups=S.groups.filter(g=>g.id!==id);
  if(type==='edge')S.edges=S.edges.filter(e=>e.id!==id);
  if(type==='freeline')S.freeLines=(S.freeLines||[]).filter(f=>f.id!==id);
  if(type==='fork')S.forks=(S.forks||[]).filter(f=>f.id!==id);
  clearSel();
}

// ===== SELECTION =====
function selectItem(type,id){
  S.sel={type,id};
  [panelNode,panelText,panelGroup,panelEdge].forEach(p=>p.style.display='none');
  if(type==='node'){
    const n=selNode();if(!n)return;panelNode.style.display='block';
    nodeNameEl.value=n.name||'';nodeSubEl.value=n.sub||'';
    nodeClipEl.value=n.clip||'roundrect';nodeColorEl.value=n.color||'#667eea';
    nodeStyleEl.value=n.style||'card';updateNodeStyleUI(n);
    if($('node-kinship'))$('node-kinship').value=n.kinship||'';
    if($('node-other'))$('node-other').value=n.other||'';
    if($('node-birth'))$('node-birth').value=n.birth||'';
    if($('node-death'))$('node-death').value=n.death||'';
    if($('node-family-font'))$('node-family-font').value=n.familyFont||'Yu Mincho,Georgia,serif';
    const fsv=n.nameFontSize||0;
    if(nodeNameSizeEl){nodeNameSizeEl.value=fsv;nodeNameSizeVal.textContent=fsv>0?String(fsv):'自動';}
    if(nodeNameColorEl)nodeNameColorEl.value=n.nameColor||(n.style==='circle'?'#ffffff':'#222222');
    if(nodeSubColorEl)nodeSubColorEl.value=n.subColor||n.color||'#667eea';
    if(n.image){imgAdjust.style.display='block';imgOxEl.value=n.imgOx||0;imgOyEl.value=n.imgOy||0;imgScaleEl.value=n.imgScale||100;}
    else imgAdjust.style.display='none';
  } else if(type==='text'){
    const t=selText();if(!t)return;panelText.style.display='block';
    textContentEl.value=t.content||'';textSizeEl.value=t.size||18;textSizeVal.textContent=t.size||18;
    textColorEl.value=t.color||'#333333';textBoldEl.checked=t.bold||false;
    textFontEl.value=t.font||FONTS[0];textBorderEl.checked=t.border!==false;
    if($('text-vertical'))$('text-vertical').checked=!!t.vertical;
    const tbc=$('text-border-color');if(tbc)tbc.value=t.borderColor||t.color||'#667eea';
    const tbs=$('text-border-shape');if(tbs)tbs.value=t.borderShape||'roundrect';
    textBgEl.value=t.bg||'#ffffff';textBgOpacityEl.value=t.bgOpacity||0;
    textBgOpacityVal.textContent=(t.bgOpacity||0)+'%';
  } else if(type==='group'){
    const g=selGroup();if(!g)return;panelGroup.style.display='block';
    groupLabelEl.value=g.label||'';groupColorEl.value=g.color||'#667eea';
    const gsc=$('group-stroke-color');if(gsc)gsc.value=g.strokeColor||g.color||'#667eea';
    const gsh=$('group-shape');if(gsh)gsh.value=g.shape||'roundrect';
    groupOpacityEl.value=g.opacity||10;groupOpacityVal.textContent=(g.opacity||10)+'%';
    groupStyleEl.value=g.style||'solid';
  } else if(type==='fork'){
    const fk=(S.forks||[]).find(f=>f.id===S.sel.id);if(!fk)return;
    panelEdge.style.display='block';
    edgeLabelEl.value='';
    edgeTypePanelEl.value=fk.type||'solid';
    edgeWidthEl.value=fk.width||3;edgeWidthVal.textContent=fk.width||3;
    edgeColorPanelEl.value=fk.color||'#ff6b9d';
    edgeLabelShapeEl.value='pill';
    edgeLabelAngleEl.value=0;edgeLabelAngleVal.textContent='0°';
  } else if(type==='freeline'){
    const fl=S.freeLines.find(f=>f.id===S.sel.id);if(!fl)return;
    panelEdge.style.display='block';
    edgeLabelEl.value=fl.label||'';
    edgeLabelSizeEl.value=fl.labelSize||11;edgeLabelSizeVal.textContent=fl.labelSize||11;
    edgeLabelColorEl.value=fl.labelColor||fl.color||'#ff6b9d';
    edgeTypePanelEl.value=fl.type||'solid';
    edgeWidthEl.value=fl.width||2;edgeWidthVal.textContent=fl.width||2;
    edgeColorPanelEl.value=fl.color||'#ff6b9d';
    edgeLabelShapeEl.value=fl.labelShape||'pill';
    edgeLabelAngleEl.value=fl.labelAngle||0;edgeLabelAngleVal.textContent=(fl.labelAngle||0)+'°';
    updateEdgeExtraControls(fl);
  } else if(type==='edge'){
    const e=selEdge();if(!e)return;panelEdge.style.display='block';
    edgeLabelEl.value=e.label||'';edgeLabelSizeEl.value=e.labelSize||11;edgeLabelSizeVal.textContent=e.labelSize||11;
    edgeLabelColorEl.value=e.labelColor||e.color||'#ff6b9d';
    edgeTypePanelEl.value=e.type||'solid';edgeWidthEl.value=e.width||3;edgeWidthVal.textContent=e.width||3;
    edgeColorPanelEl.value=e.color||'#ff6b9d';
    edgeLabelShapeEl.value=e.labelShape||'pill';
    edgeLabelAngleEl.value=e.labelAngle||0;edgeLabelAngleVal.textContent=(e.labelAngle||0)+'°';
    updateEdgeExtraControls(e);
  }
  renderAll();
}
function updateNodeStyleUI(n){
  const sty=n.style||'card';
  const showClip=sty==='card'||sty==='compact';
  const isFam=sty==='family-v'||sty==='family-h';
  const rowClip=$('row-node-clip'),rowFill=$('row-node-fillcolor');
  if(rowClip)rowClip.style.display=(!isFam&&showClip)?'':'none';
  if(rowFill)rowFill.style.display=(!isFam&&!showClip&&sty!=='circle')?'':'none';
  const rowFam=$('row-family-fields');
  if(rowFam)rowFam.style.display=isFam?'block':'none';
  const rowSub=$('row-node-sub');
  if(rowSub)rowSub.style.display=isFam?'none':'block';
  const rowNorm=$('row-normal-fields');
  if(rowNorm)rowNorm.style.display=isFam?'none':'block';
}
function clearSel(){
  S.sel={type:null,id:null};
  [panelNode,panelText,panelGroup,panelEdge].forEach(p=>p.style.display='none');
  renderAll();
}

// ===== CANVAS MOUSE =====
container.addEventListener('click',e=>{
  if(e.target!==container&&e.target!==svg)return;
  const pt=svgPt(e);
  // ノード・テキストは右クリックメニューから追加（ツールボタン廃止）
  // if(S.tool==='node'){addNode(pt.x,pt.y);return;}
  // if(S.tool==='text'){addText(pt.x,pt.y);return;}
  if(S.edgeSrc!==null){cancelEdge();renderAll();return;}
  clearSel();
});
container.addEventListener('mousedown',e=>{
  if(e.button===1||(e.button===0&&spaceDown)){
    e.preventDefault();S.pan={sx:e.clientX,sy:e.clientY,ox:S.ox,oy:S.oy};return;
  }
  if(e.button!==0)return;
  if(S.tool==='group'&&(e.target===container||e.target===svg)){
    const pt=svgPt(e);S.groupDraw={startX:pt.x,startY:pt.y,x:pt.x,y:pt.y,w:0,h:0};
    groupPreview.style.display='block';
  }
});
container.addEventListener('mousemove',e=>{
  if(S.drag){
    const pt=svgPt(e);
    const obj=S.drag.type==='node'?S.nodes.find(n=>n.id===S.drag.id):
               S.drag.type==='text'?S.texts.find(t=>t.id===S.drag.id):
               S.drag.type==='group'?S.groups.find(g=>g.id===S.drag.id):null;
    if(obj){
      obj.x=S.drag.origX+(pt.x-S.drag.startX);
      obj.y=S.drag.origY+(pt.y-S.drag.startY);
      S.drag.moved=true;renderAll();
      if(S.drag.type==='node'){
        hideSnapLines();
        const W=nodeW(obj),H=nodeH(obj);
        for(const sl of getSnapLines(obj.id)){
          const checks=sl.type==='h'?[obj.y-H/2,obj.y,obj.y+H/2]:[obj.x-W/2,obj.x,obj.x+W/2];
          for(const c of checks){
            if(Math.abs((c-sl.world)*S.scale)<SNAP_THRESH){
              showSnapLine(sl.type,sl.type==='h'?sl.world*S.scale+S.oy:sl.world*S.scale+S.ox);
              break;
            }
          }
        }
      }
    }
  }
  if(S.pan){S.ox=S.pan.ox+(e.clientX-S.pan.sx);S.oy=S.pan.oy+(e.clientY-S.pan.sy);renderAll();}
  if(S.groupDraw){
    const pt=svgPt(e);
    const x=Math.min(pt.x,S.groupDraw.startX),y=Math.min(pt.y,S.groupDraw.startY);
    const w=Math.abs(pt.x-S.groupDraw.startX),h=Math.abs(pt.y-S.groupDraw.startY);
    groupPreview.style.left=(x*S.scale+S.ox)+'px';groupPreview.style.top=(y*S.scale+S.oy)+'px';
    groupPreview.style.width=(w*S.scale)+'px';groupPreview.style.height=(h*S.scale)+'px';
    S.groupDraw.x=x;S.groupDraw.y=y;S.groupDraw.w=w;S.groupDraw.h=h;
  }
});
container.addEventListener('mouseup',e=>{
  if(S.drag&&S.drag.moved)snap();S.drag=null;S.pan=null;hideSnapLines();
  if(S.groupDraw){const gd=S.groupDraw;S.groupDraw=null;groupPreview.style.display='none';if(gd.w>20&&gd.h>20)addGroup(gd.x,gd.y,gd.w,gd.h);}
});
container.addEventListener('mouseleave',()=>{S.drag=null;S.pan=null;hideSnapLines();});
container.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=container.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;
  // deltaYの大きさに応じてズーム量を調整（カクカク軽減）
  const delta=e.deltaY;
  const f=delta>0?Math.max(0.85,1-Math.abs(delta)/800):Math.min(1.15,1+Math.abs(delta)/800);
  S.ox=mx-(mx-S.ox)*f;S.oy=my-(my-S.oy)*f;S.scale=Math.min(4,Math.max(0.15,S.scale*f));renderAll();
},{passive:false});

// ===== TRIM DIALOG =====
const trimOverlay=$('trim-overlay'),trimCanvas=$('trim-canvas'),trimPreview=$('trim-preview');
const trimOkBtn=$('trim-ok'),trimCancelBtn=$('trim-cancel');
const T={nodeId:null,dropPos:null,img:null,scale:1,cw:0,ch:0,x:0,y:0,w:0,h:0,op:null,ox:0,oy:0,bx:0,by:0,bw:0,bh:0,MIN:30};
function trimDraw(){
  if(!T.img)return;const ctx=trimCanvas.getContext('2d');
  ctx.clearRect(0,0,T.cw,T.ch);ctx.drawImage(T.img,0,0,T.cw,T.ch);
  ctx.fillStyle='rgba(0,0,0,0.45)';ctx.fillRect(0,0,T.cw,T.ch);
  ctx.clearRect(T.x,T.y,T.w,T.h);
  ctx.drawImage(T.img,T.x/T.scale,T.y/T.scale,T.w/T.scale,T.h/T.scale,T.x,T.y,T.w,T.h);
  ctx.strokeStyle='#667eea';ctx.lineWidth=2;ctx.setLineDash([]);ctx.strokeRect(T.x,T.y,T.w,T.h);
  ctx.strokeStyle='rgba(102,126,234,0.4)';ctx.lineWidth=1;ctx.setLineDash([4,4]);
  for(let i=1;i<=2;i++){ctx.beginPath();ctx.moveTo(T.x+T.w*i/3,T.y);ctx.lineTo(T.x+T.w*i/3,T.y+T.h);ctx.stroke();
    ctx.beginPath();ctx.moveTo(T.x,T.y+T.h*i/3);ctx.lineTo(T.x+T.w,T.y+T.h*i/3);ctx.stroke();}
  ctx.setLineDash([]);
  trimHandles().forEach(h=>{ctx.fillStyle='#fff';ctx.strokeStyle='#667eea';ctx.lineWidth=2;ctx.beginPath();ctx.arc(h.x,h.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();});
  trimUpdatePreview();
}
function trimHandles(){const{x,y,w,h}=T;return[{id:'nw',x,y},{id:'n',x:x+w/2,y},{id:'ne',x:x+w,y},{id:'e',x:x+w,y:y+h/2},{id:'se',x:x+w,y:y+h},{id:'s',x:x+w/2,y:y+h},{id:'sw',x,y:y+h},{id:'w',x,y:y+h/2}];}
function trimHitHandle(mx,my){const hs=12;for(const h of trimHandles())if(Math.abs(mx-h.x)<=hs&&Math.abs(my-h.y)<=hs)return h.id;return null;}
const CURSOR_MAP={nw:'nw-resize',ne:'ne-resize',sw:'sw-resize',se:'se-resize',n:'n-resize',s:'s-resize',e:'e-resize',w:'w-resize'};
function trimCanvasPt(e){const r=trimCanvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
trimCanvas.addEventListener('mousemove',e=>{
  if(T.op)return;const{x:mx,y:my}=trimCanvasPt(e);const h=trimHitHandle(mx,my);
  trimCanvas.style.cursor=h?CURSOR_MAP[h]:(mx>=T.x&&mx<=T.x+T.w&&my>=T.y&&my<=T.y+T.h)?'move':'default';
});
trimCanvas.addEventListener('mousedown',e=>{
  e.preventDefault();const{x:mx,y:my}=trimCanvasPt(e);const h=trimHitHandle(mx,my);
  T.ox=mx;T.oy=my;T.bx=T.x;T.by=T.y;T.bw=T.w;T.bh=T.h;
  if(h){T.op=h;return;}if(mx>=T.x&&mx<=T.x+T.w&&my>=T.y&&my<=T.y+T.h)T.op='move';
});
document.addEventListener('mousemove',e=>{
  if(!T.op)return;const{x:mx,y:my}=trimCanvasPt(e);const dx=mx-T.ox,dy=my-T.oy;
  const MIN=T.MIN,cw=T.cw,ch=T.ch;let{bx,by,bw,bh}=T;
  if(T.op==='move'){T.x=Math.max(0,Math.min(cw-bw,bx+dx));T.y=Math.max(0,Math.min(ch-bh,by+dy));}
  else{
    let nx=bx,ny=by,nw=bw,nh=bh;
    if(T.op.includes('e')){nw=Math.max(MIN,Math.min(cw-nx,bw+dx));}
    if(T.op.includes('s')){nh=Math.max(MIN,Math.min(ch-ny,bh+dy));}
    if(T.op.includes('w')){const r2=bx+bw;nx=Math.min(r2-MIN,Math.max(0,bx+dx));nw=r2-nx;}
    if(T.op.includes('n')){const b2=by+bh;ny=Math.min(b2-MIN,Math.max(0,by+dy));nh=b2-ny;}
    T.x=nx;T.y=ny;T.w=nw;T.h=nh;
  }
  trimDraw();
});
document.addEventListener('mouseup',()=>{T.op=null;});
function trimUpdatePreview(){
  if(!T.img||T.w<=0||T.h<=0)return;
  const ctx=trimPreview.getContext('2d');trimPreview.width=NODE_W*2;trimPreview.height=IMG_H*2;
  ctx.drawImage(T.img,T.x/T.scale,T.y/T.scale,T.w/T.scale,T.h/T.scale,0,0,NODE_W*2,IMG_H*2);
}
function openTrimDialog(dataUrl,nodeId,dropPos){
  T.nodeId=nodeId;T.dropPos=dropPos;
  const img=new Image();
  img.onload=()=>{
    T.img=img;
    const maxW=560,maxH=420,ratio=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1);
    T.cw=Math.round(img.naturalWidth*ratio);T.ch=Math.round(img.naturalHeight*ratio);T.scale=ratio;
    trimCanvas.width=T.cw;trimCanvas.height=T.ch;
    const ar=NODE_W/IMG_H;let sw,sh;
    if(T.cw/T.ch>ar){sh=T.ch;sw=Math.round(sh*ar);}else{sw=T.cw;sh=Math.round(sw/ar);}
    T.x=Math.round((T.cw-sw)/2);T.y=Math.round((T.ch-sh)/2);T.w=sw;T.h=sh;
    trimDraw();trimOverlay.classList.add('active');
  };
  img.src=dataUrl;
}
trimOkBtn.addEventListener('click',()=>{
  if(!T.img||T.w<=0||T.h<=0)return;
  const out=document.createElement('canvas');out.width=NODE_W*2;out.height=IMG_H*2;
  out.getContext('2d').drawImage(T.img,T.x/T.scale,T.y/T.scale,T.w/T.scale,T.h/T.scale,0,0,NODE_W*2,IMG_H*2);
  const cropped=out.toDataURL('image/jpeg',0.93);
  trimOverlay.classList.remove('active');snap();
  if(T.nodeId!==null){
    const n=S.nodes.find(n=>n.id===T.nodeId);
    if(n){
      n.image=cropped;n.imgOx=0;n.imgOy=0;n.imgScale=100;
      // 丸ノード: 画像あり時は高さ＝円直径＋名前行＋サブ行（重なり防止）
      if((n.style||'card')==='circle'){
        const W=nodeW(n);
        const nameFs=n.nameFontSize&&n.nameFontSize>0?n.nameFontSize:Math.round(W/7);
        const subFs=Math.max(8,Math.round(nameFs*0.75));
        n.h=W+nameFs*2+(n.sub?(subFs+4):0)+8;
      }
      renderAll();selectItem('node',n.id);
    }
  } else if(T.dropPos){
    const n={id:S.nextId++,x:T.dropPos.x,y:T.dropPos.y,name:'新しいノード',sub:'',style:'card',
      color:NODE_COLORS[S.nodes.length%NODE_COLORS.length],clip:'roundrect',image:cropped,imgOx:0,imgOy:0,imgScale:100};
    S.nodes.push(n);renderAll();selectItem('node',n.id);
    setTimeout(()=>{nodeNameEl.focus();nodeNameEl.select();},50);
  }
});
trimCancelBtn.addEventListener('click',()=>{trimOverlay.classList.remove('active');});

// ===== DRAG & DROP =====
container.addEventListener('dragover',e=>{
  e.preventDefault();dropOverlay.classList.add('active');
  const pt=svgPt(e);S.dropNodeId=null;
  for(const n of S.nodes){if(Math.abs(pt.x-n.x)<nodeW(n)/2&&Math.abs(pt.y-n.y)<nodeH(n)/2){S.dropNodeId=n.id;break;}}
  dropOverlay.textContent=S.dropNodeId?'📌 このノードに設定':'新しいノードとして追加';
});
container.addEventListener('dragleave',()=>dropOverlay.classList.remove('active'));
container.addEventListener('drop',e=>{
  e.preventDefault();dropOverlay.classList.remove('active');
  const file=e.dataTransfer.files[0];if(!file||!file.type.startsWith('image/'))return;
  const pt=svgPt(e);
  const reader=new FileReader();
  reader.onload=ev=>openTrimDialog(ev.target.result,S.dropNodeId||null,S.dropNodeId?null:pt);
  reader.readAsDataURL(file);
});

// ===== KEYBOARD =====
let spaceDown=false;
document.addEventListener('keydown',e=>{
  if(e.key===' '&&!spaceDown){
    if(e.target.tagName!=='INPUT'&&e.target.tagName!=='TEXTAREA'){
      spaceDown=true;container.classList.add('tool-pan');e.preventDefault();return;
    }
  }
  if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA')return;
  if(e.key==='Escape'){if(S.forkMode){cancelEdge();renderAll();}else if(S.edgeSrc!==null){cancelEdge();renderAll();}else clearSel();}
  if(e.key==='Enter'&&S.forkMode){confirmFork();}
  if(e.key==='Delete'||e.key==='Backspace'){if(S.sel.id)deleteById(S.sel.type,S.sel.id);}
  if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo();}
  if(e.key==='v'||e.key==='V')setTool('select');
  if(e.key==='n'||e.key==='N')setTool('node');
  if(e.key==='t'||e.key==='T')setTool('text');
  if(e.key==='g'||e.key==='G')setTool('group');
});
document.addEventListener('keyup',e=>{
  if(e.key===' '){spaceDown=false;container.classList.remove('tool-pan');}
});

// ===== SIDE PANEL EVENTS =====
nodeNameEl.addEventListener('input',()=>{const n=selNode();if(n){n.name=nodeNameEl.value;renderAll();}});
nodeSubEl.addEventListener('input', ()=>{
  const n=selNode();if(!n)return;
  n.sub=nodeSubEl.value;
  if(n.image&&(n.style||'card')==='circle'){
    const W=nodeW(n);
    const nameFs=n.nameFontSize&&n.nameFontSize>0?n.nameFontSize:Math.round(W/7);
    const subFs=Math.max(8,Math.round(nameFs*0.75));
    n.h=W+nameFs*2+(n.sub?(subFs+4):0)+8;
  }
  renderAll();
});
nodeClipEl.addEventListener('change',()=>{const n=selNode();if(n){snap();n.clip=nodeClipEl.value;renderAll();}});
nodeColorEl.addEventListener('input',()=>{const n=selNode();if(n){n.color=nodeColorEl.value;renderAll();}});
nodeNameColorEl?.addEventListener('input',()=>{const n=selNode();if(n){n.nameColor=nodeNameColorEl.value;renderAll();}});
nodeSubColorEl?.addEventListener('input',()=>{const n=selNode();if(n){n.subColor=nodeSubColorEl.value;renderAll();}});
nodeNameSizeEl?.addEventListener('input',()=>{
  const n=selNode();if(!n)return;
  const v=+nodeNameSizeEl.value;
  n.nameFontSize=v>0?v:0;
  nodeNameSizeVal.textContent=v>0?String(v):'自動';
  // 丸ノードで画像ありの場合はnode.hを再計算
  if(n.image&&(n.style||'card')==='circle'){
    const W=nodeW(n);
    const nameFs=n.nameFontSize>0?n.nameFontSize:Math.round(W/7);
    const subFs=Math.max(8,Math.round(nameFs*0.75));
    n.h=W+nameFs*2+(n.sub?(subFs+4):0)+8;
  }
  renderAll();
});
nodeStyleEl.addEventListener('change',()=>{
  const n=selNode();if(!n)return;snap();n.style=nodeStyleEl.value;delete n.w;delete n.h;updateNodeStyleUI(n);renderAll();
});
$('node-kinship')?.addEventListener('input',()=>{const n=selNode();if(n){n.kinship=$('node-kinship').value;renderAll();}});
$('node-other')?.addEventListener('input',()=>{const n=selNode();if(n){n.other=$('node-other').value;renderAll();}});
$('node-birth')?.addEventListener('input',()=>{const n=selNode();if(n){n.birth=$('node-birth').value;renderAll();}});
$('node-death')?.addEventListener('input',()=>{const n=selNode();if(n){n.death=$('node-death').value;renderAll();}});
$('node-family-font')?.addEventListener('change',()=>{const n=selNode();if(n){n.familyFont=$('node-family-font').value;renderAll();}});
$('text-vertical')?.addEventListener('change',()=>{const t=selText();if(t){t.vertical=$('text-vertical').checked;renderAll();}});
$('node-fill-color')?.addEventListener('input',e=>{const n=selNode();if(n){n.fillColor=e.target.value;renderAll();}});
btnImgSet.addEventListener('click',async()=>{const n=selNode();if(!n)return;const d=await window.api.openImage();if(d)openTrimDialog(d,n.id,null);});
btnImgClear.addEventListener('click',()=>{
  const n=selNode();if(n){
    snap();n.image=null;
    if((n.style||'card')==='circle'){delete n.h;}
    imgAdjust.style.display='none';renderAll();
  }
});
btnNodeDel.addEventListener('click',()=>deleteById('node',S.sel.id));
imgOxEl.addEventListener('input',   ()=>{const n=selNode();if(n){n.imgOx=+imgOxEl.value;renderAll();}});
imgOyEl.addEventListener('input',   ()=>{const n=selNode();if(n){n.imgOy=+imgOyEl.value;renderAll();}});
imgScaleEl.addEventListener('input',()=>{const n=selNode();if(n){n.imgScale=+imgScaleEl.value;renderAll();}});
btnImgReset.addEventListener('click',()=>{const n=selNode();if(!n)return;n.imgOx=0;n.imgOy=0;n.imgScale=100;imgOxEl.value=0;imgOyEl.value=0;imgScaleEl.value=100;renderAll();});

textContentEl.addEventListener('input',()=>{const t=selText();if(t){t.content=textContentEl.value;renderAll();}});
textSizeEl.addEventListener('input',()=>{const t=selText();if(t){t.size=+textSizeEl.value;textSizeVal.textContent=t.size;renderAll();}});
textColorEl.addEventListener('input',()=>{const t=selText();if(t){t.color=textColorEl.value;renderAll();}});
textBoldEl.addEventListener('change',()=>{const t=selText();if(t){t.bold=textBoldEl.checked;renderAll();}});
textFontEl.addEventListener('change',()=>{const t=selText();if(t){t.font=textFontEl.value;renderAll();}});
textBorderEl.addEventListener('change',()=>{const t=selText();if(t){t.border=textBorderEl.checked;renderAll();}});
$('text-border-color')?.addEventListener('input',e=>{const t=selText();if(t){t.borderColor=e.target.value;renderAll();}});
$('text-border-shape')?.addEventListener('change',e=>{const t=selText();if(t){snap();t.borderShape=e.target.value;renderAll();}});
textBgEl.addEventListener('input',()=>{const t=selText();if(t){t.bg=textBgEl.value;renderAll();}});
textBgOpacityEl.addEventListener('input',()=>{const t=selText();if(t){t.bgOpacity=+textBgOpacityEl.value;textBgOpacityVal.textContent=t.bgOpacity+'%';renderAll();}});
btnTextDel.addEventListener('click',()=>deleteById('text',S.sel.id));

groupLabelEl.addEventListener('input',()=>{const g=selGroup();if(g){g.label=groupLabelEl.value;renderAll();}});
groupColorEl.addEventListener('input',()=>{const g=selGroup();if(g){g.color=groupColorEl.value;renderAll();}});
$('group-stroke-color')?.addEventListener('input',e=>{const g=selGroup();if(g){g.strokeColor=e.target.value;renderAll();}});
$('group-shape')?.addEventListener('change',e=>{const g=selGroup();if(g){snap();g.shape=e.target.value;renderAll();}});
groupOpacityEl.addEventListener('input',()=>{const g=selGroup();if(g){g.opacity=+groupOpacityEl.value;groupOpacityVal.textContent=g.opacity+'%';renderAll();}});
groupStyleEl.addEventListener('change',()=>{const g=selGroup();if(g){snap();g.style=groupStyleEl.value;renderAll();}});
btnGroupDel.addEventListener('click',()=>deleteById('group',S.sel.id));

edgeLabelEl.addEventListener('input',()=>{const e=selEdge();if(e){e.label=edgeLabelEl.value;renderAll();}});
edgeLabelSizeEl.addEventListener('input',()=>{const e=selEdge();if(e){e.labelSize=+edgeLabelSizeEl.value;edgeLabelSizeVal.textContent=e.labelSize;renderAll();}});
edgeLabelColorEl.addEventListener('input',()=>{const e=selEdge();if(e){e.labelColor=edgeLabelColorEl.value;renderAll();}});
edgeTypePanelEl.addEventListener('change',()=>{
  const fk=(S.forks||[]).find(f=>f.id===S.sel.id);
  if(fk){snap();fk.type=edgeTypePanelEl.value;renderAll();return;}
  const e=selEdge();if(!e)return;
  snap();e.type=edgeTypePanelEl.value;
  // edgeTypeBa rへの逆同期は行わない（ツールバーは新規エッジのデフォルト専用）
  updateEdgeExtraControls(e);renderAll();
});
// ツールバー線種は新規エッジのデフォルトのみ。選択中エッジは変更しない。
edgeTypeBar.addEventListener('change',()=>{ /* 新規エッジ生成時に使用 */ });
edgeWidthEl.addEventListener('input',()=>{
  const fk=(S.forks||[]).find(f=>f.id===S.sel.id);
  if(fk){fk.width=+edgeWidthEl.value;edgeWidthVal.textContent=fk.width;renderAll();return;}
  const e=selEdge();if(e){e.width=+edgeWidthEl.value;edgeWidthVal.textContent=e.width;renderAll();}
});
edgeColorPanelEl.addEventListener('input',()=>{
  const fk=(S.forks||[]).find(f=>f.id===S.sel.id);
  if(fk){fk.color=edgeColorPanelEl.value;renderAll();return;}
  const e=selEdge();if(e){e.color=edgeColorPanelEl.value;renderAll();}
});
edgeLabelShapeEl.addEventListener('change',()=>{const e=selEdge();if(e){snap();e.labelShape=edgeLabelShapeEl.value;renderAll();}});
edgeLabelAngleEl.addEventListener('input',()=>{const e=selEdge();if(e){e.labelAngle=+edgeLabelAngleEl.value;edgeLabelAngleVal.textContent=e.labelAngle+'°';renderAll();}});
btnEdgeDel.addEventListener('click',()=>deleteById('edge',S.sel.id));

function updateEdgeExtraControls(e){
  let extra=$('edge-extra-controls');
  if(!extra){
    extra=document.createElement('div');extra.id='edge-extra-controls';
    const ref=btnEdgeDel.parentNode;panelEdge.insertBefore(extra,btnEdgeDel);
  }
  extra.innerHTML='';
  // エルボー線の場合はリセットボタン表示（1回だけ）
  if(e.type==='elbow'){
    const resetBtn=document.createElement('button');
    resetBtn.textContent='↩ 直角をリセット';
    resetBtn.style.cssText='width:100%;padding:5px;margin-bottom:6px;background:#1a1a2e;border:1px solid #0f3460;border-radius:6px;color:#a78bfa;cursor:pointer;font-size:11px;';
    resetBtn.addEventListener('click',()=>{snap();e.waypoints=[];renderAll();});
    extra.appendChild(resetBtn);
  }
}

bgColorEl.addEventListener('input',()=>{S.bgColor=bgColorEl.value;renderAll();});
$('btn-undo').addEventListener('click',undo);
if(window.api?.onMenuEvent){
  window.api.onMenuEvent('menu-undo',undo);
  window.api.onMenuEvent('menu-new', ()=>newProject());
  window.api.onMenuEvent('menu-save',()=>saveProject());
  window.api.onMenuEvent('menu-open',()=>openProject());
  window.api.onMenuEvent('menu-export-png',()=>$('btn-png').click());
  window.api.onMenuEvent('menu-export-svg',()=>$('btn-svg').click());
}


// ===== PROJECT SAVE / LOAD =====
let currentFilePath = null;
let isDirty = false;

function markDirty(){
  isDirty = true;
  updateTitle();
}
function markClean(fp){
  isDirty = false;
  currentFilePath = fp || currentFilePath;
  updateTitle();
}
function updateTitle(){
  const name = currentFilePath
    ? currentFilePath.split(/[\\/]/).pop()
    : '無題';
  document.title = (isDirty ? '● ' : '') + name + ' — RelationGraph';
}

function projectToJson(){
  return JSON.stringify({
    version: '1.0.0',
    nodes: S.nodes, edges: S.edges, texts: S.texts,
    groups: S.groups, freeLines: S.freeLines||[], forks: S.forks||[],
    nextId: S.nextId, bgColor: S.bgColor,
    ox: S.ox, oy: S.oy, scale: S.scale,
  }, null, 2);
}

function loadFromJson(json){
  try {
    const d = JSON.parse(json);
    S.nodes      = d.nodes      || [];
    S.edges      = d.edges      || [];
    S.texts      = d.texts      || [];
    S.groups     = d.groups     || [];
    S.freeLines  = d.freeLines  || [];
    S.forks      = d.forks      || [];
    S.nextId     = d.nextId     || 1;
    S.bgColor    = d.bgColor    || '#f0f4ff';
    S.ox         = d.ox         || 0;
    S.oy         = d.oy         || 0;
    S.scale      = d.scale      || 1;
    bgColorEl.value = S.bgColor;
    S.history = [];
    clearSel();
    return true;
  } catch(e) {
    stMsg.textContent = t('msg_load_error')||'読み込みに失敗しました';
    setTimeout(() => stMsg.textContent = '', 3000);
    return false;
  }
}

async function saveProject(){
  const json = projectToJson();
  const fp = await window.api.saveProject(json);
  if(fp){ markClean(fp); stMsg.textContent = t('msg_saved')||'保存しました'; setTimeout(() => stMsg.textContent = '', 3000); }
}

async function openProject(){
  if(isDirty){
    // 変更があれば確認（Electronのconfirmは使えないのでstMsgで代用）
    stMsg.textContent = t('confirm_open')||'未保存の変更があります。先に保存してください（Ctrl+S）';
    setTimeout(() => stMsg.textContent = '', 4000);
    // 続行する場合は再度openを呼ぶ必要があるが、ここでは許可して続行
  }
  const json = await window.api.openProject();
  if(json && loadFromJson(json)){
    markClean(null);
    stMsg.textContent = t('msg_saved')||'開きました'; setTimeout(() => stMsg.textContent = '', 3000);
  }
}

function newProject(){
  S.nodes=[]; S.edges=[]; S.texts=[]; S.groups=[]; S.freeLines=[]; S.forks=[];
  S.nextId=1; S.bgColor='#f0f4ff'; S.ox=0; S.oy=0; S.scale=1;
  bgColorEl.value='#f0f4ff';
  S.history=[];
  currentFilePath=null; isDirty=false;
  clearSel();
  updateTitle();
}

// snap は上部で定義済み（markDirtyはrenderAll内で呼ぶ）

// ===== EXPORT =====
function buildExport(){
  const all=[
    ...S.nodes.map(n=>({x:n.x-nodeW(n)/2,y:n.y-nodeH(n)/2,r:n.x+nodeW(n)/2,b:n.y+nodeH(n)/2})),
    ...S.texts.map(t=>({x:t.x,y:t.y,r:t.x+200,b:t.y+80})),
    ...S.groups.map(g=>({x:g.x,y:g.y,r:g.x+g.w,b:g.y+g.h}))
  ];
  if(!all.length)return null;
  const pad=40;
  const minX=Math.min(...all.map(a=>a.x))-pad, minY=Math.min(...all.map(a=>a.y))-pad;
  const maxX=Math.max(...all.map(a=>a.r))+pad, maxY=Math.max(...all.map(a=>a.b))+pad;
  const w=maxX-minX, h=maxY-minY;
  const clone=svg.cloneNode(true);
  clone.setAttribute('width',w);clone.setAttribute('height',h);clone.setAttribute('viewBox',minX+' '+minY+' '+w+' '+h);
  ['#layer-groups','#layer-edges','#layer-nodes'].forEach(id=>clone.querySelector(id)?.removeAttribute('transform'));
  // 書き出し時: 接続ボタン・ヒントも除外（SVGには含まれないのでOK）
  const bg=svgEl('rect',{x:minX,y:minY,width:w,height:h,fill:S.bgColor});
  clone.insertBefore(bg,clone.firstChild);
  return{clone,w,h};
}
$('btn-png').addEventListener('click',async()=>{
  const r=buildExport();if(!r)return;
  stMsg.textContent=t('msg_saving')||'PNG変換中...';
  try{
    const svgStr=new XMLSerializer().serializeToString(r.clone);
    const scale=2; // 高解像度
    const W=Math.ceil(r.w*scale), H=Math.ceil(r.h*scale);
    const blob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.width=W; img.height=H;
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=url;});
    const canvas=document.createElement('canvas');
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(img,0,0,W,H);
    URL.revokeObjectURL(url);
    const dataUrl=canvas.toDataURL('image/png');
    const ok=await window.api.savePngFromSvg(dataUrl);
    stMsg.textContent=ok?(t('msg_png_saved')||'PNG保存完了'):'';
    if(ok)setTimeout(()=>stMsg.textContent='',3000);
  }catch(e){
    console.error('PNG export error:',e);
    stMsg.textContent='PNG変換に失敗しました';
    setTimeout(()=>stMsg.textContent='',3000);
  }
});
$('btn-svg').addEventListener('click',async()=>{
  const r=buildExport();if(!r)return;
  const ok=await window.api.saveSvg(new XMLSerializer().serializeToString(r.clone));
  stMsg.textContent=ok?(t('msg_svg_saved')||'SVG保存完了'):'';if(ok)setTimeout(()=>stMsg.textContent='',3000);
});


// ===== RULER =====
const rulerH = $('ruler-h');
const rulerV = $('ruler-v');

function drawRulers(){
  if(!rulerH||!rulerV)return;
  const cw=container.clientWidth, ch=container.clientHeight;
  rulerH.width=cw; rulerH.height=20;
  rulerV.width=20; rulerV.height=ch;
  const ctxH=rulerH.getContext('2d');
  const ctxV=rulerV.getContext('2d');

  ctxH.clearRect(0,0,cw,20);
  ctxV.clearRect(0,0,20,ch);
  ctxH.fillStyle='#0f3460'; ctxH.fillRect(0,0,cw,20);
  ctxV.fillStyle='#0f3460'; ctxV.fillRect(0,0,20,ch);
  ctxH.fillStyle='#667eea'; ctxH.font='8px sans-serif';
  ctxV.fillStyle='#667eea'; ctxV.font='8px sans-serif';

  // 目盛り間隔（ズームに合わせる）
  const step = (() => {
    const base = 50 * S.scale;
    if(base < 20) return 200;
    if(base < 40) return 100;
    if(base < 80) return 50;
    return 25;
  })();

  // 水平定規
  const startX = Math.floor(-S.ox/S.scale/step)*step;
  for(let x=startX; x<(cw-S.ox)/S.scale; x+=step){
    const px = x*S.scale+S.ox;
    if(px<0||px>cw)continue;
    ctxH.fillStyle='#4a5a8a';
    ctxH.fillRect(px,12,1,8);
    ctxH.fillStyle='#889';
    ctxH.fillText(Math.round(x), px+2, 10);
  }
  // 垂直定規
  const startY = Math.floor(-S.oy/S.scale/step)*step;
  for(let y=startY; y<(ch-S.oy)/S.scale; y+=step){
    const py = y*S.scale+S.oy;
    if(py<0||py>ch)continue;
    ctxV.fillStyle='#4a5a8a';
    ctxV.fillRect(12,py,8,1);
    ctxV.save();
    ctxV.translate(10, py+2);
    ctxV.rotate(-Math.PI/2);
    ctxV.fillStyle='#889';
    ctxV.fillText(Math.round(y), 0, 0);
    ctxV.restore();
  }
}

// renderAllに定規描画を追加
const _renderAllOrig = renderAll;
// renderAllの末尾でdrawRulersを呼ぶ（後でINIT後にpatch）

// ===== SAVE/OPEN BUTTONS =====
$('btn-save')?.addEventListener('click', ()=>saveProject());
$('btn-open')?.addEventListener('click', ()=>openProject());
$('btn-new')?.addEventListener('click',  ()=>{
  if(confirm('新規作成しますか？未保存の変更は失われます。'))newProject();
});

// Ctrl+S / Ctrl+O ショートカット
document.addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();saveProject();}
  if((e.ctrlKey||e.metaKey)&&e.key==='o'){e.preventDefault();openProject();}
  if((e.ctrlKey||e.metaKey)&&e.key==='n'){e.preventDefault();if(confirm('新規作成しますか？'))newProject();}
});

// ===== 線の中点から枝分かれ接続 =====
// エッジ・フリー線の右クリックメニューに「ここから接続」を追加
// ctxEdgeMに項目を動的に追加
function showCtxEdgeWithBranch(menu, x, y, type, id, branchPt){
  hideCtx();
  S.ctxTarget = {type, id, branchPt};
  const r=container.getBoundingClientRect();
  menu.style.left=Math.min(x,r.right-185)+'px';
  menu.style.top=Math.min(y,r.bottom-200)+'px';
  menu.style.display='block';
  // 「ここから接続」項目の表示制御
  const branchItem=$('ctx-edge-branch');
  if(branchItem) branchItem.style.display = branchPt ? 'block' : 'none';
}


// ===== FORK BUTTONS =====
$('btn-fork-confirm')?.addEventListener('click',()=>confirmFork());
$('btn-fork-cancel')?.addEventListener('click',()=>{cancelEdge();renderAll();});

// ===== PANEL TABS =====
document.querySelectorAll('.panel-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const tab=btn.dataset.tab;
    document.querySelectorAll('.panel-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    $('tab-settings').style.display=tab==='settings'?'block':'none';
    $('tab-help').style.display=tab==='help'?'block':'none';
  });
});

// ===== i18n LOGIC =====
async function loadLocale(lang){
  try{
    const data=await window.api.getLocale(lang);
    _i18n=data||{};
  }catch{_i18n={};}
  applyI18n();
  localStorage.setItem('rg-lang',lang);
}
function applyI18n(){
  // data-i18n: textContent
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.dataset.i18n;
    const val=t(key);
    if(val&&val!==key) el.textContent=val;
  });
  // data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const key=el.dataset.i18nPlaceholder;
    const val=t(key);
    if(val&&val!==key) el.placeholder=val;
  });
  // optgroup label
  document.querySelectorAll('[data-i18n-label]').forEach(el=>{
    const key=el.dataset.i18nLabel;
    const val=t(key);
    if(val&&val!==key) el.label=val;
  });
  // option text (data-i18n on option)
  document.querySelectorAll('option[data-i18n]').forEach(el=>{
    const key=el.dataset.i18n;
    const val=t(key);
    if(val&&val!==key) el.textContent=val;
  });
  // edge-hint
  if(edgeHint&&t('edge_hint')!=='edge_hint') edgeHint.textContent=t('edge_hint');
  // statusbar
  if(stNodes) stNodes.textContent=(t('st_nodes')||'ノード')+': '+S.nodes.length;
  if(stEdges) stEdges.textContent=(t('st_edges')||'線')+': '+(S.edges.length+(S.freeLines||[]).length);
  // fork overlay
  const fc=$('fork-count');if(fc){fc.textContent=(t('fork_count')||'子ノード: 0個選択中').replace('0',S.forkDsts.length);}
  // drop overlay
  const dov=$('drop-overlay');if(dov)dov.textContent=t('drop_overlay')||'画像をドロップ';
  // nodeNameSizeValのラベル
  const n=selNode();
  if(nodeNameSizeVal&&n){
    const fsv=n.nameFontSize||0;
    nodeNameSizeVal.textContent=fsv>0?String(fsv):(t('auto')||'自動');
  }
}
async function initLangSelect(){
  const langs=await window.api.getLocales();
  const saved=localStorage.getItem('rg-lang')||navigator.language.replace('-','_').split('_')[0];
  const match=langs.find(l=>l===saved||l.startsWith(saved))||'ja';
  await loadLocale(match);
  // サイドパネルのlang-select（存在する場合）
  const sel=$('lang-select');
  if(sel){
    const nameMap={ja:'日本語',en:'English',ko:'한국어',zh_CN:'简体中文',zh_TW:'繁體中文',es:'Español'};
    langs.sort().forEach(lang=>{
      const opt=document.createElement('option');
      opt.value=lang; opt.textContent=nameMap[lang]||lang;
      sel.appendChild(opt);
    });
    sel.value=match;
    sel.addEventListener('change',()=>loadLocale(sel.value));
  }
  // メニューバーの「表示→言語」から切り替え
  window.api.onLang?.(lang=>{
    if(langs.includes(lang)){
      if(sel)sel.value=lang;
      loadLocale(lang);
    }
  });
}

// ===== SNAP LINES（ノードドラッグ中の整列補助線） =====
const SNAP_THRESH = 8;

function getSnapLines(dragNodeId){
  const lines=[];
  for(const n of S.nodes){
    if(n.id===dragNodeId)continue;
    const W=nodeW(n),H=nodeH(n);
    lines.push({type:'h',world:n.y-H/2});
    lines.push({type:'h',world:n.y});
    lines.push({type:'h',world:n.y+H/2});
    lines.push({type:'v',world:n.x-W/2});
    lines.push({type:'v',world:n.x});
    lines.push({type:'v',world:n.x+W/2});
  }
  return lines;
}

const _snapEls={h:null,v:null};
function showSnapLine(type,screenPos){
  if(!_snapEls[type]){
    const el=document.createElement('div');
    el.style.cssText=type==='h'
      ?'position:absolute;left:0;right:0;height:1px;background:#2196f3;opacity:0.9;pointer-events:none;z-index:300;'
      :'position:absolute;top:0;bottom:0;width:1px;background:#2196f3;opacity:0.9;pointer-events:none;z-index:300;';
    container.appendChild(el);
    _snapEls[type]=el;
  }
  _snapEls[type].style.display='block';
  if(type==='h')_snapEls[type].style.top=Math.round(screenPos)+'px';
  else _snapEls[type].style.left=Math.round(screenPos)+'px';
}
function hideSnapLines(){
  if(_snapEls.h)_snapEls.h.style.display='none';
  if(_snapEls.v)_snapEls.v.style.display='none';
}

// ===== INIT =====
initSwatches();
initLangSelect();
renderAll();
