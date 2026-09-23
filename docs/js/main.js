import DomFactory from './utils/domFactory.js';
import createEditorView from './editor/index.js';

import { EditorSelection } from '@codemirror/state';
import {
  cursorCharLeft,
  cursorCharRight,
  cursorLineDown,
  cursorLineUp,
  redo,
  selectAll,
  selectLine,
  toggleComment,
  undo,
} from '@codemirror/commands';

const IS_TOUCH_DEVICE = window.matchMedia('(hover: none)').matches;

const initDetailsOpen = false;
//const initDetailsOpen = true;

let isInstanceMode = true;

// MouseEvent TouchEvent wrapper
const { touchBegan, touchMoved, touchEnded } = {
  touchBegan: typeof document.ontouchstart !== 'undefined' ? 'touchstart' : 'mousedown',
  touchMoved: typeof document.ontouchmove !== 'undefined' ? 'touchmove' : 'mousemove',
  touchEnded: typeof document.ontouchend !== 'undefined' ? 'touchend' : 'mouseup',
};

async function insertFetchDoc(filePath) {
  const res = await fetch(filePath);
  return await res.text();
}

const mainSketch = './sketchBooks/mainSketch.js';
const devSketch = './sketchBooks/devSketch.js';

const codeFilePath =
  `${location.protocol}` === 'file:' || `${location.protocol}` === 'http:' || `${location.hostname}` === 'localhost'
    ? devSketch
    : mainSketch;

/* --- editor(View) */
const editorDiv = DomFactory.create('div', {
  setAttrs: {
    id: 'editor-div',
  },
  setStyles: {
    width: '100%',
  },
});

const editor = createEditorView(editorDiv);
// todo: `div` にインスタンスを渡し、外部から`.state.doc.toString()` を叩く用
editorDiv.cmEditorView = editor;

/* --- iframe(Sandbox) */

const srcPath = './sketchBooks/sketchCanvas.html';

let sandboxHTMLstr;
insertFetchDoc(srcPath).then((loadedSource) => {
  sandboxHTMLstr = loadedSource;
});

// sandbox 側のAudioContext 解除
document.addEventListener(touchEnded, () => {
  const auCtx = window.frames[0]?.auCtx;
  if (!auCtx || (auCtx.state !== 'suspended' && auCtx.state !== 'interrupted')) {
    return;
  }

  auCtx
    .resume()
    .then(() => console.log('🔊: AudioContext is now running'))
    .catch((err) => console.log(`err: ${err}`));
});

function reloadSandbox(targetSandbox) {
  const toStringDoc = editor.viewState.state.doc.toString();
  targetSandbox.src = createIframeURL(toStringDoc);
}

const originalUrl = new URL('./', window.location.href);

const importMap = {
  imports: {
    eruda: 'https://cdn.jsdelivr.net/npm/eruda/+esm',
    // todo: p5.sound と一応揃える
    tone: 'https://cdn.jsdelivr.net/npm/tone@15.0.2/+esm',
    'modules/': new URL('./sketchBooks/modules/', originalUrl).href,
  },
};
const importMapJSON = JSON.stringify(importMap, null, 2);

function replacePlaceholder(html, tag, attrs, marker, content) {
  const attrsPattern = attrs ? `[^>]*${attrs}[^>]*` : '[^>]*';
  const re = new RegExp(`(<${tag}\\b${attrsPattern}>[\\s\\S]*?)<!--\\s*@${marker}\\s*-->([\\s\\S]*?<\\/${tag}>)`, 'i');
  return html.replace(re, (_, before, after) => `${before}${content}${after}`);
}

