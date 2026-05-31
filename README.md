# 🚜 Cozy Farm — Learn & Grow! 🌾🌻

[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Tone.js](https://img.shields.io/badge/Tone.js-000000?style=for-the-badge&logo=tonejs&logoColor=white)](https://tonejs.github.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![License-MIT](https://img.shields.io/badge/License-MIT-4CAF50?style=for-the-badge)](LICENSE)

A colorful, premium, and interactive **3D farming simulator** designed to teach kids about agriculture, plants, water resources, and machinery. Built from scratch with vanilla modern web technologies, it features a full reactive game loop, interactive academy quizzes, a dynamic day/night lighting cycle, and automated vehicle driving.

---

## 🌟 Key Features

### 🎮 Interactive 3D World (Three.js)
* **Cute Polygonal Art**: Handcrafted, optimized 3D meshes for trees, fences, a cozy farmhouse, a functional water well, and agricultural machinery.
* **Contextual Tile Actions**: High-visibility grid system showing crop ripeness. The active tile glows yellow/gold when ready for harvest.
* **Visual Effects**: Particle splashes for watering plants and pop-up emoji indicators for harvested crops.

### 🌅 Dynamic Environment & Time
* **Day & Night Cycle**: A full game-day lasts 4 real-time minutes. The skybox, fog, and shadows transition smoothly from **Morning** 🌅 to **Midday** ☀️, **Sunset** 🌇, and **Night** 🌙.
* **Cozy Farmhouse Rest**: Walking onto the farmhouse welcome mat lets kids sleep through the night, waking up to a fresh morning with fully refilled energies.
* **Weather & Atmosphere**: Shifting clouds float across the sky dynamically.

### 🚜 Vehicles & Attachments (Garage)
Switch from walking on foot to riding specialized farm machinery:
* **👟 On Foot**: Move around the farm grid to perform tilling, planting, and watering by hand.
* **🛵 Quad Bike**: High-speed, heavy-duty vehicle designed for zooming across bumpy fields.
* **🚜 Tractor**: Equipped with auto-till and seed-planting attachments to sow fields as you drive.
* **🛻 Utility Truck**: Features a large water tank and auto-harvesting tools that gather ripe crops on-contact.
* **🛠️ Upgrades**: Buy the **Big Water Tank** (+50% capacity), **Sprinkler Kit** (area irrigation), or **Magic Seeds** (crops grow 25% faster).

### 🎓 Educational Lesson Academy
A child-friendly interactive academy containing illustrated lessons and simple rewards-driven quizzes:
* **🌱 The Seed Cycle**: Teaches how seeds sprout using water and warm sun to grow leaves, flowers, and fruit.
* **💧 Soil & Water**: Explains how soil nutrients feed roots, why watering is critical, and the value of moderate hydration.
* **🚜 Farm Vehicle Match**: Explains what different vehicles (tractors, utility trucks, quad bikes) do on a farm.
* **🍓 Crops & Seasons**: Introduces deep-rooted crops (carrots), surface plants (strawberries), and healthy eating diversity.

### 🎵 Synthesized Audio (Tone.js)
* **Procedural Sound FX**: Uses FM, Noise, and Pluck synthesizers to synthesize sounds in real-time. No bulky `.mp3` or `.wav` files required!
* **Interactive Engine Drone**: Dynamic engine frequency pitch increases as vehicles accelerate and decreases when idle.
* **Mute Control**: Easily toggle game audio from the start menu or HUD.

---

## 🛠️ Technology Stack

| Technology | Purpose | Description |
| :--- | :--- | :--- |
| **Vite** | Build Tool | Extremely fast hot-reloading bundler for development and build pipelines. |
| **Three.js** | 3D Graphics | Handles the 3D scene, rendering, directional shadow mapping, and player/mesh movement. |
| **Tone.js** | Audio Synthesis | Real-time web audio synthesis for sound effects (tilling, watering, coins, level-up) and engine hums. |
| **Tailwind CSS** | Styling & UI | Renders HUD overlays, dialog cards, responsive buttons, and screen loaders. |
| **Capacitor CLI** | Mobile Packaging | Syncs web bundles directly to Android and iOS native wrapper modules. |

---

## 🎮 How to Play

### Basic Controls
* **⌨️ Keyboard**: Move the farmer/vehicle with **W, A, S, D** or **Arrow Keys**.
* **📱 Touchscreen / Mobile**: Drag the virtual joystick on the bottom left to steer.
* **🖱️ Interaction**: Tap buttons on the bottom toolbar or press keys to interact:
  * **✋ Act**: Till grass soil or harvest ripe crops.
  * **💧 Water**: Spray water on planted crops to speed up growth.
  * **🛒 Shop**: Buy seeds (Carrot, Strawberry, Pumpkin, Golden Crop) and tools.
  * **🏠 Garage**: Buy or switch active vehicles.
  * **🎓 Learn**: Launch the Academy to read cards and answer questions.

---

## 📦 Installation & Setup

To run Cozy Farm locally on your machine, follow these steps:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Clone and Install Dependencies
```bash
# Navigate to project directory
cd cozy-farm-kids

# Install packages
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to play the game!

### 4. Build for Production
```bash
npm run build
```
The compiled files will be output to the `dist/` directory.

---

## 📱 Mobile Build (Capacitor)

Cozy Farm is pre-configured with Capacitor for native mobile testing.

### Sync Web Files to Capacitor
Whenever you build or update your web assets, sync them with the Capacitor project:
```bash
# Compile latest production bundle
npm run build

# Sync assets to native folders
npm run cap:sync
```

### Run on Android
```bash
# Add Android platform (if not already done)
npm run cap:add:android

# Build, sync, and launch in Android Studio
npm run cap:android
```

---

## 📂 Project Directory Structure

```text
├── .git/
├── capacitor.config.json    # Capacitor configuration for mobile builds
├── index.html               # Main entry HTML template containing UI screens & overlays
├── package.json             # NPM dependencies, metadata, and build scripts
├── postcss.config.js        # PostCSS compiler config for Tailwind
├── tailwind.config.js       # Tailwind theme parameters (custom fonts, colors)
├── vite.config.js           # Vite bundler parameters
└── src/
    ├── main.js              # Bootstraps Three.js scene, event loops, and game clock
    ├── style.css            # Base Tailwind imports and utility layouts
    └── game/
        ├── audio.js         # Sound effects and engine hum synthesizers using Tone.js
        ├── lessons.js       # Educational lesson database and quiz datasets
        ├── state.js         # LocalStorage persistence, level formulas, and pub/sub store
        ├── three_scene.js   # 3D assets, camera rigs, lighting cycles, physics & animations
        └── ui.js            # HUD updates, dialog render engines, joystick controller, and store bindings
```

---

## 🌾 Crop Guide

| Crop | Emoji | Unlock Level | Seed Cost | Harvest Reward | Base Grow Time | Educational Fact |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Wheat** | 🌾 | Level 1 | 5 🪙 | 12 🪙 | 6s | *"Wheat becomes flour for bread!"* |
| **Carrot** | 🥕 | Level 1 | 8 🪙 | 20 🪙 | 8s | *"Carrots grow DOWN into the soil."* |
| **Strawberry** | 🍓 | Level 2 | 14 🪙 | 35 🪙 | 11s | *"Strawberries wear their seeds on the outside!"* |
| **Pumpkin** | 🎃 | Level 3 | 22 🪙 | 60 🪙 | 16s | *"A pumpkin is actually a fruit, not a veggie!"* |
| **Golden Crop** | 🌟 | Level 5 | 50 🪙 | 160 🪙 | 24s | *"The rare Golden Crop only grows for master farmers!"* |

---

## 📜 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
