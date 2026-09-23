/**
 * AudioTriad - Multi-Device Audio Splitter & Movie Sync
 * Core Audio Engine & UI Controller
 */

class AudioTriadEngine {
    constructor() {
        this.audioCtx = null;
        this.mediaSourceNode = null;
        this.systemStreamNode = null;
        this.masterAnalyser = null;
        
        // 3 Channels (0: AUX, 1: Type-C, 2: Bluetooth)
        this.channels = [
            { id: 'aux', name: 'AUX / 3.5mm', gainNode: null, delayNode: null, analyserNode: null, audioEl: null, sinkId: '', volume: 1.0, delayMs: 0, isMuted: false },
            { id: 'typec', name: 'USB Type-C', gainNode: null, delayNode: null, analyserNode: null, audioEl: null, sinkId: '', volume: 1.0, delayMs: 0, isMuted: false },
            { id: 'bt', name: 'Bluetooth', gainNode: null, delayNode: null, analyserNode: null, audioEl: null, sinkId: '', volume: 1.0, delayMs: 0, isMuted: false }
        ];

        this.availableDevices = [];
        this.activeMode = 'movie'; // 'movie' or 'system'
        this.systemMediaStream = null;

        this.initElements();
        this.initAudioContext();
        this.bindEvents();
        this.setupVisualizer();
        this.loadAudioDevices();
    }

    initElements() {
        // DOM Elements
        this.videoEl = document.getElementById('videoElement');
        this.dropZone = document.getElementById('dropZone');
        this.dropOverlay = document.getElementById('dropOverlay');
        this.fileInput = document.getElementById('fileInput');
        this.btnBrowseFile = document.getElementById('btnBrowseFile');

        // Audio & Subtitle Track Selectors
        this.selectAudioTrack = document.getElementById('selectAudioTrack');
        this.selectSubtitleTrack = document.getElementById('selectSubtitleTrack');
        this.subFileInput = document.getElementById('subFileInput');
        this.btnLoadSubtitle = document.getElementById('btnLoadSubtitle');

        
        // Controls
        this.btnPlayPause = document.getElementById('btnPlayPause');
        this.iconPlay = document.getElementById('iconPlay');
        this.iconPause = document.getElementById('iconPause');
        this.seekSlider = document.getElementById('seekSlider');
        this.seekProgress = document.getElementById('seekProgress');
        this.currentTimeEl = document.getElementById('currentTime');
        this.durationTimeEl = document.getElementById('durationTime');
        this.btnFullscreen = document.getElementById('btnFullscreen');
        
        // Tabs
        this.tabMovie = document.getElementById('tabMovie');
        this.tabSystem = document.getElementById('tabSystem');
        this.movieContainer = document.getElementById('moviePlayerContainer');
        this.systemContainer = document.getElementById('systemAudioContainer');

        // System Capture
        this.btnStartSystemCapture = document.getElementById('btnStartSystemCapture');
        this.btnStopSystemCapture = document.getElementById('btnStopSystemCapture');
        this.systemCaptureStatus = document.getElementById('systemCaptureStatus');

        // Header Buttons & Activation
        this.activationBanner = document.getElementById('activationBanner');
        this.btnEnableAudio = document.getElementById('btnEnableAudio');
        this.btnRefreshDevices = document.getElementById('btnRefreshDevices');
        this.btnAutoAssign = document.getElementById('btnAutoAssign');
        this.audioStatusText = document.getElementById('audioStatusText');

        
        const resumeAudio = () => {
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume().then(() => {
                    console.log('AudioContext resumed!');
                    if (this.activationBanner) this.activationBanner.style.display = 'none';
                    this.audioStatusText.textContent = 'Audio Engine Active & Ready';
                });
            } else if (this.activationBanner) {
                this.activationBanner.style.display = 'none';
            }
        };

        if (this.btnEnableAudio) {
            this.btnEnableAudio.addEventListener('click', resumeAudio);
        }

        // Global click listener to unlock web audio context on any user interaction
        document.addEventListener('click', resumeAudio, { once: true });
        document.addEventListener('touchstart', resumeAudio, { once: true });


        // Canvas
        this.canvas = document.getElementById('visualizerCanvas');
        this.canvasCtx = this.canvas.getContext('2d');