let currentBlobScript = null;
const createIframeHtml = (userCode) => {
  const blob = new Blob([`${userCode}\n//# sourceURL=${codeFilePath}`], {
    type: 'text/javascript',
  });
  currentBlobScript ? URL.revokeObjectURL(currentBlobScript) : null;
  currentBlobScript = URL.createObjectURL(blob);

  const scriptType = isInstanceMode ? 'type="module"' : '';
  const scriptCode = `<script ${scriptType} src="${currentBlobScript}"></script>`;

  let sketchHTML = sandboxHTMLstr;
  sketchHTML = replacePlaceholder(sketchHTML, 'body', '', 'sketch-script', scriptCode);

  sketchHTML = replacePlaceholder(sketchHTML, 'script', 'type=["\']importmap["\']', 'import-map', importMapJSON);

  return sketchHTML;
};

let currentBlobUrl = null;
const createBlobURL = (htmlCode) => {
  const blob = new Blob([htmlCode], { type: 'text/html' });
  currentBlobUrl ? URL.revokeObjectURL(currentBlobUrl) : '';
  currentBlobUrl = URL.createObjectURL(blob);
  return currentBlobUrl;
};

const createIframeURL = (userCode) => {
  const htmlStr = createIframeHtml(userCode);
  const iframeURL = createBlobURL(htmlStr);
  return iframeURL;
};

const sandbox = DomFactory.create('iframe', {
  setAttrs: {
    id: 'sandbox',
    sandbox: 'allow-same-origin allow-scripts',
    allow:
      'accelerometer; ambient-light-sensor; autoplay; bluetooth; camera; encrypted-media; geolocation; gyroscope;  hid; microphone; magnetometer; midi; payment; usb; serial; vr; xr-spatial-tracking',
    loading: 'lazy',
  },
  setStyles: {
    width: '100%',
    height: '100dvh',
    'border-width': '0',
    position: 'fixed',
    top: '0',
    left: '0',
    'z-index': '0',
    //'background-color': 'lightgray',
    'background-color': 'darkgray',
  },
});

// editor 上のバッファやりとり
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'editorCodeBuffer') {
    return;
  }
  event.source.postMessage(
    {
      type: 'message',
      text: editor.state.doc.toString(),
    },
    event.origin,
  );
});

/* --- accessory */
const callButton = DomFactory.create('button', {
  textContent: '🔄',
  setStyles: {
    'font-family': 'Consolas, Menlo, Monaco, source-code-pro, Courier New, monospace',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
  },
  addEventListeners: [
    {
      type: touchBegan,
      listener: {
        handleEvent() {
          reloadSandbox(sandbox);
        },
      },
    },
  ],
});

const summaryTextContent = (bool) => `source: ${bool ? 'hide' : 'show'}`;

const summary = DomFactory.create('summary', {
  setStyles: {
    'font-family': 'Consolas, Menlo, Monaco, source-code-pro, Courier New, monospace',
    //'font-size': '0.8rem',
    padding: '0.5rem 1rem',
  },
  textContent: summaryTextContent(initDetailsOpen),
});

const wrapSummary = DomFactory.create('div', {
  setStyles: {
    display: 'flex',
    'justify-content': 'space-between',
  },
});

const detailsControl = (isDetailsOpen, summaryElement, divElement) => {
  summaryElement.textContent = summaryTextContent(isDetailsOpen);
  divElement.style.display = isDetailsOpen ? '' : 'none';
};

const details = DomFactory.create('details', {
  setAttrs: {
    id: 'details',
  },
  setStyles: { cursor: 'pointer' },
  addEventListeners: [
    {
      type: 'toggle',
      listener: {
        targetSummary: summary,
        targetDiv: editorDiv,
        handleEvent: function (e) {
          detailsControl(e.target.open, this.targetSummary, this.targetDiv);
        },
      },
    },

    {
      type: 'build',
      listener: {
        targetSummary: summary,
        targetDiv: editorDiv,
        handleEvent: function (e) {
          e.detail.open = initDetailsOpen;
          detailsControl(initDetailsOpen, this.targetSummary, this.targetDiv);
        },
      },
    },
  ],
  appendChildren: [summary, wrapSummary],
});

