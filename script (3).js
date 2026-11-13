/* =========================================================
   HOLOVISION ASSIST — COMPLETE SCRIPT (CALIBRATED SCREEN-RATIO DISTANCE)
   Works with the supplied index.html
   ========================================================= */

"use strict";

// -------------------- DOM ELEMENTS --------------------

const video = document.getElementById("webcam");
const canvas = document.getElementById("hudCanvas");
const ctx = canvas.getContext("2d");

const stageWrap = document.getElementById("stageWrap");
const stopBanner = document.getElementById("stopBanner");

const aiBadge = document.getElementById("aiBadge");
const safetyBadge = document.getElementById("safetyBadge");

const statLevel = document.getElementById("statLevel");
const statObjs = document.getElementById("statObjs");
const statNear = document.getElementById("statNear");
const statFps = document.getElementById("statFps");
const statMs = document.getElementById("statMs");

const voiceInfo = document.getElementById("voiceInfo");

const valL = document.getElementById("valL");
const valC = document.getElementById("valC");
const valR = document.getElementById("valR");

const fillL = document.getElementById("fillL");
const fillC = document.getElementById("fillC");
const fillR = document.getElementById("fillR");

const simToggle = document.getElementById("simToggle");
const simSlider = document.getElementById("simSlider");
const simVal = document.getElementById("simVal");


// -------------------- APPLICATION STATE --------------------

let model = null;
let cameraStream = null;

let currentProfile = "moderate";
let currentLang = "en";

let cameraFacing = "environment";

let appStarted = false;
let detecting = false;
let detectionBusy = false;

let detectedObjects = [];

let lastDetectionTime = 0;
let lastFrameTime = 0;

let fps = 0;
let fpsFrames = 0;
let fpsStart = performance.now();

let simulatedDistance = 250;

let currentHazard = "CLEAR";

let zonesThreat = {
    left: 0,
    center: 0,
    right: 0
};

let lastSpokenKey = "";
let lastSpokenTime = 0;
let lastAlertTime = 0;
let lastAlertLevel = "CLEAR";
let lastObjectAnnouncement = 0;

let isSpeaking = false;
let speechAvailable = "speechSynthesis" in window;


// -------------------- LANGUAGE DATA --------------------

const LANGUAGES = {

    en: {
        name: "English",
        speechCode: "en-IN",

        clear: "Area appears clear. Please proceed carefully.",
        caution: "Caution. An object may be nearby.",
        stop: "Stop. An obstacle is within 200 centimeters.",
        noObjects: "No objects detected.",
        camera: "Camera is ready.",
        loading: "Artificial intelligence model is loading.",
        modelReady: "Object detection is ready.",
        cameraError: "Camera could not be started.",
        language: "English selected.",
        around: "Objects detected: ",
        distance: "Estimated distance from lens: ",
        spatial: (name, side, dist) => `${name} detected on the ${side}, approximately ${dist} away.`
    },

    hi: {
        name: "हिन्दी",
        speechCode: "hi-IN",

        clear: "आगे का क्षेत्र साफ दिखाई दे रहा है। सावधानी से आगे बढ़ें।",
        caution: "सावधान। पास में कोई वस्तु हो सकती है।",
        stop: "रुकिए। 200 सेंटीमीटर के भीतर बाधा मौजूद है।",
        noObjects: "कोई वस्तु नहीं मिली।",
        camera: "कैमरा तैयार है।",
        loading: "कृत्रिम बुद्धिमत्ता मॉडल लोड हो रहा है।",
        modelReady: "वस्तु पहचान प्रणाली तैयार है।",
        cameraError: "कैमरा शुरू नहीं हो सका।",
        language: "हिन्दी चुनी गई है।",
        around: "पहचानी गई वस्तुएँ: ",
        distance: "लेंस से अनुमानित दूरी: ",
        spatial: (name, side, dist) => `${side} पर ${name} है, लगभग ${dist} दूर।`
    },

    kn: {
        name: "ಕನ್ನಡ",
        speechCode: "kn-IN",

        clear: "ಮುಂದಿನ ಪ್ರದೇಶ ಖಾಲಿಯಾಗಿದೆ ಎಂದು ಕಾಣುತ್ತದೆ. ಎಚ್ಚರಿಕೆಯಿಂದ ಮುಂದುವರಿಯಿರಿ.",
        caution: "ಎಚ್ಚರಿಕೆ. ಹತ್ತಿರದಲ್ಲಿ ವಸ್ತು ಇರಬಹುದು.",
        stop: "ನಿಲ್ಲಿಸಿ. 200 ಸೆಂಟಿಮೀಟರ್ ಒಳಗೆ ತಡೆಗೋಡೆ ಇದೆ.",
        noObjects: "ಯಾವುದೇ ವಸ್ತು ಪತ್ತೆಯಾಗಿಲ್ಲ.",
        camera: "ಕ್ಯಾಮೆರಾ ಸಿದ್ಧವಾಗಿದೆ.",
        loading: "ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಮಾದರಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ.",
        modelReady: "ವಸ್ತು ಪತ್ತೆ ವ್ಯವಸ್ಥೆ ಸಿದ್ಧವಾಗಿದೆ.",
        cameraError: "ಕ್ಯಾಮೆರಾವನ್ನು ಪ್ರಾರಂಭಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.",
        language: "ಕನ್ನಡ ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ.",
        around: "ಪತ್ತೆಯಾದ ವಸ್ತುಗಳು: ",
        distance: "ಲೆನ್ಸ್‌ನಿಂದ ಅಂದಾಜು ದೂರ: ",
        spatial: (name, side, dist) => `${side}ಯಲ್ಲಿ ${name} ಇದೆ, ಸುಮಾರು ${dist} ದೂರದಲ್ಲಿದೆ.`
    }
};

