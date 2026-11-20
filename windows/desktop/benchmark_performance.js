// =============================================================================
// STAUNT DESKTOP — ACCURATE REAL-WORLD PERFORMANCE BENCHMARK HARNESS
// Measures: Startup time, New Tab load, 1/5/10/20 Tab RAM (via app.getAppMetrics),
// Tab switching latency, and Event Loop Lag.
// =============================================================================

const { app, BrowserWindow, WebContentsView, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

const results = {
  timestamp: new Date().toISOString(),
  environment: {
    os: 'Windows x64',
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },
  metrics: {}
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getDetailedMemory() {
  const metrics = app.getAppMetrics();
  let totalWorkingSetKb = 0;
  let mainKb = 0;
  let gpuKb = 0;
  let renderersKb = 0;
  let utilityKb = 0;

  for (const m of metrics) {
    const ws = (m.memory && m.memory.workingSetSize) || 0;
    totalWorkingSetKb += ws;
    if (m.type === 'Browser' || m.type === 'Tab' && !m.serviceName) {
      mainKb += ws;
    } else if (m.type === 'GPU') {
      gpuKb += ws;
    } else if (m.type === 'Tab' || m.type === 'Renderer') {
      renderersKb += ws;
    } else {
      utilityKb += ws;
    }
  }

  const nodeMem = process.memoryUsage();

  return {
    processCount: metrics.length,
    totalWorkingSetMb: Math.round((totalWorkingSetKb / 1024) * 10) / 10,
    mainProcessMb: Math.round((nodeMem.rss / (1024 * 1024)) * 10) / 10,
    gpuProcessMb: Math.round((gpuKb / 1024) * 10) / 10,
    renderersTotalMb: Math.round((renderersKb / 1024) * 10) / 10,
    heapUsedMb: Math.round((nodeMem.heapUsed / (1024 * 1024)) * 10) / 10
  };
}

const t0 = performance.now();

app.whenReady().then(async () => {
  const tReady = performance.now();
  const coldStartupMs = Math.round(tReady - t0);
  console.log(`\n[BENCHMARK] Cold Startup (app.whenReady): ${coldStartupMs} ms`);

  // 1. Create Main Window
  const tWinStart = performance.now();
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: '#0b0f19',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  await new Promise(r => mainWindow.once('ready-to-show', r));
  const tFirstRender = performance.now();
  const timeToFirstUsableInterfaceMs = Math.round(tFirstRender - t0);
  console.log(`[BENCHMARK] Time to First Usable Interface: ${timeToFirstUsableInterfaceMs} ms`);
  mainWindow.show();

  // 2. Measure New Tab Load Time
  const tNewTabStart = performance.now();
  const newTabView = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.contentView.addChildView(newTabView);
  newTabView.setBounds({ x: 0, y: 76, width: 1440, height: 824 });
  await newTabView.webContents.loadFile(path.join(__dirname, 'src', 'newtab.html'));
  const tNewTabEnd = performance.now();
  const newTabLoadMs = Math.round(tNewTabEnd - tNewTabStart);
  console.log(`[BENCHMARK] New Tab Load Time (Offline Living Scene): ${newTabLoadMs} ms`);

  // Measure 1 Tab Baseline RAM
  await sleep(1000);
  const mem1Tab = getDetailedMemory();
  console.log(`[BENCHMARK] RAM at 1 Tab: ${mem1Tab.totalWorkingSetMb} MB Total (Main: ${mem1Tab.mainProcessMb} MB, Renderers: ${mem1Tab.renderersTotalMb} MB across ${mem1Tab.processCount} processes)`);

  // 3. Multi-Tab Stress Test: Scale to 5 Tabs
  const isOptimized = process.argv.includes('--optimized');
  const tabViews = [newTabView];
  console.log(`\n[BENCHMARK] Scaling to 5 Tabs (Optimized: ${isOptimized})...`);
  for (let i = 2; i <= 5; i++) {
    const v = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    tabViews.push(v);
    if (isOptimized) {
      try { v.webContents.setBackgroundThrottling(true); } catch (_) {}
    }
    await v.webContents.loadURL(`data:text/html,<html><head><title>Tab ${i}</title></head><body style="background:#0b0f19;color:%23fff;font-family:sans-serif;padding:24px;"><h1>Tab ${i} Loaded</h1><p>Active workload simulation.</p></body></html>`);
  }
  await sleep(800);
  const mem5Tabs = getDetailedMemory();
  console.log(`[BENCHMARK] RAM at 5 Tabs: ${mem5Tabs.totalWorkingSetMb} MB Total (Main: ${mem5Tabs.mainProcessMb} MB, Renderers: ${mem5Tabs.renderersTotalMb} MB across ${mem5Tabs.processCount} processes)`);

  // 4. Multi-Tab Stress Test: Scale to 10 Tabs
  console.log('\n[BENCHMARK] Scaling to 10 Tabs...');
  for (let i = 6; i <= 10; i++) {
    const v = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    tabViews.push(v);
    if (isOptimized) {
      try { v.webContents.setBackgroundThrottling(true); } catch (_) {}
    }
    await v.webContents.loadURL(`data:text/html,<html><head><title>Tab ${i}</title></head><body style="background:#0b0f19;color:%23fff;font-family:sans-serif;padding:24px;"><h1>Tab ${i} - High Concurrency</h1></body></html>`);
  }
  await sleep(1000);
  const mem10Tabs = getDetailedMemory();
  console.log(`[BENCHMARK] RAM at 10 Tabs: ${mem10Tabs.totalWorkingSetMb} MB Total (Main: ${mem10Tabs.mainProcessMb} MB, Renderers: ${mem10Tabs.renderersTotalMb} MB across ${mem10Tabs.processCount} processes)`);

  // 5. Multi-Tab Stress Test: Scale to 20 Tabs
  console.log('\n[BENCHMARK] Scaling to 20 Tabs (Heavy Multi-Tab Scenario)...');
  for (let i = 11; i <= 20; i++) {
    const v = new WebContentsView({
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    tabViews.push(v);
    if (isOptimized) {
      try { v.webContents.setBackgroundThrottling(true); } catch (_) {}
    }
    await v.webContents.loadURL(`data:text/html,<html><head><title>Tab ${i}</title></head><body style="background:#0b0f19;color:%23fff;font-family:sans-serif;padding:24px;"><h1>Tab ${i} - Heavy Concurrency</h1><script>setInterval(()=>{window.x=Math.random();}, 2000);</script></body></html>`);
  }
  await sleep(1200);
  const mem20Tabs = getDetailedMemory();
  console.log(`[BENCHMARK] RAM at 20 Tabs: ${mem20Tabs.totalWorkingSetMb} MB Total (Main: ${mem20Tabs.mainProcessMb} MB, Renderers: ${mem20Tabs.renderersTotalMb} MB across ${mem20Tabs.processCount} processes)`);

  // 6. Tab Switching Latency Under 20-Tab Load
  console.log('\n[BENCHMARK] Measuring Rapid Tab Switching Latency (20 iterations)...');
  const switchTimes = [];
  for (let i = 0; i < 20; i++) {
    const targetIdx = i % tabViews.length;
    const tSwitchStart = performance.now();
    mainWindow.contentView.removeChildView(tabViews[targetIdx]);
    mainWindow.contentView.addChildView(tabViews[targetIdx]);
    tabViews[targetIdx].setBounds({ x: 0, y: 76, width: 1440, height: 824 });
    switchTimes.push(performance.now() - tSwitchStart);
  }
  const avgSwitchMs = Math.round((switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length) * 100) / 100;
  console.log(`[BENCHMARK] Average Tab Switching Latency: ${avgSwitchMs} ms`);

  // 7. Event Loop Lag under load
  const lagStart = performance.now();
  await new Promise(r => setImmediate(r));
  const eventLoopLagMs = Math.round((performance.now() - lagStart) * 100) / 100;
  console.log(`[BENCHMARK] Event Loop Lag: ${eventLoopLagMs} ms`);

  // Clean up
  for (const v of tabViews) {
    try {
      if (v.webContents && !v.webContents.isDestroyed()) {
        v.webContents.close();
      }
    } catch (_) {}
  }
  mainWindow.destroy();

  results.metrics = {
    coldStartupMs,
    timeToFirstUsableInterfaceMs,
    newTabLoadMs,
    avgSwitchMs,
    eventLoopLagMs,
    memory: {
      oneTab: mem1Tab,
      fiveTabs: mem5Tabs,
      tenTabs: mem10Tabs,
      twentyTabs: mem20Tabs
    }
  };

  const outPath = path.join(__dirname, isOptimized ? 'benchmark_optimized.json' : 'benchmark_baseline.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\n[BENCHMARK] Results saved to ${outPath}\n`);

  app.quit();
});