// --- 共通設定の定義(マジックナンバーや重複文字列の排除) ---
const FONT_FAMILY = 'Consolas, Menlo, Monaco, source-code-pro, Courier New, monospace';
const COLOR_NORMAL = 'var(--accessory-button-color-normal, #e0e0e0)';

// --- UI部品の生成 ---
// ラベル生成ヘルパー(重複コードを排除)
const createLabel = (text, isVisible) =>
  DomFactory.create('div', {
    setStyles: {
      'grid-area': '1 / 1',
      'font-family': FONT_FAMILY,
      'font-size': '0.62rem',
      color: COLOR_NORMAL,
      'text-transform': 'lowercase',
      transition: 'opacity 0.2s ease',
      opacity: isVisible ? '1' : '0',
    },
    textContent: text,
  });

const labelInstance = createLabel('instance mode', isInstanceMode);
const labelGlobal = createLabel('global mode', !isInstanceMode);

const toggleLabelContainer = DomFactory.create('div', {
  setStyles: {
    display: 'grid',
    'justify-items': 'center',
    'margin-bottom': '4px',
  },
  appendChildren: [labelInstance, labelGlobal],
});

// ツマミ(サイズ固定値を排除した相対設計)
const toggleKnob = DomFactory.create('div', {
  setStyles: {
    position: 'absolute',
    top: '2px',
    bottom: '2px',
    'aspect-ratio': '1 / 1',
    'border-radius': '50%',
    'background-color': COLOR_NORMAL,
    'box-shadow': '0 2px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'font-size': '0.75rem',
    transition: 'left 0.3s ease, transform 0.3s ease', // 素直にtransitionを設定
    left: isInstanceMode ? 'calc(100% - 2px)' : '2px',
    transform: isInstanceMode ? 'translateX(-100%)' : 'translateX(0)',
  },
  textContent: isInstanceMode ? '📦' : '🌍',
});

// --- 状態管理とイベント処理 ---
// UIの見た目を更新する専用関数(関心の分離)
const updateToggleUI = () => {
  labelInstance.style.opacity = isInstanceMode ? '1' : '0';
  labelGlobal.style.opacity = isInstanceMode ? '0' : '1';
  toggleKnob.style.left = isInstanceMode ? 'calc(100% - 2px)' : '2px';
  toggleKnob.style.transform = isInstanceMode ? 'translateX(-100%)' : 'translateX(0)';
  toggleKnob.textContent = isInstanceMode ? '📦' : '🌍';
};
const modeToggleSwitch = DomFactory.create('div', {
  setStyles: {
    position: 'relative',
    width: '4rem',
    height: '1.75rem',
    'border-radius': '0.875rem',
    background: 'var(--accessory-button-backGround-normal, transparent)',
    border: `1px solid ${COLOR_NORMAL}`,
    'box-sizing': 'border-box',
  },
  appendChildren: [toggleKnob],
});

// --- 親コンテナ ---
const modeToggleContainer = DomFactory.create('div', {
  setStyles: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    margin: '0 1rem',
    cursor: 'pointer',
  },
  appendChildren: [toggleLabelContainer, modeToggleSwitch],
  addEventListeners: [
    {
      type: touchBegan,
      listener: {
        handleEvent() {
          isInstanceMode = !isInstanceMode;
          updateToggleUI();
          reloadSandbox(sandbox);
        },
      },
    },
  ],
});

const headerControlWrap = DomFactory.create('div', {
  setStyles: {
    display: 'grid',
    'grid-template-columns': 'auto 1fr auto',
    'align-items': 'center',
  },
  appendChildren: [callButton, details, modeToggleContainer],
});

const headerHandleEvent = function () {
  const header = document.querySelector('#header');
  const offsetTop = Math.max(0, window.visualViewport.offsetTop);
  //header.style.top = `${offsetTop}px`;
  header.style.transform = `translateY(${offsetTop}px)`;
  //header.style.overflow = 'hidden'
};