const SIDE_NAMES = {
    en: { left: "left side", center: "ahead", right: "right side" },
    hi: { left: "बाईं ओर", center: "सामने", right: "दाईं ओर" },
    kn: { left: "ಎಡಭಾಗದಲ್ಲಿ", center: "ಮುಂದೆ", right: "ಬಲಭಾಗದಲ್ಲಿ" }
};


// -------------------- UI STATIC STRINGS TRANSLATIONS --------------------

const UI_STRINGS = {
    en: {
        brand: "HoloVision Assist",
        flipCam: "Flip Camera",
        stopBanner: "STOP — OBSTACLE WITHIN 200 CM",
        profileTitle: "Vision Impairment Profile",
        profileMild: "Mild<br><small>Enhanced view</small>",
        profileModerate: "Moderate<br><small>Neon Edges</small>",
        profileSevere: "Severe<br><small>92% Radar</small>",
        voiceTitle: "Voice Navigation & Alerts",
        btnEn: "English",
        btnHi: "हिन्दी",
        btnKn: "ಕನ್ನಡ",
        whatIsAround: "What is around me?",
        telemetryTitle: "Live Telemetry",
        statHazard: "Hazard Level",
        statObjs: "Obstacle Count",
        statNear: "Closest Obstacle",
        statFps: "Processing FPS",
        statMs: "AI Latency",
        simTitle: "Demo Distance Simulator",
        simToggleText: " Enable Simulated Distance Sensor",
        simDistanceText: "Distance Ahead:",
        simClear: "Clear 250",
        simCaution: "Caution 160",
        simStop: "STOP 100",
        simNotice: "Use this to easily demo STOP and CAUTION alarms during a presentation without moving around."
    },
    hi: {
        brand: "होलोविज़न असिस्ट",
        flipCam: "कैमरा पलटें",
        stopBanner: "रुकिए — 200 सेमी के भीतर बाधा",
        profileTitle: "दृष्टिबाधा प्रोफ़ाइल",
        profileMild: "हल्का<br><small>उन्नत दृश्य</small>",
        profileModerate: "मध्यम<br><small>नियॉन किनारे</small>",
        profileSevere: "गंभीर<br><small>92% रडार</small>",
        voiceTitle: "वॉइस नेविगेशन और अलर्ट",
        btnEn: "English",
        btnHi: "हिन्दी",
        btnKn: "ಕನ್ನಡ",
        whatIsAround: "मेरे आस-पास क्या है?",
        telemetryTitle: "लाइव टेलीमेट्री",
        statHazard: "खतरे का स्तर",
        statObjs: "बाधाओं की संख्या",
        statNear: "सबसे निकटतम बाधा",
        statFps: "प्रोसेसिंग FPS",
        statMs: "AI विलंबता",
        simTitle: "डेमो दूरी सिम्युलेटर",
        simToggleText: " सिम्युलेटेड डिस्टेंस सेंसर सक्षम करें",
        simDistanceText: "सामने की दूरी:",
        simClear: "साफ 250",
        simCaution: "सावधान 160",
        simStop: "रुकिए 100",
        simNotice: "प्रस्तुति के दौरान बिना इधर-उधर घूमे आसानी से स्टॉप और कॉशन अलार्म का डेमो देने के लिए इसका उपयोग करें।"
    },
    kn: {
        brand: "ಹೊಲೊವಿಷನ್ ಅಸಿಸ್ಟ್",
        flipCam: "ಕ್ಯಾಮೆರಾ ತಿರುಗಿಸಿ",
        stopBanner: "ನಿಲ್ಲಿಸಿ — 200 ಸೆಂ.ಮೀ ಒಳಗೆ ತಡೆ",
        profileTitle: "ದೃಷ್ಟಿ ದೋಷ ಪ್ರೊಫೈಲ್",
        profileMild: "ಸೌಮ್ಯ<br><small>ವರ್ಧಿತ ವೀಕ್ಷಣೆ</small>",
        profileModerate: "ಮಧ್ಯಮ<br><small>ನಿಯಾನ್ ಅಂಚುಗಳು</small>",
        profileSevere: "ತೀವ್ರ<br><small>92% ರಾಡಾರ್</small>",
        voiceTitle: "ಧ್ವನಿ ನ್ಯಾವಿಗೇಷನ್ ಮತ್ತು ಎಚ್ಚರಿಕೆಗಳು",
        btnEn: "English",
        btnHi: "हिन्दी",
        btnKn: "ಕನ್ನಡ",
        whatIsAround: "ನನ್ನ ಸುತ್ತಲೂ ಏನಿದೆ?",
        telemetryTitle: "ಲೈವ್ ದೂರಮಾಪನ",
        statHazard: "ಅಪಾಯದ ಮಟ್ಟ",
        statObjs: "ಅಡೆತಡೆಗಳ ಸಂಖ್ಯೆ",
        statNear: "ಹತ್ತಿರದ ಅಡೆತಡೆ",
        statFps: "ಪ್ರೊಸೆಸಿಂಗ್ FPS",
        statMs: "AI ಲೇಟೆನ್ಸಿ",
        simTitle: "ಡೆಮೋ ದೂರ ಸಿಮ್ಯುಲೇಟರ್",
        simToggleText: " ಸಿಮ್ಯುೇಟೆಡ್ ದೂರ ಸಂವೇದಕವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ",
        simDistanceText: "ಮುಂದಿನ ದೂರ:",
        simClear: "ತೆರವು 250",
        simCaution: "ಎಚ್ಚರಿಕೆ 160",
        simStop: "ನಿಲ್ಲಿಸಿ 100",
        simNotice: "ಪ್ರಸ್ತುತಿಯ ಸಮಯದಲ್ಲಿ ಅತಿಯಾಗಿ ಓಡಾಡದೆ ಸ್ಟಾಪ್ ಮತ್ತು ಎಚ್ಚರಿಕೆ ಅಲಾರಮ್‌ಗಳನ್ನು ತೋರಿಸಲು ಇದನ್ನು ಬಳಸಿ."
    }
};

