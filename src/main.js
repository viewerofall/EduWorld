/**
 * Hello World Explorer — Frontend JS
 * Uses Tauri v2 invoke API to communicate with Rust backend
 */

// Tauri v2: invoke is on window.__TAURI__.core
const invoke = window.__TAURI__?.core?.invoke ?? window.__TAURI__?.invoke;

// ── State ──
let currentLang = null;
let currentData = null;

// ── DOM refs ──
const splash      = document.getElementById('splash');
const contentArea = document.getElementById('contentArea');
const statusDot   = document.querySelector('.status-dot');
const statusText  = document.getElementById('statusText');
const runBtn      = document.getElementById('runBtn');
const infoBtn     = document.getElementById('infoBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalClose  = document.getElementById('modalClose');

// ── Language button selection ──
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    if (lang === currentLang) return;

    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    selectLanguage(lang);
  });
});

// ── Tab switching ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

// ── Run button ──
runBtn.addEventListener('click', runHelloWorld);

// ── Info modal ──
infoBtn.addEventListener('click', () => {
  modalOverlay.classList.add('open');
  modalOverlay.setAttribute('aria-hidden', 'false');
});
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

function closeModal() {
  modalOverlay.classList.remove('open');
  modalOverlay.setAttribute('aria-hidden', 'true');
}

// ── Select a language and load its data ──
async function selectLanguage(lang) {
  currentLang = lang;

  setStatus('loading', `LOADING ${lang.toUpperCase()}…`);
  runBtn.disabled = true;

  // Show content area, hide splash
  splash.style.display = 'none';
  contentArea.style.display = 'grid';

  // Reset terminal
  document.getElementById('termResult').innerHTML = '<span class="terminal-hint">Press RUN to execute the binary →</span>';
  document.getElementById('termResult').className = 'terminal-result';
  document.getElementById('outputMeta').style.display = 'none';

  // Reset to output tab
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === 'output');
    t.setAttribute('aria-selected', t.dataset.tab === 'output' ? 'true' : 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-output');
  });

  try {
    let data;
    if (invoke) {
      data = await invoke('get_language_data', { lang });
    } else {
      // Dev fallback: fetch from mock (won't be needed in real Tauri build)
      data = getMockData(lang);
    }

    currentData = data;
    populateUI(data);
    setStatus('ready', `${data.name.toUpperCase()} READY`);
    runBtn.disabled = false;
  } catch (err) {
    console.error('Failed to load language data:', err);
    setStatus('error', 'LOAD FAILED');
  }
}

// ── Populate all UI panels with language data ──
function populateUI(data) {
  // Header
  document.getElementById('langNameDisplay').textContent = data.name.toUpperCase();
  document.getElementById('sourceFilename').textContent = data.file;
  document.getElementById('termCmd').textContent = `./${currentLang === 'asm' ? 'hello_asm' : `hello_${currentLang}`}`;

  // Source code
  document.getElementById('sourceCode').textContent = data.source;

  // Compile steps
  const stepsEl = document.getElementById('compileSteps');
  stepsEl.innerHTML = '';
  data.compile_steps.forEach(step => {
    const el = document.createElement('div');
    el.className = 'compile-step';
    el.innerHTML = `
      <div class="step-header">
        <div class="step-num">${step.step}</div>
        <div class="step-cmd">${escapeHtml(step.cmd)}</div>
      </div>
      <div class="step-explanation">${escapeHtml(step.explanation)}</div>
    `;
    stepsEl.appendChild(el);
  });

  // Disassembly
  document.getElementById('disasmContent').textContent = data.disassembly;

  // Hex view
  document.getElementById('hexContent').textContent = data.hex_view;

  // Bits explanation
  document.getElementById('bitsContent').textContent = data.bits_explanation;

  // Deep dive — format nicely
  document.getElementById('deepContent').innerHTML = formatDeepDive(data.deep_dive);
}