        // Create hidden audio element sinks for each of the 3 channels
        this.channels.forEach((ch, idx) => {
            const el = document.createElement('audio');
            el.id = `audioSink_${ch.id}`;
            el.autoplay = true;
            el.style.display = 'none';
            document.body.appendChild(el);
            ch.audioEl = el;
        });
    }

    initAudioContext() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        // Master Analyser Node
        this.masterAnalyser = this.audioCtx.createAnalyser();
        this.masterAnalyser.fftSize = 64;

        // Connect each channel node graph
        this.channels.forEach((ch) => {
            ch.gainNode = this.audioCtx.createGain();
            ch.delayNode = this.audioCtx.createDelay(5.0); // Up to 5 sec max delay
            ch.analyserNode = this.audioCtx.createAnalyser();
            ch.analyserNode.fftSize = 32;

            ch.delayNode.delayTime.value = 0;
            ch.gainNode.gain.value = ch.volume;

            // Route: Channel Gain -> Channel Delay -> Channel Analyser -> MediaStreamDestination -> Audio HTML Element with setSinkId
            const destNode = this.audioCtx.createMediaStreamDestination();
            
            ch.gainNode.connect(ch.delayNode);
            ch.delayNode.connect(ch.analyserNode);
            ch.delayNode.connect(destNode);

            ch.audioEl.srcObject = destNode.stream;
            ch.audioEl.play().catch(e => console.log('Audio sink play ready', e));
        });

        // Setup MediaElementSource for Video Element
        this.mediaSourceNode = this.audioCtx.createMediaElementSource(this.videoEl);
        
        // Connect Source to Master Analyser and Channels
        this.mediaSourceNode.connect(this.masterAnalyser);
        this.channels.forEach(ch => {
            this.mediaSourceNode.connect(ch.gainNode);
        });
    }

    async loadAudioDevices() {
        try {
            // Request permissions if needed to reveal device labels
            await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => {});
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableDevices = devices.filter(d => d.kind === 'audiooutput');
            
            console.log('Detected Audio Output Devices:', this.availableDevices);
            this.populateSelectDropdowns();
            this.autoAssignDevices();
            this.audioStatusText.textContent = `${this.availableDevices.length} Output Devices Found`;
        } catch (err) {
            console.error('Error enumerating devices:', err);
            this.audioStatusText.textContent = 'Device Detection Error';
        }
    }

    populateSelectDropdowns() {
        const selects = [
            document.getElementById('selectDeviceAux'),
            document.getElementById('selectDeviceTypeC'),
            document.getElementById('selectDeviceBT')
        ];

        selects.forEach((selectEl, idx) => {
            selectEl.innerHTML = '';
            
            const defaultOpt = document.createElement('option');
            defaultOpt.value = 'default';
            defaultOpt.textContent = 'Default Laptop Output';
            selectEl.appendChild(defaultOpt);

            this.availableDevices.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.deviceId;
                opt.textContent = d.label || `Audio Output Device (${d.deviceId.slice(0, 8)})`;
                selectEl.appendChild(opt);
            });

            selectEl.onchange = (e) => {
                this.setChannelDevice(idx, e.target.value);
            };
        });
    }

    autoAssignDevices() {
        if (this.availableDevices.length === 0) return;

        let auxDev = null;
        let typecDev = null;
        let btDev = null;

        // --- PRIORITY 1: Exact known device name matching (your specific hardware) ---
        this.availableDevices.forEach(d => {
            const label = (d.label || '').toLowerCase();

            // Bluetooth detection - Airdopes 138, any BT headset
            if (!btDev && (
                label.includes('airdopes') ||
                label.includes('bluetooth') ||
                label.includes('wireless') ||
                label.includes('hands-free') ||
                label.includes('buds') ||
                label.includes('airpods') ||
                label.includes('tws') ||
                label.includes('headset') ||
                label.includes('a2dp') ||
                label.includes('hfp')
            )) {
                btDev = d;
            }
            // USB Type-C detection - AB13X USB Audio, any USB audio adapter
            else if (!typecDev && (
                label.includes('ab13x') ||
                label.includes('usb audio') ||
                label.includes('usb') ||
                label.includes('type-c') ||
                label.includes('dac') ||
                label.includes('earpod') ||
                label.includes('c-media') ||
                label.includes('cmedia') ||
                label.includes('syba')
            )) {
                typecDev = d;
            }
            // AUX / 3.5mm detection - Realtek onboard audio
            else if (!auxDev && (
                label.includes('realtek') ||
                label.includes('speaker') ||
                label.includes('headphones') ||
                label.includes('high definition') ||
                label.includes('amd audio') ||
                label.includes('nvidia') ||
                label.includes('3.5mm') ||
                label.includes('stereo')
            )) {
                auxDev = d;
            }
        });

        // --- PRIORITY 2: Score-based fallback for unmatched devices ---
        if (!auxDev || !typecDev || !btDev) {
            const assigned = new Set([
                auxDev?.deviceId, typecDev?.deviceId, btDev?.deviceId
            ].filter(Boolean));

            const unassigned = this.availableDevices.filter(d => !assigned.has(d.deviceId));

            // Score each unassigned device
            unassigned.forEach(d => {
                const label = (d.label || '').toLowerCase();
                let btScore = 0, usbScore = 0, auxScore = 0;

                // Bluetooth scoring
                if (label.includes('airdopes') || label.includes('bluetooth') || label.includes('wireless')) btScore += 10;
                if (label.includes('hands-free') || label.includes('headset') || label.includes('tws')) btScore += 5;
                if (label.includes('buds') || label.includes('earbuds')) btScore += 5;

                // USB scoring
                if (label.includes('ab13x') || label.includes('usb audio')) usbScore += 10;
                if (label.includes('usb') || label.includes('type-c')) usbScore += 5;
                if (label.includes('dac') || label.includes('c-media')) usbScore += 5;

                // AUX scoring
                if (label.includes('realtek') || label.includes('speaker')) auxScore += 10;
                if (label.includes('amd') || label.includes('high definition')) auxScore += 5;
                if (label.includes('stereo') || label.includes('3.5')) auxScore += 3;

                const maxScore = Math.max(btScore, usbScore, auxScore);
                if (maxScore === 0) return; // unrecognized, skip scoring

                if (!btDev && btScore === maxScore && btScore > 0) btDev = d;
                else if (!typecDev && usbScore === maxScore && usbScore > 0) typecDev = d;
                else if (!auxDev && auxScore === maxScore && auxScore > 0) auxDev = d;
            });
        }

        // --- PRIORITY 3: Last-resort sequential fallback ---
        const stillUnassigned = this.availableDevices.filter(d =>
            d.deviceId !== auxDev?.deviceId &&
            d.deviceId !== typecDev?.deviceId &&
            d.deviceId !== btDev?.deviceId
        );
        if (!auxDev && stillUnassigned.length > 0) auxDev = stillUnassigned.shift();
        if (!typecDev && stillUnassigned.length > 0) typecDev = stillUnassigned.shift();
        if (!btDev && stillUnassigned.length > 0) btDev = stillUnassigned.shift();

        // Apply to channels
        if (auxDev) this.setChannelDevice(0, auxDev.deviceId);
        if (typecDev) this.setChannelDevice(1, typecDev.deviceId);
        if (btDev) this.setChannelDevice(2, btDev.deviceId);

        // Log results for debugging
        console.log('[AudioTriad] Auto-Assign Result:');
        console.log('  AUX:', auxDev?.label || 'Not found');
        console.log('  Type-C:', typecDev?.label || 'Not found');
        console.log('  Bluetooth:', btDev?.label || 'Not found');

        // Show status to user
        const found = [auxDev, typecDev, btDev].filter(Boolean).length;
        const names = [
            auxDev ? auxDev.label.substring(0, 25) : 'None',
            typecDev ? typecDev.label.substring(0, 25) : 'None',
            btDev ? btDev.label.substring(0, 25) : 'None'
        ];
        if (this.audioStatusText) {
            this.audioStatusText.textContent = `Auto-Assigned ${found}/3: AUX=${names[0]} | USB=${names[1]} | BT=${names[2]}`;
        }
    }

    async setChannelDevice(channelIdx, deviceId) {
        const ch = this.channels[channelIdx];
        ch.sinkId = deviceId;
        
        // Update select UI
        const selectIds = ['selectDeviceAux', 'selectDeviceTypeC', 'selectDeviceBT'];
        const selectEl = document.getElementById(selectIds[channelIdx]);
        if (selectEl) selectEl.value = deviceId;

        // Apply sinkId to underlying HTMLAudioElement
        if (typeof ch.audioEl.setSinkId === 'function') {
            try {
                await ch.audioEl.setSinkId(deviceId);
                console.log(`Channel ${ch.name} set to device sinkId: ${deviceId}`);
            } catch (err) {
                console.warn(`Could not setSinkId on Channel ${ch.name}:`, err);
            }
        }
    }

    bindEvents() {
        // Drag & Drop Video + Subtitle Files
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.btnBrowseFile.addEventListener('click', (e) => {
            e.stopPropagation();
            this.fileInput.click();
        });

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleSelectedFiles(Array.from(e.target.files));
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dropOverlay.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.dropOverlay.classList.remove('dragover');
            });
        });

        this.dropZone.addEventListener('drop', (e) => {
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.handleSelectedFiles(files);
            }
        });


        // Video Player Controls
        this.btnPlayPause.addEventListener('click', () => this.togglePlayPause());
        this.videoEl.addEventListener('click', () => this.togglePlayPause());
        
        this.videoEl.addEventListener('timeupdate', () => this.updateTimeAndProgress());
        this.videoEl.addEventListener('loadedmetadata', () => {
            this.durationTimeEl.textContent = this.formatTime(this.videoEl.duration);
        });

        this.seekSlider.addEventListener('input', (e) => {
            const targetTime = (e.target.value / 100) * this.videoEl.duration;
            this.videoEl.currentTime = targetTime;
        });

        this.btnFullscreen.addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                this.videoEl.requestFullscreen();
            }
        });

        // Tabs
        this.tabMovie.addEventListener('click', () => this.switchTab('movie'));
        this.tabSystem.addEventListener('click', () => this.switchTab('system'));

        // System Audio Capture
        this.btnStartSystemCapture.addEventListener('click', () => this.startSystemAudioCapture());
        this.btnStopSystemCapture.addEventListener('click', () => this.stopSystemAudioCapture());

        // Refresh & Auto-Assign
        this.btnRefreshDevices.addEventListener('click', () => this.loadAudioDevices());
        this.btnAutoAssign.addEventListener('click', () => {
            this.autoAssignDevices();
            this.audioStatusText.textContent = 'Devices Auto-Assigned!';
            setTimeout(() => this.audioStatusText.textContent = 'Audio Engine Active', 2000);
        });

        // Channel Controls (Volume, Delay, Mute, Test Tone)
        const channelIds = ['Aux', 'TypeC', 'BT'];
        channelIds.forEach((idName, idx) => {
            const ch = this.channels[idx];

            // Volume Slider
            const sliderVol = document.getElementById(`sliderVol${idName}`);
            const valVol = document.getElementById(`valVol${idName}`);
            sliderVol.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value) / 100;
                ch.volume = vol;
                if (!ch.isMuted) ch.gainNode.gain.value = vol;
                valVol.textContent = `${e.target.value}%`;
            });

            // Mute Button
            const btnMute = document.getElementById(`btnMute${idName}`);
            btnMute.addEventListener('click', () => {
                ch.isMuted = !ch.isMuted;
                btnMute.classList.toggle('muted', ch.isMuted);
                ch.gainNode.gain.value = ch.isMuted ? 0 : ch.volume;
            });

            // Delay Offset Slider
            const sliderDelay = document.getElementById(`sliderDelay${idName}`);
            const valDelay = document.getElementById(`valDelay${idName}`);
            sliderDelay.addEventListener('input', (e) => {
                const delayMs = parseFloat(e.target.value);
                ch.delayMs = delayMs;
                ch.delayNode.delayTime.value = delayMs / 1000;
                valDelay.textContent = `${delayMs} ms`;
            });
        });

        // TextTracks Event Listeners for native/embedded subtitle tracks
        if (this.videoEl.textTracks) {
            this.videoEl.textTracks.addEventListener('addtrack', () => {
                console.log('Detected new text track!');
                this.updateSubtitleTrackDropdown();
            });
            this.videoEl.textTracks.addEventListener('removetrack', () => {
                this.updateSubtitleTrackDropdown();
            });
        }

        // Subtitle Track Selection Change Handler
        if (this.selectSubtitleTrack) {
            this.selectSubtitleTrack.addEventListener('change', (e) => {
                const val = e.target.value;
                const textTracks = this.videoEl.textTracks;
                if (!textTracks) return;

                for (let i = 0; i < textTracks.length; i++) {
                    if (val === 'off') {
                        textTracks[i].mode = 'disabled';
                    } else {
                        textTracks[i].mode = (i === parseInt(val)) ? 'showing' : 'disabled';
                    }
                }
            });
        }

        // Add External Subtitle File Button Handler
        if (this.btnLoadSubtitle && this.subFileInput) {
            this.btnLoadSubtitle.addEventListener('click', () => {
                this.subFileInput.click();
            });

            this.subFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.loadExternalSubtitle(e.target.files[0]);
                }
            });
        }
    }

    handleSelectedFiles(files) {
        const videoExtensions = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v'];
        const subExtensions = ['.srt', '.vtt', '.ass', '.ssa'];

        let videoFile = null;
        const subFiles = [];

        files.forEach(file => {
            const name = file.name.toLowerCase();
            if (videoExtensions.some(ext => name.endsWith(ext))) {
                videoFile = file;
            } else if (subExtensions.some(ext => name.endsWith(ext))) {
                subFiles.push(file);
            }
        });

        if (videoFile) {
            this.loadVideoFile(videoFile);
        }

        // Load any subtitle files dropped alongside the video
        subFiles.forEach(subFile => {
            this.loadExternalSubtitle(subFile);
        });
    }

    loadVideoFile(file) {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // Clear previous track elements
        const existingTracks = this.videoEl.querySelectorAll('track');
        existingTracks.forEach(t => t.remove());

        const fileUrl = URL.createObjectURL(file);
        this.videoEl.src = fileUrl;
        this.dropOverlay.style.display = 'none';
        this.videoEl.play();
        this.iconPlay.classList.add('hidden');
        this.iconPause.classList.remove('hidden');
        this.audioStatusText.textContent = `Playing: ${file.name}`;

        // Re-detect tracks and parse MKV embedded subtitles
        setTimeout(() => {
            this.detectMediaTracks();
            if (file.name.toLowerCase().endsWith('.mkv')) {
                this.parseMkvSubtitles(file);
            }
        }, 500);
    }

    async parseMkvSubtitles(file) {
        try {
            const chunkSize = Math.min(file.size, 50 * 1024 * 1024);
            const buffer = await file.slice(0, chunkSize).arrayBuffer();
            const view = new DataView(buffer);
            const len = buffer.byteLength;
            let pos = 0;

            function readVarint(offset) {
                if (offset >= len) return { length: 1, value: 0 };
                let b = view.getUint8(offset);
                let numBytes = 1;
                let mask = 0x80;
                while (numBytes <= 8 && !(b & mask)) {
                    numBytes++;
                    mask >>= 1;
                }
                let val = b & (mask - 1);
                for (let i = 1; i < numBytes; i++) {
                    if (offset + i < len) {
                        val = (val * 256) + view.getUint8(offset + i);
                    }
                }
                return { length: numBytes, value: val };
            }

            function readId(offset) {
                if (offset >= len) return { length: 1, id: 0 };
                let b = view.getUint8(offset);
                let numBytes = 1;
                let mask = 0x80;
                while (numBytes <= 4 && !(b & mask)) {
                    numBytes++;
                    mask >>= 1;
                }
                let id = 0;
                for (let i = 0; i < numBytes; i++) {
                    if (offset + i < len) {
                        id = (id * 256) + view.getUint8(offset + i);
                    }
                }
                return { length: numBytes, id: id };
            }

            const trackEntries = [];
            let segmentPos = 0;

            // Scan for Tracks Header (0x1654AE6B)
            while (pos < Math.min(len - 4, 10 * 1024 * 1024)) {
                const elId = readId(pos);
                pos += elId.length;
                const size = readVarint(pos);
                pos += size.length;

                if (elId.id === 0x18538067) {
                    segmentPos = pos;
                } else if (elId.id === 0x1654AE6B) { // Tracks Header
                    let trackPos = pos;
                    const trackEnd = Math.min(pos + size.value, len);
                    while (trackPos < trackEnd) {
                        const tId = readId(trackPos);
                        trackPos += tId.length;
                        const tSize = readVarint(trackPos);
                        trackPos += tSize.length;

                        if (tId.id === 0xAE) { // TrackEntry
                            let entryPos = trackPos;
                            const entryEnd = Math.min(trackPos + tSize.value, len);
                            let trackNum = 0, trackType = 0, codecId = "", lang = "eng", name = "";

                            while (entryPos < entryEnd) {
                                const subId = readId(entryPos);
                                entryPos += subId.length;
                                const subSize = readVarint(entryPos);
                                entryPos += subSize.length;

                                if (subId.id === 0xD7 && subSize.value > 0) {
                                    trackNum = view.getUint8(entryPos);
                                } else if (subId.id === 0x83 && subSize.value > 0) {
                                    trackType = view.getUint8(entryPos);
                                } else if (subId.id === 0x86 && subSize.value > 0) {
                                    let str = "";
                                    for (let k = 0; k < Math.min(subSize.value, 64); k++) str += String.fromCharCode(view.getUint8(entryPos + k));
                                    codecId = str;
                                } else if (subId.id === 0x22B59C && subSize.value > 0) {
                                    let str = "";
                                    for (let k = 0; k < Math.min(subSize.value, 16); k++) str += String.fromCharCode(view.getUint8(entryPos + k));
                                    lang = str;
                                } else if (subId.id === 0x536E && subSize.value > 0) {
                                    let str = "";
                                    for (let k = 0; k < Math.min(subSize.value, 64); k++) str += String.fromCharCode(view.getUint8(entryPos + k));
                                    name = str;
                                }
                                entryPos += subSize.value;
                            }

                            if (trackType === 17 || codecId.startsWith("S_TEXT") || codecId.startsWith("S_HDMV")) {
                                trackEntries.push({ num: trackNum, codec: codecId, lang: lang, name: name || `Track ${trackEntries.length + 1}`, cues: [] });
                            }
                        }
                        trackPos += tSize.value;
                    }
                    break;
                }
                pos += size.value;
            }

            console.log("Demuxed MKV Subtitle Tracks:", trackEntries);

            if (trackEntries.length === 0) return;

            // Scan Clusters for subtitle text blocks
            let clusterPos = segmentPos || pos;
            let currentClusterTimecode = 0;

            while (clusterPos < len - 4) {
                const elId = readId(clusterPos);
                clusterPos += elId.length;
                const size = readVarint(clusterPos);
                clusterPos += size.length;

                if (elId.id === 0x1F43B675) { // Cluster
                    let innerPos = clusterPos;
                    const clusterEnd = Math.min(clusterPos + size.value, len);

                    while (innerPos < clusterEnd) {
                        const blockId = readId(innerPos);
                        innerPos += blockId.length;
                        const blockSize = readVarint(innerPos);
                        innerPos += blockSize.length;

                        if (blockId.id === 0xE7 && blockSize.value > 0) { // Timecode
                            let tc = 0;
                            for (let b = 0; b < blockSize.value; b++) {
                                tc = (tc * 256) + view.getUint8(innerPos + b);
                            }
                            currentClusterTimecode = tc;
                        } else if (blockId.id === 0xA3 || blockId.id === 0x9B) { // SimpleBlock or Block
                            const trackNumVar = readVarint(innerPos);
                            const tNum = trackNumVar.value;
                            const targetTrack = trackEntries.find(t => t.num === tNum);

                            if (targetTrack && blockSize.value > (trackNumVar.length + 3)) {
                                const relTime = view.getInt16(innerPos + trackNumVar.length);
                                const absTimeMs = currentClusterTimecode + relTime;
                                const payloadStart = innerPos + trackNumVar.length + 3;
                                const payloadLen = blockSize.value - (trackNumVar.length + 3);

                                let txt = "";
                                for (let k = 0; k < payloadLen; k++) {
                                    txt += String.fromCharCode(view.getUint8(payloadStart + k));
                                }
                                txt = txt.replace(/\{[^}]+\}/g, '').trim();
                                if (txt.length > 0) {
                                    targetTrack.cues.push({ timeMs: absTimeMs, text: txt });
                                }
                            }
                        }
                        innerPos += blockSize.value;
                    }
                }
                clusterPos += size.value;
            }

            // Generate WebVTT for each subtitle track and attach to video element
            trackEntries.forEach((track, idx) => {
                let vttText = "WEBVTT\n\n";
                const cues = track.cues;
                cues.forEach((c, i) => {
                    const startSec = Math.max(0, c.timeMs / 1000);
                    const nextSec = (i < cues.length - 1) ? (cues[i + 1].timeMs / 1000) : (startSec + 3.0);
                    const endSec = Math.min(startSec + 4.5, nextSec);

                    const formatVttTime = (sec) => {
                        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                        const s = Math.floor(sec % 60).toString().padStart(2, '0');
                        const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
                        return `${h}:${m}:${s}.${ms}`;
                    };

                    vttText += `${i + 1}\n${formatVttTime(startSec)} --> ${formatVttTime(endSec)}\n${c.text}\n\n`;
                });

                const blob = new Blob([vttText], { type: 'text/vtt' });
                const vttUrl = URL.createObjectURL(blob);

                const trackEl = document.createElement('track');
                trackEl.kind = 'subtitles';
                trackEl.label = `Track ${idx + 1} - [${track.name} (${track.lang.toUpperCase()})]`;
                trackEl.srclang = track.lang || 'en';
                trackEl.src = vttUrl;
                if (idx === 0) trackEl.default = true;

                this.videoEl.appendChild(trackEl);
            });

            setTimeout(() => this.updateSubtitleTrackDropdown(), 300);

        } catch (e) {
            console.warn("MKV Subtitle Demuxer:", e);
        }
    }


    detectMediaTracks() {
        // Detect Embedded Audio Tracks
        if (this.selectAudioTrack) {
            this.selectAudioTrack.innerHTML = '';
            const audioTracks = this.videoEl.audioTracks;
            if (audioTracks && audioTracks.length > 0) {
                for (let i = 0; i < audioTracks.length; i++) {
                    const track = audioTracks[i];
                    const opt = document.createElement('option');
                    opt.value = i;
                    opt.textContent = track.label || track.language ? `Track ${i + 1} (${track.label || track.language})` : `Audio Track ${i + 1}`;
                    if (track.enabled) opt.selected = true;
                    this.selectAudioTrack.appendChild(opt);
                }
            } else {
                const opt = document.createElement('option');
                opt.value = 0;
                opt.textContent = 'Main Stereo Audio Track';
                this.selectAudioTrack.appendChild(opt);
            }
        }

        // Detect Subtitle Tracks
        this.updateSubtitleTrackDropdown();
    }

    updateSubtitleTrackDropdown() {
        if (!this.selectSubtitleTrack) return;
        this.selectSubtitleTrack.innerHTML = '';
        
        const offOpt = document.createElement('option');
        offOpt.value = 'off';
        offOpt.textContent = 'Disable Subtitles';
        this.selectSubtitleTrack.appendChild(offOpt);

        const textTracks = this.videoEl.textTracks;
        if (textTracks && textTracks.length > 0) {
            for (let i = 0; i < textTracks.length; i++) {
                const track = textTracks[i];
                const opt = document.createElement('option');
                opt.value = i;
                const langName = track.language ? track.language.toUpperCase() : 'English';
                const labelName = track.label || `Track ${i + 1}`;
                opt.textContent = `Track ${i + 1} - [${labelName || langName}]`;
                if (track.mode === 'showing') opt.selected = true;
                this.selectSubtitleTrack.appendChild(opt);
            }
        }
    }

    loadExternalSubtitle(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            let content = e.target.result;
            
            // Convert SRT to WebVTT if file is .srt
            if (file.name.endsWith('.srt')) {
                content = this.srtToVtt(content);
            }

            const blob = new Blob([content], { type: 'text/vtt' });
            const vttUrl = URL.createObjectURL(blob);

            // Create track element
            const trackEl = document.createElement('track');
            trackEl.kind = 'subtitles';
            trackEl.label = file.name.replace(/\.[^/.]+$/, "");
            trackEl.srclang = 'en';
            trackEl.src = vttUrl;
            trackEl.default = true;

            this.videoEl.appendChild(trackEl);
            
            // Force textTrack mode to showing
            setTimeout(() => {
                const textTracks = this.videoEl.textTracks;
                if (textTracks.length > 0) {
                    const lastIdx = textTracks.length - 1;
                    for (let i = 0; i < textTracks.length; i++) {
                        textTracks[i].mode = (i === lastIdx) ? 'showing' : 'disabled';
                    }
                    this.updateSubtitleTrackDropdown();
                    this.selectSubtitleTrack.value = lastIdx;
                }
                this.audioStatusText.textContent = `Subtitle Loaded: ${file.name}`;
            }, 100);
        };
        reader.readAsText(file);
    }

    srtToVtt(srtText) {
        // Simple client-side SRT to WebVTT converter
        let vtt = 'WEBVTT\n\n';
        vtt += srtText
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        return vtt;
    }


    loadVideoFile(file) {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        const fileUrl = URL.createObjectURL(file);
        this.videoEl.src = fileUrl;
        this.dropOverlay.style.display = 'none';
        this.videoEl.play();
        this.iconPlay.classList.add('hidden');
        this.iconPause.classList.remove('hidden');
        this.audioStatusText.textContent = `Playing: ${file.name}`;
    }

    togglePlayPause() {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (this.videoEl.paused) {
            this.videoEl.play();
            this.iconPlay.classList.add('hidden');
            this.iconPause.classList.remove('hidden');
        } else {
            this.videoEl.pause();
            this.iconPlay.classList.remove('hidden');
            this.iconPause.classList.add('hidden');
        }
    }

    updateTimeAndProgress() {
        if (!this.videoEl.duration) return;
        const current = this.videoEl.currentTime;
        const duration = this.videoEl.duration;
        const pct = (current / duration) * 100;
        this.seekSlider.value = pct;
        this.currentTimeEl.textContent = this.formatTime(current);
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
    }

    switchTab(tab) {
        this.activeMode = tab;
        if (tab === 'movie') {
            this.tabMovie.classList.add('active');
            this.tabSystem.classList.remove('active');
            this.movieContainer.classList.remove('hidden');
            this.movieContainer.classList.add('active');
            this.systemContainer.classList.add('hidden');
            this.systemContainer.classList.remove('active');
        } else {
            this.tabSystem.classList.add('active');
            this.tabMovie.classList.remove('active');
            this.systemContainer.classList.remove('hidden');
            this.systemContainer.classList.add('active');
            this.movieContainer.classList.add('hidden');
            this.movieContainer.classList.remove('active');
        }
    }

    async startSystemAudioCapture() {
        try {
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            // Capture display with system audio included
            this.systemMediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                    autoGainControl: false,
                    echoCancellation: false,
                    noiseSuppression: false
                }
            });

            const audioTracks = this.systemMediaStream.getAudioTracks();
            if (audioTracks.length === 0) {
                alert('No system audio selected. Make sure to check "Share system audio" in the popup window!');
                this.stopSystemAudioCapture();
                return;
            }

            // Disconnect old system node if any
            if (this.systemStreamNode) {
                this.systemStreamNode.disconnect();
            }

            // Connect system audio stream to master analyser and 3 channel gain nodes
            this.systemStreamNode = this.audioCtx.createMediaStreamSource(this.systemMediaStream);
            this.systemStreamNode.connect(this.masterAnalyser);
            this.channels.forEach(ch => {
                this.systemStreamNode.connect(ch.gainNode);
            });

            this.btnStartSystemCapture.classList.add('hidden');
            this.btnStopSystemCapture.classList.remove('hidden');
            this.systemCaptureStatus.textContent = '🟢 System Audio Capturing & 3-Way Streaming';
            this.systemCaptureStatus.className = 'status-badge active';
            this.audioStatusText.textContent = 'Streaming System Audio to 3 Headphones';

            // Handle when user stops sharing via browser bar
            audioTracks[0].onended = () => {
                this.stopSystemAudioCapture();
            };

        } catch (err) {
            console.error('System capture error:', err);
            alert('Failed to start system audio capture. Make sure to grant screen/audio share permissions.');
        }
    }

    stopSystemAudioCapture() {
        if (this.systemMediaStream) {
            this.systemMediaStream.getTracks().forEach(track => track.stop());
            this.systemMediaStream = null;
        }
        if (this.systemStreamNode) {
            this.systemStreamNode.disconnect();
            this.systemStreamNode = null;
        }
        this.btnStartSystemCapture.classList.remove('hidden');
        this.btnStopSystemCapture.classList.add('hidden');
        this.systemCaptureStatus.textContent = 'System Capture Off';
        this.systemCaptureStatus.className = 'status-badge inactive';
        this.audioStatusText.textContent = 'Audio Engine Ready';
    }

    playTestChime(channelIdx) {
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        const ch = this.channels[channelIdx];
        
        // Create oscillator for chime
        const osc = this.audioCtx.createOscillator();
        const chimeGain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, this.audioCtx.currentTime); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880, this.audioCtx.currentTime + 0.15); // A5 note

        chimeGain.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.6);

        osc.connect(chimeGain);
        chimeGain.connect(ch.gainNode);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.6);

        console.log(`Played test chime on channel ${ch.name}`);
    }

    setupVisualizer() {
        const render = () => {
            requestAnimationFrame(render);

            const width = this.canvas.width = this.canvas.clientWidth;
            const height = this.canvas.height = this.canvas.clientHeight;

            this.canvasCtx.clearRect(0, 0, width, height);

            if (this.masterAnalyser) {
                const bufferLength = this.masterAnalyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                this.masterAnalyser.getByteFrequencyData(dataArray);

                const barWidth = (width / bufferLength) * 2;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * height;

                    const gradient = this.canvasCtx.createLinearGradient(0, height, 0, 0);
                    gradient.addColorStop(0, '#00c6ff');
                    gradient.addColorStop(0.5, '#7928ca');
                    gradient.addColorStop(1, '#00f5a0');

                    this.canvasCtx.fillStyle = gradient;
                    this.canvasCtx.fillRect(x, height - barHeight, barWidth - 2, barHeight);

                    x += barWidth;
                }
            }

            // Update VU level meters for each device card
            const channelMeterIds = ['meterAux', 'meterTypeC', 'meterBT'];
            this.channels.forEach((ch, idx) => {
                if (ch.analyserNode) {
                    const dataArray = new Uint8Array(ch.analyserNode.frequencyBinCount);
                    ch.analyserNode.getByteFrequencyData(dataArray);
                    
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avg = sum / dataArray.length;
                    const levelPct = Math.min(100, Math.round((avg / 128) * 100));
                    
                    const meterEl = document.getElementById(channelMeterIds[idx]);
                    if (meterEl) {
                        meterEl.style.width = `${ch.isMuted ? 0 : levelPct}%`;
                    }
                }
            });
        };

        render();
    }
}

// Initialize Application when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.audioTriadApp = new AudioTriadEngine();
});