function updateInterfaceText() {
    const t = UI_STRINGS[currentLang];
    if (!t) return;

    document.getElementById("camFlipBtn").textContent = t.flipCam;
    document.getElementById("stopBanner").textContent = t.stopBanner;
    document.getElementById("speakStatusBtn").textContent = t.whatIsAround;
    
    const cards = document.querySelectorAll("aside .card");
    if (cards.length >= 4) {
        cards[0].querySelector("h2").innerHTML = t.profileTitle;
        cards[1].querySelector("h2").innerHTML = t.voiceTitle;
        cards[2].querySelector("h2").innerHTML = t.telemetryTitle;
        cards[3].querySelector("h2").innerHTML = t.simTitle;
        
        cards[3].querySelector(".toggle").lastChild.nodeValue = t.simToggleText;
        cards[3].querySelector(".row span:first-child").textContent = t.simDistanceText;
        cards[3].querySelector(".notice").textContent = t.simNotice;
        
        const simBtns = cards[3].querySelectorAll(".btn-grid button");
        if(simBtns.length >= 3) {
            simBtns[0].textContent = t.simClear;
            simBtns[1].textContent = t.simCaution;
            simBtns[2].textContent = t.simStop;
        }
    }

    const dtList = document.querySelectorAll(".stats dt");
    if (dtList.length >= 5) {
        dtList[0].textContent = t.statHazard;
        dtList[1].textContent = t.statObjs;
        dtList[2].textContent = t.statNear;
        dtList[3].textContent = t.statFps;
        dtList[4].textContent = t.statMs;
    }
}


