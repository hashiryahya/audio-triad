# 🎛️ AudioTriad — Multi-Device Audio Splitter & Movie Sync

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078d7?logo=windows&logoColor=white)](https://github.com/hashiryahya/audio-triad)
[![Node.js](https://img.shields.io/badge/Runtime-Node.js%20v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Web Audio API](https://img.shields.io/badge/DSP-Web%20Audio%20API-ff5722?logo=w3c&logoColor=white)](https://www.w3.org/TR/webaudio/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/Application-AudioTriad.exe%20(Native%20Desktop)-7952b3)](https://github.com/hashiryahya/audio-triad/releases)

> **Synchronize and broadcast high-fidelity audio simultaneously across 3 distinct hardware outputs (AUX 3.5mm, USB Type-C DAC, and Bluetooth TWS) with millisecond-precision latency compensation.**

---

## 💡 The Problem & Solution

When sharing a movie, game stream, or audio mix with friends using multiple pairs of headphones or external speakers, Windows natively only allows selecting a single default output device. 

Even worse, **Bluetooth wireless connections suffer from intrinsic transmission latency (120ms – 250ms)** compared to instantaneous analog AUX or USB-C DAC feeds, creating a jarring echo effect.

**AudioTriad** solves this entirely:
1. Splices a single media or system audio source into **3 isolated audio output channels**.
2. Dynamically routes each channel to independent physical audio devices via Chromium's `setSinkId` API.
3. Provides an independent **Digital Delay Buffer (0 – 5000ms)** for each channel, allowing you to delay AUX and USB audio so they perfectly match the Bluetooth transmission lag!

---

## ⚡ Key Features

- **🚀 Native Windows Desktop Application (`AudioTriad.exe`)**: Launches as a clean standalone desktop window without browser URL bars or window clutter.
- **🎧 Triple Hardware Output Routing**:
  - **Channel 1 (AUX / 3.5mm)**: Direct analog onboard audio (Realtek High Definition Audio).
  - **Channel 2 (USB Type-C)**: Digital-to-analog converter (AB13X USB Audio / Type-C DAC / Dongle).
  - **Channel 3 (Bluetooth)**: Wireless TWS earbuds & headsets (boAt Airdopes 138, AirPods, Sony WH-1000XM, etc.).
- **⏱️ Real-Time Millisecond Latency Compensation**: Fine-tune delay up to 5,000 milliseconds per channel to eliminate Bluetooth audio lag.
- **🔊 Per-Channel Gain Controls**: Independent volume sliders, real-time VU meter peaks, and one-click instant mute switches.
- **🎬 Built-In Movie Player Engine**:
  - Drag-and-drop local video & audio playback (`.mp4`, `.webm`, `.mkv`, `.mp3`, `.wav`).
  - HTTP Range Request streaming for lag-free scrubbing and instant seeking.
  - Multi-track audio switching and external subtitle loader (`.srt`, `.vtt`).
- **💻 System Audio Capture Mode**: Capture and distribute live system audio, Discord calls, or YouTube streams across all 3 hardware outputs.
- **📊 Real-time 64-Band Spectrum Visualizer**: Hardware-accelerated HTML5 Canvas audio spectrum analyzer rendering live stereo frequencies.

---

## 🏗️ Architecture & Signal Flow

```
                         ┌─────────────────────────────┐
                         │   Media Source / System     │
                         │   (HTML5 Video / Capture)   │
                         └──────────────┬──────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │       Web Audio Engine      │
                         │     (AudioContext Graph)    │
                         └──────┬───────┬───────┬──────┘
                                │       │       │
                ┌───────────────┘       │       └───────────────┐
                ▼                       ▼                       ▼
    ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
    │  Channel 1: AUX 3.5  ││  Channel 2: USB-C    ││  Channel 3: BT TWS   │
    ├──────────────────────┤├──────────────────────┤├──────────────────────┤
    │ • GainNode (Volume)  ││ • GainNode (Volume)  ││ • GainNode (Volume)  │
    │ • DelayNode (0ms)    ││ • DelayNode (0ms)    ││ • DelayNode (180ms)  │
    │ • AnalyserNode (VU)  ││ • AnalyserNode (VU)  ││ • AnalyserNode (VU)  │
    └──────────┬───────────┘└──────────┬───────────┘└──────────┬───────────┘
               ▼                       ▼                       ▼
    ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
    │ Realtek 3.5mm Jack   ││ USB-C Headphone DAC  ││ Bluetooth Earbuds    │
    └──────────────────────┘└──────────────────────┘└──────────────────────┘
```

---

## 🚀 Getting Started

### 📦 Option 1: Native Windows Application (Recommended)

1. Clone or download this repository.
2. Double-click **`AudioTriad.exe`**.
3. That's it! The launcher silently boots the local high-speed streaming server and launches AudioTriad in a dedicated native desktop window.

### 💻 Option 2: Run via Node.js CLI

```bash
# Clone the repository
git clone https://github.com/hashiryahya/audio-triad.git
cd audio-triad

# Start the application
npm start
```
Then visit `http://localhost:3000` in your web browser (Google Chrome or Microsoft Edge recommended for `setSinkId` support).

### 🖥️ Option 3: Electron Desktop Mode

```bash
npm run electron
```

---

## 🔌 Hardware Setup Guide

| Channel | Recommended Port | Typical Device Example |
| :--- | :--- | :--- |
| **AUX** | 3.5mm Headphone Jack | Wired IEMs, Studio Monitors, Realtek Output |
| **Type-C** | USB-C Port or USB 3.0 Adapter | Type-C DAC Dongle, External USB Soundcard |
| **Bluetooth** | Windows Bluetooth Settings | boAt Airdopes 138, Sony WF, Galaxy Buds |

> **💡 Sync Tip**: Bluetooth audio typically lags behind wired audio by ~150ms to 250ms. If you notice Bluetooth audio arriving later than AUX or USB, increase the **AUX Delay Slider** and **USB Delay Slider** to ~180ms until all three listeners hear identical synchronization!

---

## 🛠️ Tech Stack

- **Core Engine**: Vanilla JavaScript (ES6+), Web Audio API (`AudioContext`, `GainNode`, `DelayNode`, `AnalyserNode`, `MediaStreamDestination`)
- **Desktop Runtime**: C# .NET Native Launcher (`AudioTriad.exe`) + Chromium App Framework
- **Streaming Server**: Node.js HTTP Streaming Server with partial range headers (`206 Partial Content`)
- **Visuals**: HTML5 Canvas hardware-rendered Fast Fourier Transform (FFT) visualizer
- **Styling**: Modern dark-mode glassmorphic UI with responsive CSS Grid & Flexbox

---

## 👤 Author

**Hashir Yahya**  
- GitHub: [@hashiryahya](https://github.com/hashiryahya)  
- Location: Bangalore, Karnataka  

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
