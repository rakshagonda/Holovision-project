(() => {
'use strict';

const $ = id => document.getElementById(id);
const W = 640, H = 360;
const STOP_DISTANCE_CM = 100;
const STOP_THRESHOLD = 0.75, CAUTION_THRESHOLD = 0.28;

function isStopDistance() {
  return detectedObjects.length > 0 && detectedObjects[0].cm <= STOP_DISTANCE_CM;
}

let currentProfile = 'moderate';
let currentLang = 'en';
let videoStream = null;
let currentFacing = 'environment';

/* ---------- Canonical Obstacle Heights (cm) for Pinhole Distance Estimation ---------- */
const REAL_H = {
  person: 165, chair: 88, couch: 85, bed: 60, 'dining table': 75, tv: 50, laptop: 25,
  bottle: 24, cup: 10, bicycle: 100, motorcycle: 110, car: 150, bus: 300, truck: 300,
  dog: 50, cat: 25, 'potted plant': 50, bench: 85, refrigerator: 170, backpack: 45
};

/* ---------- Multilingual Localization ---------- */
const L = {
  en: {
    code: 'en-US', match: ['en-IN', 'en-US', 'en-GB', 'en'],
    names: { person: 'person', chair: 'chair', couch: 'sofa', bed: 'bed', 'dining table': 'table', tv: 'TV', bicycle: 'bicycle', motorcycle: 'motorcycle', car: 'car', bus: 'bus', truck: 'truck', dog: 'dog', cat: 'cat', other: 'obstacle' },
    phrase: (n, z, m) => `${n} ${['on the left', 'ahead', 'on the right'][z]}, about ${m} metres`,
    t: {
      ready: 'HoloVision ready', clear: 'Path clear', stop: 'Stop', caution: 'Caution',
      caution_0: 'Caution, obstacle on the left', caution_1: 'Caution, obstacle ahead', caution_2: 'Caution, obstacle on the right',
      profile_mild: 'Mild profile selected', profile_moderate: 'Moderate profile selected', profile_severe: 'Severe profile selected',
      lang_change: 'English voice selected', stop_alert: 'Stop! Obstacle very close'
    }
  },
  hi: {
    code: 'hi-IN', match: ['hi-IN'],
    names: { person: 'व्यक्ति', chair: 'कुर्सी', couch: 'सोफ़ा', bed: 'बिस्तर', 'dining table': 'मेज़', tv: 'टीवी', bicycle: 'साइकिल', motorcycle: 'मोटरसाइकिल', car: 'कार', bus: 'बस', truck: 'ट्रक', dog: 'कुत्ता', cat: 'बिल्ली', other: 'रुकावट' },
    phrase: (n, z, m) => `${['बाईं ओर', 'सामने', 'दाईं ओर'][z]} ${n}, लगभग ${m} मीटर`,
    t: {
      ready: 'होलोविज़न तैयार है', clear: 'रास्ता साफ़ है', stop: 'रुकिए', caution: 'सावधान',
      caution_0: 'सावधान, बाईं ओर रुकावट', caution_1: 'सावधान, आगे रुकावट', caution_2: 'सावधान, दाईं ओर रुकावट',
      profile_mild: 'हल्की प्रोफ़ाइल', profile_moderate: 'मध्यम प्रोफ़ाइल', profile_severe: 'गंभीर प्रोफ़ाइल',
      lang_change: 'हिन्दी आवाज़ चुनी गई', stop_alert: 'रुकिए! रुकावट बहुत पास है'
    }
  },
  kn: {
    code: 'kn-IN', match: ['kn-IN'],
    names: { person: 'ವ್ಯಕ್ತಿ', chair: 'ಕುರ್ಚಿ', couch: 'ಸೋಫಾ', bed: 'ಹಾಸಿಗೆ', 'dining table': 'ಮೇಜು', tv: 'ಟಿವಿ', bicycle: 'ಸೈಕಲ್', motorcycle: 'ಬೈಕ್', car: 'ಕಾರು', bus: 'ಬಸ್', truck: 'ಟ್ರಕ್', dog: 'ನಾಯಿ', cat: 'ಬೆಕ್ಕು', other: 'ಅಡಚಣೆ' },
    phrase: (n, z, m) => `${['ಎಡಭಾಗದಲ್ಲಿ', 'ಮುಂದೆ', 'ಬಲಭಾಗದಲ್ಲಿ'][z]} ${n}, ಸುಮಾರು ${m} ಮೀಟರ್`,
    t: {
      ready: 'ಹೋಲೋವಿಷನ್ ಸಿದ್ಧವಾಗಿದೆ', clear: 'ದಾರಿ ಸ್ಪಷ್ಟವಾಗಿದೆ', stop: 'ನಿಲ್ಲಿ', caution: 'ಎಚ್ಚರಿಕೆ',
      caution_0: 'ಎಚ್ಚರಿಕೆ, ಎಡಭಾಗದಲ್ಲಿ ಅಡಚಣೆ', caution_1: 'ಎಚ್ಚರಿಕೆ, ಮುಂದೆ ಅಡಚಣೆ', caution_2: 'ಎಚ್ಚರಿಕೆ, ಬಲಭಾಗದಲ್ಲಿ ಅಡಚಣೆ',
      profile_mild: 'ಸೌಮ್ಯ ಪ್ರೊಫೈಲ್', profile_moderate: 'ಮಧ್ಯಮ ಪ್ರೊಫೈಲ್', profile_severe: 'ತೀವ್ರ ಪ್ರೊಫೈಲ್',
      lang_change: 'ಕನ್ನಡ ಧ್ವನಿ ಆಯ್ಕೆಯಾಗಿದೆ', stop_alert: 'ನಿಲ್ಲಿ! ಅಡಚಣೆ ತುಂಬಾ ಹತ್ತಿರದಲ್ಲಿದೆ'
    }
  }
};

/* ---------- Audio & Speech Engine ---------- */
let audioCtx = null, audioUnlocked = false;
let isSpeaking = false, speakStartedAt = 0, lastSpokenText = '', lastSpeakTime = 0, speakToken = 0;
let voiceList = [];
let lastSpeechIssue = '';
const badVoices = new Set();   // voices that failed this session (skipped on retry)
const LANG3 = { eng: 'en', hin: 'hi', kan: 'kn' };   // some Android engines report 3-letter codes
const LANG_LABEL = { en: 'English', hi: 'हिन्दी', kn: 'ಕನ್ನಡ' };

function voiceId(v) { return v.voiceURI || v.name; }
function primaryLang(v) {
  const p = (v.lang || '').toLowerCase().replace(/_/g, '-').split('-')[0];
  return LANG3[p] || p;
}

function refreshVoices() {
  if ('speechSynthesis' in window) voiceList = speechSynthesis.getVoices() || [];
}

// Best working voice for a language: local voices first, then India, US, UK region
function findVoice(key) {
  if (!voiceList.length) refreshVoices();
  const pref = ['in', 'us', 'gb'];
  const cands = voiceList.filter(v => primaryLang(v) === key && !badVoices.has(voiceId(v)));
  const score = v => {
    const reg = ((v.lang || '').toLowerCase().replace(/_/g, '-').split('-')[1] || '').slice(0, 2);
    const r = pref.indexOf(reg);
    return (v.localService ? 0 : 10) + (r === -1 ? 5 : r);
  };
  cands.sort((a, b) => score(a) - score(b));
  return cands[0] || null;
}

// If the browser hasn't listed voices yet, assume the language works
function langAvailable(key) {
  if (!voiceList.length) refreshVoices();
  return voiceList.length === 0 ? true : !!findVoice(key);
}

function updateVoiceInfo() {
  const el = $('voiceInfo');
  if (!el) return;
  if (!voiceList.length) { el.textContent = 'Voices: loading…'; return; }
  el.textContent = 'Voices — ' + ['en', 'hi', 'kn'].map(k => {
    const v = findVoice(k);
    return LANG_LABEL[k] + ': ' + (v ? '✓ ' + v.name : '✗ not installed');
  }).join(' · ') + (lastSpeechIssue ? '  ⚠ ' + lastSpeechIssue : '');
}

if ('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => { refreshVoices(); updateVoiceInfo(); };
  refreshVoices();
  updateVoiceInfo();
  setTimeout(() => { refreshVoices(); updateVoiceInfo(); }, 1000);
  setTimeout(() => { refreshVoices(); updateVoiceInfo(); }, 3000);
}

function initAudio() {
  if (audioUnlocked && audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    audioUnlocked = true;
  } catch (e) {}
}

function playSpatialBeep(freq, pan, dur = 0.08, vol = 0.25) {
  if (!audioUnlocked || !audioCtx) return;
  // Never beep over active spoken voice
  if (speechSynthesis.speaking || isSpeaking) return;

  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    if (audioCtx.createStereoPanner) {
      const panner = audioCtx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(audioCtx.destination);
    } else {
      osc.connect(gain);
      gain.connect(audioCtx.destination);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch (e) {}
}

/* Speak a message. getMsg(langKey) returns the text for that language, so a
   fallback to English also uses English TEXT (not Hindi/Kannada text). */
function speak(getMsg, force = false) {
  if (!('speechSynthesis' in window)) return;
  initAudio();

  const now = performance.now();
  const lang = langAvailable(currentLang) ? currentLang : 'en';
  const text = getMsg(lang);
  if (!text) return;

  // Don't repeat the exact same alert within 4.5 s unless forced
  if (!force && lastSpokenText === text && (now - lastSpeakTime < 4500)) return;

  if (speechSynthesis.paused) speechSynthesis.resume();
  const busy = speechSynthesis.speaking || speechSynthesis.pending;
  if (busy) {
    const stuck = now - speakStartedAt > 8000;   // recover from a stuck engine
    if (!force && !stuck) return;
    speechSynthesis.cancel();
  }

  const token = ++speakToken;
  lastSpokenText = text;
  lastSpeakTime = now;
  isSpeaking = true;
  speakStartedAt = now;

  // Chrome drops speech if speak() is called right after cancel(): wait a moment
  if (busy) setTimeout(() => say(token, lang, getMsg), 150);
  else say(token, lang, getMsg);
}

function say(token, lang, getMsg) {
  if (token !== speakToken) return;          // a newer message replaced this one
  const voice = findVoice(lang);
  // No working voice for this language -> speak English right away (no 3 s wait)
  if (!voice && lang !== 'en' && voiceList.length) { say(token, 'en', getMsg); return; }
  const u = new SpeechSynthesisUtterance(getMsg(lang));
  u.lang = voice ? voice.lang : L[lang].code;
  if (voice) u.voice = voice;
  u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;

  let started = false, finished = false, wd = null, lastErr = '';

  // Voice failed -> try next voice -> language only -> English
  const fail = () => {
    if (finished || token !== speakToken) return;
    finished = true; clearTimeout(wd);
    console.warn('Speech failed:', lang, voice ? voice.name : '(default voice)');
    lastSpeechIssue = (lang === 'hi' ? 'Hindi' : lang === 'kn' ? 'Kannada' : 'English') + ' voice failed: ' + (voice ? voice.name : 'default') + (lastErr ? ' (' + lastErr + ')' : '');
    try { speechSynthesis.cancel(); } catch (e) {}
    if (voice) {
      badVoices.add(voiceId(voice));
      // Online (network) voices usually fail together when offline/blocked:
      // skip all of them so we reach a working local voice quickly.
      if (!voice.localService) {
        voiceList.forEach(v => { if (primaryLang(v) === lang && !v.localService) badVoices.add(voiceId(v)); });
      }
      setTimeout(() => say(token, lang, getMsg), 120);
    } else if (lang !== 'en') {
      setTimeout(() => say(token, 'en', getMsg), 120);
    } else {
      isSpeaking = false;
    }
    updateVoiceInfo();
  };

  u.onstart = () => { started = true; clearTimeout(wd); lastSpeechIssue = ''; updateVoiceInfo(); };
  u.onend = () => {
    if (finished) return;
    finished = true; clearTimeout(wd);
    if (token === speakToken) isSpeaking = false;
  };
  u.onerror = (e) => {
    if (finished) return;
    if (e.error === 'canceled' || e.error === 'interrupted') {
      finished = true; clearTimeout(wd);
      if (token === speakToken) isSpeaking = false;
      return;
    }
    lastErr = e.error || '';
    fail();
  };

  // Silent-failure watchdog: if speech never starts, treat it as a failure
  wd = setTimeout(() => { if (!started) fail(); }, 2000);
  speechSynthesis.speak(u);
}

function speakKey(key, force = false) {
  speak(lk => L[lk].t[key], force);
}

function phraseFor(lk, o) {
  const entry = L[lk];
  const nm = entry.names[o.name] || (lk === 'en' ? o.name : entry.names.other);
  return entry.phrase(nm, o.zone, (o.cm / 100).toFixed(1));
}
function speakObstacle(o, force = false) {
  speak(lk => phraseFor(lk, o), force);
}
// STOP alert: always interrupts other speech and begins with the word "Stop"
function speakStop(o) {
  speak(lk => {
    const stopWord = L[lk].t.stop;
    return o ? stopWord + '. ' + phraseFor(lk, o) : L[lk].t.stop_alert;
  }, true);
}

/* ---------- AI Object Detector (COCO-SSD Lite) ---------- */
let cocoModel = null, modelReady = false;
let detectedObjects = [];
let zonesThreat = [0, 0, 0]; // Left, Center, Right (0 to 1)
let aiDuration = 0;

async function loadAI() {
  try {
    $('aiBadge').textContent = 'Loading AI (~10MB)...';
    await tf.ready();
    cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    modelReady = true;
    $('aiBadge').textContent = 'AI Ready';
    $('aiBadge').className = 'badge ok';
    runAiLoop();
  } catch (err) {
    $('aiBadge').textContent = 'Basic Vision Active';
    $('aiBadge').className = 'badge ok';
  }
}

async function runAiLoop() {
  const video = $('webcam');
  while (true) {
    if (modelReady && video.readyState >= 2 && !$('simToggle').checked) {
      const t0 = performance.now();
      try {
        const preds = await cocoModel.detect(video, 8, 0.35);
        const vw = video.videoWidth || 640, vh = video.videoHeight || 360;
        const f = (vw / 2) / Math.tan(32.5 * Math.PI / 180);

        const newZones = [0, 0, 0];
        const objs = [];

        for (const p of preds) {
          const [x, y, w, h] = p.bbox;
          let cm = (REAL_H[p.class] || 80) * f / Math.max(h, 10);
          if (y <= 4 || (y + h) >= (vh - 4)) cm *= 0.65;
          if ((w * h) / (vw * vh) > 0.35) cm = Math.min(cm, 90);
          cm = Math.max(20, Math.min(1000, cm));

          const z = Math.min(2, Math.max(0, ((x + w / 2) * 3 / vw) | 0));
          const threat = Math.max(0, Math.min(1, (250 - cm) / 200));
          newZones[z] = Math.max(newZones[z], threat);

          objs.push({
            name: p.class,
            cm: Math.round(cm),
            zone: z,
            box: [x / vw, y / vh, w / vw, h / vh]
          });
        }
        objs.sort((a, b) => a.cm - b.cm);
        detectedObjects = objs;
        for (let i = 0; i < 3; i++) {
          zonesThreat[i] = zonesThreat[i] * 0.3 + newZones[i] * 0.7;
        }
        aiDuration = Math.round(performance.now() - t0);
      } catch (e) {}
    }
    await new Promise(r => setTimeout(r, 60));
  }
}

/* ---------- High-Def Edge Detection Engine ---------- */
const EW = 240, EH = 135, EN = EW * EH;
const edCanvas = document.createElement('canvas'); edCanvas.width = EW; edCanvas.height = EH;
const edCtx = edCanvas.getContext('2d', { willReadFrequently: true });
const edInCanvas = document.createElement('canvas'); edInCanvas.width = EW; edInCanvas.height = EH;
const edInCtx = edInCanvas.getContext('2d', { willReadFrequently: true });
const edImg = edCtx.createImageData(EW, EH);
const rawGray = new Float32Array(EN);
const cleanGray = new Float32Array(EN);

function computeEdges(r, g, b, isZoomed = false) {
  const video = $('webcam');
  if (!video || video.readyState < 2) return;

  if (isZoomed) {
    const vw = video.videoWidth || 640, vh = video.videoHeight || 360;
    edInCtx.drawImage(video, vw * 0.1, vh * 0.1, vw * 0.8, vh * 0.8, 0, 0, EW, EH);
  } else {
    edInCtx.drawImage(video, 0, 0, EW, EH);
  }

  const data = edInCtx.getImageData(0, 0, EW, EH).data;
  const out = edImg.data;

  // 1. Convert to grayscale luminance
  for (let i = 0, j = 0; j < EN; i += 4, j++) {
    rawGray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 2. 3x3 Noise Suppression filter (eliminates webcam static/noise)
  for (let y = 1; y < EH - 1; y++) {
    const row = y * EW;
    for (let x = 1; x < EW - 1; x++) {
      const j = row + x;
      cleanGray[j] = (
        rawGray[j - EW - 1] + rawGray[j - EW] * 2 + rawGray[j - EW + 1] +
        rawGray[j - 1] * 2  + rawGray[j] * 4      + rawGray[j + 1] * 2 +
        rawGray[j + EW - 1] + rawGray[j + EW] * 2 + rawGray[j + EW + 1]
      ) * 0.0625;
    }
  }

  // 3. Sobel Edge Gradient on clean frame
  for (let y = 1; y < EH - 1; y++) {
    const row = y * EW;
    for (let x = 1; x < EW - 1; x++) {
      const j = row + x, k = j * 4;
      const tl = cleanGray[j - EW - 1], t = cleanGray[j - EW], tr = cleanGray[j - EW + 1];
      const l = cleanGray[j - 1],                              ri = cleanGray[j + 1];
      const bl = cleanGray[j + EW - 1], bo = cleanGray[j + EW], br = cleanGray[j + EW + 1];

      const gx = -tl + tr - 2 * l + 2 * ri - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * bo + br;
      const mag = Math.sqrt(gx * gx + gy * gy) * 0.25;

      if (mag > 6.0) {
        out[k]     = r;
        out[k + 1] = g;
        out[k + 2] = b;
        out[k + 3] = Math.min(255, 140 + mag * 15);
      } else {
        out[k + 3] = 0;
      }
    }
  }
  edCtx.putImageData(edImg, 0, 0);
}

/* ---------- Image Enhancer (Mild profile) ---------- */
const enC = document.createElement('canvas'); enC.width = W; enC.height = H;
const enCtx = enC.getContext('2d', { willReadFrequently: true });
let enSrc = null;

function enhanceFrame(video) {
  const vw = video.videoWidth || 640, vh = video.videoHeight || 360;
  // 1.25x zoom on centre + brighter, higher contrast, richer colour
  enCtx.filter = 'contrast(1.3) saturate(1.25) brightness(1.12)';
  enCtx.drawImage(video, vw * 0.1, vh * 0.1, vw * 0.8, vh * 0.8, 0, 0, W, H);
  enCtx.filter = 'none';

  // Sharpen (makes edges, text and object borders crisper)
  const img = enCtx.getImageData(0, 0, W, H), d = img.data;
  if (!enSrc || enSrc.length !== d.length) enSrc = new Uint8ClampedArray(d.length);
  enSrc.set(d);
  const AMT = 0.75, row = W * 4;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * row + x * 4;
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        const sh = 5 * enSrc[k] - enSrc[k - 4] - enSrc[k + 4] - enSrc[k - row] - enSrc[k + row];
        d[k] = enSrc[k] + (sh - enSrc[k]) * AMT;
      }
    }
  }
  enCtx.putImageData(img, 0, 0);
}

/* ---------- HUD Renderer ---------- */
const hud = $('hudCanvas'), ctx = hud.getContext('2d');
let fpsFrames = 0, currentFps = 0, lastFpsT = performance.now();
let lastAlertSpeak = 0, lastLevel = 'clear';

function renderHUD() {
  requestAnimationFrame(renderHUD);
  try {
    fpsFrames++;
    const now = performance.now();
    if (now - lastFpsT >= 1000) {
      currentFps = fpsFrames;
      fpsFrames = 0;
      lastFpsT = now;
    }

    // Simulation Mode Check
    if ($('simToggle').checked) {
      const simCm = +$('simSlider').value;
      const simThreat = Math.max(0, Math.min(1, (250 - simCm) / 200));
      zonesThreat = [0, simThreat, 0];
      detectedObjects = [{ name: 'Barrier', cm: simCm, zone: 1, box: [0.35, 0.25, 0.3, 0.5] }];
    }

    // Determine Overall Hazard Level
    const maxThreat = Math.max(...zonesThreat);
    let hazardLevel = 'clear';
    if (isStopDistance()) hazardLevel = 'stop';
    else if (maxThreat >= CAUTION_THRESHOLD) hazardLevel = 'caution';

    // Update Proximity Bars & Badges
    $('valL').textContent = Math.round(zonesThreat[0] * 100) + '%';
    $('valC').textContent = Math.round(zonesThreat[1] * 100) + '%';
    $('valR').textContent = Math.round(zonesThreat[2] * 100) + '%';
    $('fillL').style.width = Math.round(zonesThreat[0] * 100) + '%';
    $('fillC').style.width = Math.round(zonesThreat[1] * 100) + '%';
    $('fillR').style.width = Math.round(zonesThreat[2] * 100) + '%';

    const zColor = (v) => v >= STOP_THRESHOLD ? 'var(--bad)' : (v >= CAUTION_THRESHOLD ? 'var(--warn)' : 'var(--ok)');
    $('fillL').style.background = zColor(zonesThreat[0]);
    $('fillC').style.background = zColor(zonesThreat[1]);
    $('fillR').style.background = zColor(zonesThreat[2]);

    $('stageWrap').className = 'stage-wrap ' + hazardLevel;
    $('safetyBadge').textContent = hazardLevel.toUpperCase();
    $('safetyBadge').className = 'badge ' + (hazardLevel === 'stop' ? 'bad' : hazardLevel === 'caution' ? 'warn' : 'ok');
    $('statLevel').textContent = hazardLevel.toUpperCase();
    $('stopBanner').style.display = hazardLevel === 'stop' ? 'block' : 'none';

    $('statFps').textContent = currentFps + ' fps';
    $('statMs').textContent = aiDuration + ' ms';
    $('statObjs').textContent = detectedObjects.length;
    if (detectedObjects[0]) {
      $('statNear').textContent = `${detectedObjects[0].name} (${(detectedObjects[0].cm / 100).toFixed(1)}m)`;
    } else {
      $('statNear').textContent = 'None';
    }

    // Speech Alerts (Smooth non-stuttering announcements)
    if (hazardLevel === 'stop') {
      if (lastLevel !== 'stop' || now - lastAlertSpeak > 5500) {
        lastAlertSpeak = now;
        speakStop(detectedObjects[0] || null);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    } else if (hazardLevel === 'caution') {
      if (lastLevel !== 'caution' && now - lastAlertSpeak > 6500) {
        lastAlertSpeak = now;
        let worstZone = 0;
        for (let i = 1; i < 3; i++) if (zonesThreat[i] > zonesThreat[worstZone]) worstZone = i;
        speakKey('caution_' + worstZone);
      }
    }
    lastLevel = hazardLevel;

    // Render Canvas Views
    const video = $('webcam');
    ctx.save();
    ctx.clearRect(0, 0, W, H);

    if (currentProfile === 'mild') {
      // Mild (20%): 1.25x zoom + contrast/brightness/colour boost + sharpening (no outlines)
      if (video.readyState >= 2) {
        enhanceFrame(video);
        ctx.drawImage(enC, 0, 0, W, H);
      }
    } else if (currentProfile === 'moderate') {
      // Moderate (60%): Clean Glowing Neon Edge Frame + 3D Grid + Dimmed Video
      if (video.readyState >= 2) {
        computeEdges(0, 255, 170, false); // Cleaned, noise-suppressed edges
        ctx.filter = 'brightness(0.48) contrast(1.25)';
        ctx.drawImage(video, 0, 0, W, H);
        ctx.filter = 'none';

        // Draw Glowing Neon Edges with clean bloom
        ctx.imageSmoothingEnabled = false;
        ctx.shadowColor = 'rgba(0, 255, 170, 0.9)';
        ctx.shadowBlur = 8;
        ctx.drawImage(edCanvas, 0, 0, W, H);
        ctx.shadowBlur = 0;
        ctx.imageSmoothingEnabled = true;
      }

      // Neon 3D Floor Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 1; i <= 6; i++) {
        const y = H * 0.35 + (H * 0.65) * Math.pow(i / 6, 1.6);
        ctx.moveTo(0, y); ctx.lineTo(W, y);
      }
      for (let i = 0; i <= 6; i++) {
        ctx.moveTo(W / 2, H * 0.35); ctx.lineTo((W / 6) * i, H);
      }
      ctx.stroke();

      // Heatmap Overlay per zone
      for (let i = 0; i < 3; i++) {
        if (zonesThreat[i] > 0.1) {
          ctx.fillStyle = zonesThreat[i] >= 0.6 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.25)';
          ctx.fillRect((i * W) / 3, H * 0.35, W / 3, H * 0.65);
        }
      }
    } else {
      // Severe (92%): Dark Blind Assist Radar (No distracting camera)
      ctx.fillStyle = '#06090e';
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2, cy = H - 20, R = H - 60;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.5;
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath(); ctx.arc(cx, cy, (R * r) / 3, Math.PI, 2 * Math.PI); ctx.stroke();
      }

      const angles = [Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3];
      for (let i = 0; i < 3; i++) {
        if (zonesThreat[i] > 0.08) {
          const r0 = Math.max(15, R * (1 - zonesThreat[i]));
          ctx.fillStyle = zonesThreat[i] >= 0.6 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(245, 158, 11, 0.6)';
          ctx.beginPath();
          ctx.arc(cx, cy, R, angles[i], angles[i] + Math.PI / 3);
          ctx.arc(cx, cy, r0, angles[i] + Math.PI / 3, angles[i], true);
          ctx.closePath();
          ctx.fill();
        }
      }
      const sweep = Math.PI + ((now / 1600) % 1) * Math.PI;
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(sweep), cy + R * Math.sin(sweep));
      ctx.stroke();
    }

    // Draw Bounding Boxes if not in Severe mode
    if (currentProfile !== 'severe') {
      for (const obj of detectedObjects) {
        let [bx, by, bw, bh] = obj.box;
        if (currentProfile === 'mild') {
          bx = (bx - 0.1) / 0.8; by = (by - 0.1) / 0.8;
          bw /= 0.8; bh /= 0.8;
        }
        const col = obj.cm < 130 ? '#ef4444' : (obj.cm < 195 ? '#f59e0b' : '#22c55e');
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.strokeRect(bx * W, by * H, bw * W, bh * H);

        const label = `${obj.name} ${(obj.cm / 100).toFixed(1)}m`;
        ctx.font = '800 14px Segoe UI, sans-serif';
        ctx.fillStyle = col;
        ctx.fillRect(bx * W, Math.max(20, by * H - 22), ctx.measureText(label).width + 12, 22);
        ctx.fillStyle = '#000';
        ctx.fillText(label, bx * W + 6, Math.max(20, by * H - 22) + 16);
      }
    }

    ctx.restore();
  } catch (err) {
    console.error('HUD Render Error:', err);
  }
}