// COCO-SSD object labels translated for announcements.

const OBJECT_NAMES = {

    en: {
        person: "person",
        chair: "chair",
        car: "car",
        bicycle: "bicycle",
        motorcycle: "motorcycle",
        bus: "bus",
        truck: "truck",
        dog: "dog",
        cat: "cat",
        bottle: "bottle",
        backpack: "backpack",
        handbag: "handbag",
        suitcase: "suitcase",
        bench: "bench",
        dining_table: "table",
        couch: "sofa",
        potted_plant: "plant"
    },

    hi: {
        person: "व्यक्ति",
        chair: "कुर्सी",
        car: "कार",
        bicycle: "साइकिल",
        motorcycle: "मोटरसाइकिल",
        bus: "बस",
        truck: "ट्रक",
        dog: "कुत्ता",
        cat: "बिल्ली",
        bottle: "बोतल",
        backpack: "बैग",
        handbag: "हैंडबैग",
        suitcase: "सूटकेस",
        bench: "बेंच",
        dining_table: "मेज",
        couch: "सोफा",
        potted_plant: "पौधा"
    },

    kn: {
        person: "ವ್ಯಕ್ತಿ",
        chair: "ಕುರ್ಚಿ",
        car: "ಕಾರು",
        bicycle: "ಬೈಸಿಕಲ್",
        motorcycle: "ಮೋಟಾರ್ ಸೈಕಲ್",
        bus: "ಬಸ್",
        truck: "ಟ್ರಕ್",
        dog: "ನಾಯಿ",
        cat: "ಬೆಕ್ಕು",
        bottle: "ಬಾಟಲಿ",
        backpack: "ಚೀಲ",
        handbag: "ಕೈಚೀಲ",
        suitcase: "ಸೂಟ್‌ಕೇಸ್",
        bench: "ಬೆಂಚ್",
        dining_table: "ಮೇಜು",
        couch: "ಸೋಫಾ",
        potted_plant: "ಗಿಡ"
    }
};


// -------------------- SPEECH ENGINE (ROBUST & FAIL-SAFE) --------------------

let availableVoices = [];
let speechTimeout = null;

function refreshVoices() {
    if (!speechAvailable) {
        voiceInfo.textContent = "Speech synthesis is not supported.";
        return;
    }
    availableVoices = speechSynthesis.getVoices();
    const preferred = LANGUAGES[currentLang].speechCode;
    const found = availableVoices.some(v =>
        v.lang.toLowerCase().startsWith(preferred.toLowerCase())
    );

    voiceInfo.textContent = found
        ? "Voice available: " + LANGUAGES[currentLang].name
        : "Using available system voice. Language support may vary.";
}

if (speechAvailable) {
    speechSynthesis.onvoiceschanged = refreshVoices;
    refreshVoices();
}


function speak(message, force = false, priority = false) {
    if (!speechAvailable || !message) return;
    const now = Date.now();

    if (message === lastSpokenKey && now - lastSpokenTime < 3000 && !force) {
        return;
    }

    if (isSpeaking && !force && !priority) {
        return;
    }

    if (force || priority) {
        speechSynthesis.cancel();
        isSpeaking = false;
        if (speechTimeout) clearTimeout(speechTimeout);
    }

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = LANGUAGES[currentLang].speechCode;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;

    const matchingVoice = availableVoices.find(v =>
        v.lang.toLowerCase().startsWith(
            LANGUAGES[currentLang].speechCode.toLowerCase()
        )
    );

    if (matchingVoice) {
        utterance.voice = matchingVoice;
    }

    utterance.onstart = () => { 
        isSpeaking = true; 
        if (speechTimeout) clearTimeout(speechTimeout);
        speechTimeout = setTimeout(() => { isSpeaking = false; }, 5000);
    };
    utterance.onend = () => { 
        isSpeaking = false; 
        if (speechTimeout) clearTimeout(speechTimeout);
    };
    utterance.onerror = () => { 
        isSpeaking = false; 
        if (speechTimeout) clearTimeout(speechTimeout);
    };

    lastSpokenKey = message;
    lastSpokenTime = now;

    speechSynthesis.speak(utterance);
}