/* --- accessory-header */
const header = DomFactory.create('header', {
  setAttrs: {
    id: 'header',
  },
  setStyles: {
    background: `var(--accessory-backGround-color-scheme)`,
    'background-blend-mode': `var(--accessory-backGround-background-blend-mode)`,
    //'backdrop-filter': `var(--accessory-backGround-backdrop-filter)`,
    position: 'sticky',
    width: '100%',
    top: '0',
    'z-index': '1',
  },
  targetAddEventListeners: [
    {
      target: window.visualViewport,
      type: 'resize',
      listener: {
        handleEvent: headerHandleEvent,
      },
    },
    {
      target: window.visualViewport,
      type: 'scroll',
      listener: {
        handleEvent: headerHandleEvent,
      },
    },
  ],
  appendChildren: [headerControlWrap],
});

const buttonFactory = (buttonIconChar, actionHandle) => {
  function createFrame(width, height) {
    return DomFactory.create('div', {
      setStyles: {
        'min-width': `${width}`,
        height: `${height}`,
        display: 'flex',
        'justify-content': 'center',
        'align-items': 'center',
        //background: 'rgba(255, 0, 0, 0.5)',
      },
    });
  }

  const num = 2.5;
  const btnW = `${num}rem`;
  const btnH = `${num * 0.8}rem`;
  // const btnRadius = '16%';

  const createActionButton = (iconChar) => {
    const icon = DomFactory.create('span', {
      textContent: `${iconChar}`,
      setStyles: {
        'font-family': 'Consolas, Menlo, Monaco, source-code-pro, Courier New, monospace',
        'font-size': '1.0rem',
        'font-style': 'normal',
        'font-weight': '400',
        'line-height': '28px',
        color: `var(--accessory-button-color-normal)`,
      },
    });

    const button = DomFactory.create(createFrame('88%', '98%'), {
      setStyles: {
        //'background-color': '#8e8e93', // light gray
        background: `var(--accessory-button-backGround-normal)`,
        'mix-blend-mode': `var(--accessory-button-background-blend-mode-normal)`,
        'box-shadow': `var(--accessory-button-box-shadow)`,
        'border-radius': `var(--accessory-button-border-radius)`,
      },
      appendChildren: [icon],
    });

    return DomFactory.create(createFrame(btnW, btnH), {
      setStyles: {
        cursor: 'pointer',
      },
      appendChildren: [button],
    });
  };

  const actionButton = createActionButton(buttonIconChar);
  actionButton.addEventListener('click', actionHandle);

  return actionButton;
};