/* ---------- STOP Siren (works even if the voice engine fails) ---------- */
function playTone(freq, startOffset, dur, vol, pan, type = 'square') {
  if (!audioUnlocked || !audioCtx) return;
  try {
    const t = audioCtx.currentTime + startOffset;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.setValueAtTime(vol, t + dur - 0.03);
    gain.gain.linearRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    if (audioCtx.createStereoPanner) {
      const panner = audioCtx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner); panner.connect(audioCtx.destination);
    } else {
      gain.connect(audioCtx.destination);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch (e) {}
}

function playStopSiren(pan) {
  // Two-tone urgent siren. Quieter while the voice is talking so both are heard.
  const talking = speechSynthesis.speaking || isSpeaking;
  const vol = talking ? 0.16 : 0.4;
  playTone(1100, 0,    0.17, vol, pan);
  playTone(750,  0.19, 0.17, vol, pan);
}

/* ---------- Smart 3D Audio Alert Loop ---------- */
setInterval(() => {
  if (!audioUnlocked || !audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});

  const maxThreat = Math.max(...zonesThreat);
  if (maxThreat < 0.08) return;

  let worstZone = 1;
  if (zonesThreat[0] > zonesThreat[1] && zonesThreat[0] > zonesThreat[2]) worstZone = 0;
  if (zonesThreat[2] > zonesThreat[0] && zonesThreat[2] > zonesThreat[1]) worstZone = 2;
  const pan = [-0.85, 0, 0.85][worstZone];

  // STOP zone: siren ALWAYS sounds in every profile, never blocked by speech
  if (isStopDistance()) { playStopSiren(pan); return; }

  // Mild & Moderate: spoken guidance only below STOP
  if (currentProfile !== 'severe') return;

  // Severe: spatial radar pings (silent while the voice is speaking)
  if (maxThreat < 0.25) return;
  if (speechSynthesis.speaking || isSpeaking) return;
  playSpatialBeep(380 + maxThreat * 800, pan, 0.08, 0.22);
}, 450);