function speakKey(key, force = false) {
    speak(LANGUAGES[currentLang][key], force);
}


function speakSpatialObject(object) {
    if (!object) return;
    const label = OBJECT_NAMES[currentLang][object.class] || object.class;
    
    let sideKey = "center";
    const position = object.centerX / video.videoWidth;
    if (position < 0.33) sideKey = "left";
    else if (position > 0.66) sideKey = "right";

    const sideText = SIDE_NAMES[currentLang][sideKey];
    const distText = Math.round(object.distance) + " cm";

    const message = LANGUAGES[currentLang].spatial(label, sideText, distText);
    speak(message, false, true);
}


function cancelAlertSpeech() {
    if (speechAvailable) {
        speechSynthesis.cancel();
    }
    isSpeaking = false;
    if (speechTimeout) clearTimeout(speechTimeout);
}


// -------------------- LANGUAGE SELECTION --------------------

document.querySelectorAll("[data-l]").forEach(button => {
    button.addEventListener("click", () => {
        currentLang = button.dataset.l;

        document.querySelectorAll("[data-l]").forEach(btn => {
            btn.setAttribute(
                "aria-pressed",
                btn.dataset.l === currentLang ? "true" : "false"
            );
        });

        cancelAlertSpeech();
        lastSpokenKey = "";
        lastAlertLevel = "";

        refreshVoices();
        updateInterfaceText();
        speakKey("language", true);
    });
});


// -------------------- PROFILE SELECTION --------------------

document.querySelectorAll("[data-p]").forEach(button => {
    button.addEventListener("click", () => {
        currentProfile = button.dataset.p;

        document.querySelectorAll("[data-p]").forEach(btn => {
            btn.setAttribute(
                "aria-pressed",
                btn.dataset.p === currentProfile ? "true" : "false"
            );
        });
    });
});


// -------------------- CAMERA INITIALIZATION --------------------

async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Camera access is not supported by this browser.");
        return false;
    }

    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: cameraFacing,
                width: { ideal: 640 },
                height: { ideal: 360 }
            },
            audio: false
        });

        video.srcObject = cameraStream;
        await video.play();
        return true;
    } catch (error) {
        console.error("Camera error:", error);
        speakKey("cameraError", true);
        alert("Unable to access the camera. Please allow camera permission.");
        return false;
    }
}


// -------------------- CAMERA FLIP --------------------

document.getElementById("camFlipBtn").addEventListener("click", async () => {
    cameraFacing = cameraFacing === "environment" ? "user" : "environment";
    await startCamera();
});


// -------------------- MODEL INITIALIZATION --------------------

async function loadModel() {
    try {
        if (typeof cocoSsd === "undefined") {
            throw new Error("COCO-SSD library not found.");
        }

        aiBadge.textContent = "AI Loading...";
        aiBadge.className = "badge warn";

        model = await cocoSsd.load({
            base: "lite_mobilenet_v2"
        });

        aiBadge.textContent = "AI Ready";
        aiBadge.className = "badge ok";
        speakKey("modelReady");
        return true;
    } catch (error) {
        console.error("Model loading error:", error);
        aiBadge.textContent = "AI Error";
        aiBadge.className = "badge warn";
        return false;
    }
}


// -------------------- START APPLICATION --------------------

async function launchApp() {
    if (appStarted) return;
    appStarted = true;

    const cameraReady = await startCamera();
    if (!cameraReady) {
        appStarted = false;
        return;
    }

    speakKey("camera");

    const modelReady = await loadModel();
    if (!modelReady) {
        alert("AI model could not load. Check your internet connection and vendor files.");
        appStarted = false;
        return;
    }

    detecting = true;
    requestAnimationFrame(detectionLoop);
    requestAnimationFrame(renderLoop);
}
window.launchApp = launchApp;


// -------------------- CALIBRATED DISTANCE FROM CAMERA LENS --------------------