// wip: 最大数問題
const buttons = Object.entries({
  '//': {
    targetEditor: editor,
    handleEvent: function () {
      toggleComment(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '▭': {
    targetEditor: editor,
    handleEvent: function () {
      selectLine(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '←': {
    targetEditor: editor,
    handleEvent: function () {
      cursorCharLeft(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '↓': {
    targetEditor: editor,
    handleEvent: function () {
      cursorLineDown(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '↑': {
    targetEditor: editor,
    handleEvent: function () {
      cursorLineUp(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '→': {
    targetEditor: editor,
    handleEvent: function () {
      cursorCharRight(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '⎁': {
    targetEditor: editor,
    handleEvent: function () {
      selectAll(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '⤻': {
    targetEditor: editor,
    handleEvent: function () {
      redo(this.targetEditor);
      this.targetEditor.focus();
    },
  },
  '⤺': {
    targetEditor: editor,
    handleEvent: function () {
      undo(this.targetEditor);
      this.targetEditor.focus();
    },
  },
}).map(([str, fnc]) => {
  return buttonFactory(str, fnc);
});

const buttonsWrap = DomFactory.create('div', {
  setStyles: {
    width: '100%',
    'box-sizing': 'border-box',
    padding: '0.6rem 1rem',
    display: 'flex',
    'justify-content': 'space-between',
  },

  appendChildren: [...buttons],
});

let caret, headLine, endLine;
const divStep = 16;
let swipeAreaWidth, stepValue;
let startX = 0;

const footerHandleEvent = function () {
  const footer = document.querySelector('#footer');
  if (!this.targetEditor.hasFocus && footer) {
    footer.style.display = 'none';
    return;
  }
  if (!IS_TOUCH_DEVICE) {
    return;
  }
  footer.style.display = '';

  const offsetTop = window.visualViewport.offsetTop;
  const offsetBottom = window.innerHeight - window.visualViewport.height + offsetTop - window.visualViewport.pageTop;
  const tOffsetTop = visualViewport.offsetTop + visualViewport.height - document.documentElement.clientHeight;
  //footer.style.bottom = `${offsetBottom}px`;
  footer.style.transform = `translateY(${tOffsetTop}px)`;
};

/* --- accessory-footer */
const footer = DomFactory.create('footer', {
  setAttrs: {
    id: 'footer',
  },
  setStyles: {
    background: `var(--accessory-backGround-color-scheme)`,
    'background-blend-mode': `var(--accessory-backGround-background-blend-mode)`,
    'backdrop-filter': `var(--accessory-backGround-backdrop-filter)`,
    position: 'sticky',
    width: '100%',
    bottom: '0',
    display: 'none',
  },
  targetAddEventListeners: [
    {
      target: window.visualViewport,
      type: 'resize',
      listener: {
        targetEditor: editor,
        handleEvent: footerHandleEvent,
      },
    },
    {
      target: window.visualViewport,
      type: 'scroll',
      listener: {
        targetEditor: editor,
        handleEvent: footerHandleEvent,
      },
    },
  ],
  addEventListeners: [
    {
      type: touchBegan,
      listener: {
        targetEditor: editor,
        handleEvent: function (e) {
          //e.preventDefault(); // xxx: 変化要確認
          if (!this.targetEditor.hasFocus) {
            return;
          }

          const selectionMain = this.targetEditor.state.selection.main;
          caret = selectionMain.anchor;
          headLine = this.targetEditor.moveToLineBoundary(selectionMain, 0).anchor;
          endLine = this.targetEditor.moveToLineBoundary(selectionMain, 1).anchor;

          swipeAreaWidth = document.querySelector('#footer').clientWidth;
          stepValue = swipeAreaWidth / divStep;
          startX = e.changedTouches[0].clientX;
        },
      },
    },

    {
      type: touchMoved,
      listener: {
        targetEditor: editor,
        handleEvent: function (e) {
          e.preventDefault(); // xxx: 変化要確認
          if (!this.targetEditor.hasFocus) {
            return;
          }

          const swipeX = e.changedTouches[0].clientX;

          const moveDistance = swipeX - startX;
          const moveCache = Math.abs(moveDistance) < stepValue ? caret : caret + Math.round(moveDistance / stepValue);

          if (caret === moveCache) {
            return;
          }

          const moveValue = moveCache < headLine ? headLine : moveCache >= endLine ? endLine : moveCache;

          this.targetEditor.dispatch({
            selection: EditorSelection.create([EditorSelection.cursor(moveValue)]),
          });
          this.targetEditor.focus();
        },
      },
    },
  ],
  appendChildren: [buttonsWrap],
});

const setLayout = () => {
  const rootMain = DomFactory.create('div', {
    setAttrs: {
      id: 'rootMain',
    },
    setStyles: {
      display: 'grid',
      'grid-template-rows': 'auto 1fr auto',
      height: '100%',
      overflow: 'auto',
    },
    appendChildren: [header, editorDiv],
  });

  if (IS_TOUCH_DEVICE) {
    rootMain.appendChild(footer);
  }
  document.body.appendChild(sandbox);
  document.body.appendChild(rootMain);
};

document.addEventListener('DOMContentLoaded', () => {
  setLayout();

  insertFetchDoc(codeFilePath).then((loadedSource) => {
    // todo: 事前に`doc` が存在するなら、`doc` 以降に挿入
    editor.dispatch({
      changes: { from: editor.state?.doc.length, insert: loadedSource },
    });
    sandbox.src = createIframeURL(loadedSource);
  });
});
