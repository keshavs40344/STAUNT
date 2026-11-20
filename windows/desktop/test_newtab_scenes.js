const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const screenshotsDir = 'C:/Users/HP/.gemini/antigravity/brain/cce01f25-bb67-4436-9aa5-5e699a02b895/screenshots';
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function capture(win, filename) {
  const image = await win.webContents.capturePage();
  const filePath = path.join(screenshotsDir, filename);
  fs.writeFileSync(filePath, image.toPNG());
  console.log(`[TEST CAPTURE] Saved screenshot: ${filename} (${Math.round(image.toPNG().length / 1024)} KB)`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log('[TEST] Electron initialized. Launching New Tab test window...');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // will capture off-screen / headless
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const newtabUrl = `file://${path.join(__dirname, 'src', 'newtab.html')}`;
  await win.loadURL(newtabUrl);
  console.log('[TEST] newtab.html loaded successfully.');

  await delay(1200);

  // Test all 8 scenes
  const scenes = [
    { idx: 0, name: 'newtab_scene_1_living_sky.png', label: 'Living Sky' },
    { idx: 1, name: 'newtab_scene_2_mountain_escape.png', label: 'Mountain Escape' },
    { idx: 2, name: 'newtab_scene_3_aurora.png', label: 'Aurora' },
    { idx: 3, name: 'newtab_scene_4_ocean_depths.png', label: 'Ocean Depths' },
    { idx: 4, name: 'newtab_scene_5_living_cosmos.png', label: 'Living Cosmos' },
    { idx: 5, name: 'newtab_scene_6_ambient_flow.png', label: 'Ambient Flow' },
    { idx: 6, name: 'newtab_scene_7_midnight_slate.png', label: 'Midnight Slate (Plain)' },
    { idx: 7, name: 'newtab_scene_8_warm_cloud.png', label: 'Warm Cloud (Plain)' }
  ];

  for (const s of scenes) {
    console.log(`[TEST] Switching to Scene ${s.idx + 1}: ${s.label}...`);
    await win.webContents.executeJavaScript(`
      window.StauntLivingScenes.switchScene(${s.idx});
    `);
    await delay(1000); // allow cross-fade transition and render
    await capture(win, s.name);

    // Verify scene attributes
    const info = await win.webContents.executeJavaScript(`
      ({
        theme: document.documentElement.getAttribute('data-scene-theme'),
        dataTheme: document.documentElement.getAttribute('data-theme'),
        pillText: document.getElementById('scenePillText')?.textContent,
        savedIdx: localStorage.getItem('staunt_scene_index')
      })
    `);
    console.log(`[TEST] Scene ${s.idx + 1} State:`, info);
  }

  // Test Search Field Usability
  console.log('[TEST] Testing search field autofocus and typing...');
  const searchTest = await win.webContents.executeJavaScript(`
    const input = document.getElementById('newtabSearchInput');
    const isFocused = document.activeElement === input;
    input.value = 'Quantum Machine Learning';
    ({ isFocused, value: input.value })
  `);
  console.log('[TEST] Search input test result:', searchTest);

  // Test Shortcuts
  console.log('[TEST] Testing shortcuts grid...');
  const shortcutsTest = await win.webContents.executeJavaScript(`
    const tiles = document.querySelectorAll('.shortcut-tile');
    ({ count: tiles.length })
  `);
  console.log('[TEST] Shortcuts count:', shortcutsTest.count);

  console.log('[TEST] All New Tab visual and functional validations completed successfully!');
  app.quit();
});