function estimateDistance(className, boxHeight) {
    const vHeight = video.videoHeight || 360;
    // Ratio of bounding box height to total camera view height
    const ratio = Math.min(1.0, boxHeight / vHeight);
    
    // Screen-coverage calibration: 
    // Small box (far away) -> ~450 cm
    // Large box filling the screen (close to lens) -> ~35-50 cm
    const distance = 440 * Math.pow(1 - ratio, 1.4) + 30;
    return Math.max(30, Math.min(500, Math.round(distance)));
}


// -------------------- OBJECT DETECTION --------------------

async function detectionLoop() {
    if (!detecting) return;

    if (model && video.readyState >= 2 && !detectionBusy) {
        detectionBusy = true;
        const start = performance.now();

        try {
            const predictions = await model.detect(video, 6, 0.40);

            detectedObjects = predictions.map(prediction => {
                const [x, y, width, height] = prediction.bbox;
                const distance = estimateDistance(prediction.class, height);

                return {
                    class: prediction.class,
                    score: prediction.score,
                    x, y, width, height,
                    centerX: x + width / 2,
                    centerY: y + height / 2,
                    distance
                };
            });

            lastDetectionTime = Date.now();
            const latency = performance.now() - start;
            statMs.textContent = Math.round(latency) + " ms";

            updateThreatZones();
            updateHazard();
        } catch (error) {
            console.error("Detection error:", error);
        }

        detectionBusy = false;
    }

    setTimeout(() => {
        requestAnimationFrame(detectionLoop);
    }, 100);
}


// -------------------- THREAT ZONES --------------------

function updateThreatZones() {
    zonesThreat = { left: 0, center: 0, right: 0 };

    detectedObjects.forEach(object => {
        const position = object.centerX / video.videoWidth;
        let threat = Math.max(0, Math.min(100, (250 - object.distance) / 2.5));

        if (position < 0.33) {
            zonesThreat.left = Math.max(zonesThreat.left, threat);
        } else if (position > 0.66) {
            zonesThreat.right = Math.max(zonesThreat.right, threat);
        } else {
            zonesThreat.center = Math.max(zonesThreat.center, threat);
        }
    });

    if (simToggle.checked) {
        const simThreat = Math.max(0, Math.min(100, (250 - simulatedDistance) / 2.5));
        zonesThreat.center = Math.max(zonesThreat.center, simThreat);
    }

    updateZoneDisplay();
}


function updateZoneDisplay() {
    valL.textContent = Math.round(zonesThreat.left) + "%";
    valC.textContent = Math.round(zonesThreat.center) + "%";
    valR.textContent = Math.round(zonesThreat.right) + "%";

    fillL.style.width = zonesThreat.left + "%";
    fillC.style.width = zonesThreat.center + "%";
    fillR.style.width = zonesThreat.right + "%";
}


// -------------------- HAZARD LEVEL (STOP WITHIN 200 CM) --------------------

function getClosestDistance() {
    let closest = detectedObjects.length
        ? Math.min(...detectedObjects.map(o => o.distance))
        : 500;

    if (simToggle.checked) {
        closest = Math.min(closest, simulatedDistance);
    }

    return closest;
}


function updateHazard() {
    const closest = getClosestDistance();
    let level = "CLEAR";

    // Stop warning triggers when obstacle is within 200 cm
    if (closest <= 200) {
        level = "STOP";
    } else if (closest <= 300) {
        level = "CAUTION";
    }

    currentHazard = level;
    statLevel.textContent = level;
    statObjs.textContent = detectedObjects.length;
    statNear.textContent = closest >= 500 ? "—" : Math.round(closest) + " cm";

    if (level === "STOP") {
        safetyBadge.textContent = "STOP";
        safetyBadge.className = "badge bad";
        stageWrap.classList.add("danger");
        stageWrap.classList.remove("clear", "caution");
        stopBanner.style.display = "block";
    } else if (level === "CAUTION") {
        safetyBadge.textContent = "CAUTION";
        safetyBadge.className = "badge warn";
        stageWrap.classList.add("caution");
        stageWrap.classList.remove("clear", "danger");
        stopBanner.style.display = "none";
    } else {
        safetyBadge.textContent = "CLEAR";
        safetyBadge.className = "badge ok";
        stageWrap.classList.add("clear");
        stageWrap.classList.remove("danger", "caution");
        stopBanner.style.display = "none";
    }

    announceHazard(level);
}