/* ---------- Camera Management ---------- */
async function startCamera(facing = 'environment') {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
  }
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false
    });
    $('webcam').srcObject = videoStream;
    await $('webcam').play();
  } catch (err) {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      $('webcam').srcObject = videoStream;
      await $('webcam').play();
    } catch (e) {
      alert('Camera access denied: ' + e.message);
    }
  }
}

$('camFlipBtn').addEventListener('click', () => {
  currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
  startCamera(currentFacing);
});

/* ---------- Application Launch & Controls ---------- */
let launched = false;
window.launchApp = function() {
  if (launched) return;
  launched = true;
  const overlay = $('startOverlay');
  if (overlay) overlay.style.display = 'none';
  initAudio();
  speakKey('ready', true);
  startCamera(currentFacing);
  loadAI();
  requestAnimationFrame(renderHUD);
};

document.querySelectorAll('[data-p]').forEach(b => {
  b.addEventListener('click', () => {
    initAudio();
    currentProfile = b.dataset.p;
    document.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    speakKey('profile_' + currentProfile, true);
  });
});

document.querySelectorAll('[data-l]').forEach(b => {
  b.addEventListener('click', () => {
    initAudio();
    currentLang = b.dataset.l;
    badVoices.clear();               // re-selecting a language retries its voices
    refreshVoices(); updateVoiceInfo();
    document.querySelectorAll('[data-l]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (langAvailable(currentLang)) {
      speakKey('lang_change', true);
    } else {
      const name = LANG_LABEL[currentLang] === 'हिन्दी' ? 'Hindi' : 'Kannada';
      speak(() => name + ' voice is not installed on this device. Using English.', true);
    }
  });
});

$('speakStatusBtn').addEventListener('click', () => {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (detectedObjects.length > 0) {
    speakObstacle(detectedObjects[0], true);
  } else {
    speakKey('clear', true);
  }
});

window.setSim = function(cm) {
  $('simToggle').checked = true;
  $('simSlider').value = cm;
  $('simVal').textContent = cm + ' cm';
};

$('simSlider').addEventListener('input', (e) => {
  $('simVal').textContent = e.target.value + ' cm';
});

})();