// ── Run the binary ──
async function runHelloWorld() {
  if (!currentLang) return;

  runBtn.disabled = true;
  setStatus('running', 'RUNNING…');

  // Switch to output tab
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === 'output');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-output');
  });

  const termResult = document.getElementById('termResult');
  termResult.className = 'terminal-result';
  termResult.innerHTML = '<span class="terminal-hint">Executing…</span>';

  try {
    let result;
    if (invoke) {
      result = await invoke('run_hello_world', { lang: currentLang });
    } else {
      // Dev mode mock
      await sleep(300);
      result = { stdout: 'Hello, World!\n', stderr: '', exit_code: 0, duration_ms: 4 };
    }

    const metaEl = document.getElementById('outputMeta');
    metaEl.style.display = 'flex';

    const exitOk = result.exit_code === 0;
    document.getElementById('metaExitCode').textContent = `EXIT: ${result.exit_code}`;
    document.getElementById('metaDuration').textContent = `TIME: ${result.duration_ms}ms`;

    if (result.stdout) {
      termResult.className = exitOk ? 'terminal-result success' : 'terminal-result';
      termResult.textContent = result.stdout;
    }

    if (result.stderr) {
      termResult.className = 'terminal-result error-out';
      termResult.textContent += result.stderr;
    }

    if (!result.stdout && !result.stderr) {
      termResult.innerHTML = '<span class="terminal-hint">(no output)</span>';
    }

    setStatus(exitOk ? 'done' : 'error', exitOk ? 'EXECUTED OK' : `EXIT ${result.exit_code}`);
  } catch (err) {
    termResult.className = 'terminal-result error-out';
    termResult.textContent = `Error: ${err}\n\nMake sure the binary exists in src-tauri/binaries/`;
    setStatus('error', 'EXEC FAILED');
    console.error('Run failed:', err);
  }

  runBtn.disabled = false;
}

// ── Helpers ──

function setStatus(state, text) {
  statusDot.className = 'status-dot';
  if (state === 'running') statusDot.classList.add('running');
  else if (state === 'done') statusDot.classList.add('done');
  else if (state === 'error') statusDot.classList.add('error');
  statusText.textContent = text;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Convert deep-dive plain text into HTML.
 * Lines in ALL CAPS followed by ':' or starting with '•' become headings/bullets.
 * `code` wrapped in backticks becomes <code>.
 */
function formatDeepDive(text) {
  const lines = text.split('\n');
  let html = '';
  let inParagraph = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      if (inParagraph) {
        html += '</p>';
        inParagraph = false;
      }
      continue;
    }

    // Section heading: e.g. "THE ELF FORMAT:" or "WHY XOR?" (mostly caps, ends with :)
    if (/^[A-Z0-9 _\-()]+:/.test(line) && line.length < 80) {
      if (inParagraph) { html += '</p>'; inParagraph = false; }
      html += `<h3>${escapeHtml(line)}</h3>`;
      continue;
    }

    // Regular text line — aggregate into <p>
    const formatted = applyInlineFormatting(escapeHtml(line));
    if (!inParagraph) {
      html += '<p>';
      inParagraph = true;
    } else {
      html += ' ';
    }
    html += formatted;
  }

  if (inParagraph) html += '</p>';
  return html;
}

function applyInlineFormatting(str) {
  // `code` → <code>
  return str.replace(/`([^`]+)`/g, '<code>$1</code>');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Keyboard shortcut: R to run ──
document.addEventListener('keydown', e => {
  if (e.key === 'r' && !e.ctrlKey && !e.metaKey && currentLang && !runBtn.disabled) {
    if (document.activeElement.tagName !== 'INPUT') {
      runHelloWorld();
    }
  }
});

// Minimal mock for development outside Tauri
function getMockData(lang) {
  return {
    name: lang.toUpperCase(),
    file: `hello.${lang}`,
    source: `; Mock source for ${lang} — run inside Tauri for real data`,
    compile_steps: [{ step: 1, cmd: `compile ${lang}`, explanation: 'Mock — run inside Tauri' }],
    disassembly: `; Disassembly mock for ${lang}`,
    hex_view: `00 01 02 03  (mock — run inside Tauri)`,
    bits_explanation: `Bits mock for ${lang}`,
    deep_dive: `Run inside the Tauri app for full deep-dive content on ${lang}.`
  };
}