// -------------------- LIVE VOICE ANNOUNCEMENTS --------------------

function announceHazard(level) {
    const now = Date.now();

    if (level !== lastAlertLevel && now - lastAlertTime > 2500) {
        lastAlertLevel = level;
        lastAlertTime = now;

        if (level === "STOP") {
            speakKey("stop", true);
            return;
        }
        if (level === "CAUTION") {
            speakKey("caution", true);
            return;
        }
        if (level === "CLEAR" && currentProfile !== "severe") {
            speakKey("clear");
            return;
        }
    }

    if (detectedObjects.length && now - lastObjectAnnouncement > 4000 && !isSpeaking) {
        const nearest = [...detectedObjects].sort((a, b) => a.distance - b.distance)[0];
        lastObjectAnnouncement = now;
        speakSpatialObject(nearest);
    }
}


// -------------------- SIMULATOR --------------------

function setSim(distance) {
    simulatedDistance = Number(distance);
    simSlider.value = simulatedDistance;
    simVal.textContent = simulatedDistance + " cm";

    if (simToggle.checked) {
        updateThreatZones();
        updateHazard();
    }
}
window.setSim = setSim;


simSlider.addEventListener("input", () => {
    setSim(simSlider.value);
});


simToggle.addEventListener("change", () => {
    updateThreatZones();
    updateHazard();
});


// -------------------- STATUS BUTTON --------------------

document.getElementById("speakStatusBtn").addEventListener("click", () => {
    if (!detectedObjects.length && !simToggle.checked) {
        speakKey("noObjects", true);
        return;
    }

    const nearest = [...detectedObjects].sort((a, b) => a.distance - b.distance)[0];
    if (nearest) {
        speakSpatialObject(nearest);
    } else {
        speakKey("clear", true);
    }
});


// -------------------- EDGE FILTER ENGINE FOR MODERATE PROFILE --------------------

const EW = 240, EH = 135, EN = EW * EH;
const edCanvas = document.createElement('canvas'); edCanvas.width = EW; edCanvas.height = EH;
const edCtx = edCanvas.getContext('2d', { willReadFrequently: true });
const edInCanvas = document.createElement('canvas'); edInCanvas.width = EW; edInCanvas.height = EH;
const edInCtx = edInCanvas.getContext('2d', { willReadFrequently: true });
const edImg = edCtx.createImageData(EW, EH);
const rawGray = new Float32Array(EN);
const cleanGray = new Float32Array(EN);

function computeEdges(r, g, b) {
  if (!video || video.readyState < 2) return;
  edInCtx.drawImage(video, 0, 0, EW, EH);
  const data = edInCtx.getImageData(0, 0, EW, EH).data;
  const out = edImg.data;

  for (let i = 0, j = 0; j < EN; i += 4, j++) {
    rawGray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

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

  for (let y = 1; y < EH - 1; y++) {
    const row = y * EW;
    for (let x = 1; x < EW - 1; x++) {
      const j = row + x, k = j * 4;
      const tl = cleanGray[j - EW - 1], t = cleanGray[j - EW], tr = cleanGray[j - EW + 1];
      const l = cleanGray[j - 1],                         ri = cleanGray[j + 1];
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


// -------------------- HUD & PROFILES RENDER LOOP --------------------

function renderLoop() {
    if (!video.videoWidth || !video.videoHeight) {
        requestAnimationFrame(renderLoop);
        return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;
    const H = canvas.height;

    // PROFILE 1: SEVERE (Tactical Radar Sweep Scope View)
    if (currentProfile === "severe") {
        ctx.fillStyle = "#02040a";
        ctx.fillRect(0, 0, W, H);

        const centerX = W / 2;
        const centerY = H * 0.8;
        const maxRadius = Math.min(W, H) * 0.6;

        // Draw Radar Concentric Distance Rings
        ctx.strokeStyle = "rgba(0, 255, 204, 0.25)";
        ctx.lineWidth = 1;
        for (let r = 1; r <= 3; r++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, (maxRadius / 3) * r, Math.PI, 0, false);
            ctx.stroke();
        }

        // Draw Radar Crosshair Axis Lines
        ctx.beginPath();
        ctx.moveTo(centerX - maxRadius, centerY);
        ctx.lineTo(centerX + maxRadius, centerY);
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - maxRadius);
        ctx.stroke();

        // Draw Threat Sector Fills (Left, Center, Right)
        const cThreat = zonesThreat.center || 0;
        const lThreat = zonesThreat.left || 0;
        const rThreat = zonesThreat.right || 0;

        // Center Sector
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, Math.PI * 1.2, Math.PI * 1.8, false);
        ctx.closePath();
        ctx.fillStyle = cThreat > 50 ? "rgba(239, 68, 68, 0.35)" : (cThreat > 20 ? "rgba(245, 158, 11, 0.3)" : "rgba(0, 255, 204, 0.1)");
        ctx.fill();

        // Left Sector
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, Math.PI * 1.0, Math.PI * 1.2, false);
        ctx.closePath();
        ctx.fillStyle = lThreat > 30 ? "rgba(245, 158, 11, 0.3)" : "rgba(0, 255, 204, 0.08)";
        ctx.fill();

        // Right Sector
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, Math.PI * 1.8, Math.PI * 2.0, false);
        ctx.closePath();
        ctx.fillStyle = rThreat > 30 ? "rgba(245, 158, 11, 0.3)" : "rgba(0, 255, 204, 0.08)";
        ctx.fill();

        // Draw Radar Sweeping Line Animation
        const sweepAngle = (performance.now() / 450) % Math.PI;
        ctx.strokeStyle = "rgba(0, 255, 204, 0.9)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + Math.cos(Math.PI + sweepAngle) * maxRadius, centerY + Math.sin(Math.PI + sweepAngle) * maxRadius);
        ctx.stroke();

        // Render Obstacle Blips on Radar Scope
        detectedObjects.forEach(obj => {
            const normalizedDist = Math.min(1, obj.distance / 500);
            const r = maxRadius * normalizedDist;
            const angle = Math.PI + (obj.centerX / W) * Math.PI;
            const bx = centerX + Math.cos(angle) * r;
            const by = centerY + Math.sin(angle) * r;

            const isClose = obj.distance <= 200;
            ctx.fillStyle = isClose ? "#ef4444" : "#00ffcc";
            ctx.beginPath();
            ctx.arc(bx, by, isClose ? 7 : 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Label Blip
            ctx.font = "bold 10px monospace";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`${Math.round(obj.distance)}cm`, bx + 8, by);
        });

        requestAnimationFrame(renderLoop);
        return;
    }

    // PROFILE 2: MODERATE / MILD (Neon Edge Filter or Enhanced Video)
    ctx.save();
    if (currentProfile === "mild") {
        ctx.filter = 'contrast(1.4) brightness(1.15) saturate(1.25)';
        ctx.drawImage(video, 0, 0, W, H);
    } else if (currentProfile === "moderate") {
        ctx.filter = 'brightness(0.45) contrast(1.3)';
        ctx.drawImage(video, 0, 0, W, H);
        ctx.filter = 'none';

        computeEdges(0, 255, 170);

        ctx.imageSmoothingEnabled = false;
        ctx.shadowColor = 'rgba(0, 255, 170, 0.9)';
        ctx.shadowBlur = 8;
        ctx.drawImage(edCanvas, 0, 0, W, H);
        ctx.shadowBlur = 0;
        ctx.imageSmoothingEnabled = true;
    }
    ctx.restore();

    // Calculate FPS
    fpsFrames++;
    const now = performance.now();
    if (now - fpsStart >= 1000) {
        fps = Math.round((fpsFrames * 1000) / (now - fpsStart));
        statFps.textContent = fps + " fps";
        fpsFrames = 0;
        fpsStart = now;
    }

    // Draw Bounding Boxes & Object Labels over video
    detectedObjects.forEach(obj => {
        const localizedLabel = OBJECT_NAMES[currentLang][obj.class] || obj.class;
        const isClose = obj.distance <= 200;
        const col = isClose ? "#ef4444" : "#00ffcc";

        ctx.strokeStyle = col;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(obj.x, obj.y > 22 ? obj.y - 22 : 0, 150, 22);

        ctx.fillStyle = col;
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(`${localizedLabel} (${Math.round(obj.distance)}cm)`, obj.x + 6, obj.y > 22 ? obj.y - 7 : 15);
    });

    requestAnimationFrame(renderLoop);
}