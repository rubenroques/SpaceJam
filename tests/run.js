// Checks for Project Space Jam: a universe snapshot in Node, then headless Chromium checks.
//
//   cd tests && npm install && npx playwright install chromium && npm test
//
// The page loads Paper.js, seedrandom and ZzFX from CDNs, so the browser checks need network.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const UNIVERSE = 'spacejam-1';

// Hash of generated data for a fixed set of places (see universeHash). If this check fails,
// a change altered the shared universe. If that change is intended, change the default
// universe name in js/script.js (a new universe version) and put the new value here.
const UNIVERSE_SNAPSHOT = '5fd1e853';

const results = [];
function check(name, ok, detail) {
    results.push(ok);
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '  (' + detail + ')' : ''));
}

// ---- 1. Universe snapshot (Node only) ----
function universeHash() {
    Math.seedrandom = require('seedrandom');
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', 'helpers.js'), 'utf8'));
    let h = 2166136261;
    const add = (value) => {
        const s = JSON.stringify(value);
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    };
    const places = [[100, 200], [1000000, -1000000], [-999999, 123456], [-1, -1]];
    for (let x = -20; x <= 20; x += 4) for (let y = -20; y <= 20; y += 4) places.push([x, y]);
    for (const [sx, sy] of places) add(sectorData(UNIVERSE, sx, sy));   // includes the region
    for (const pilot of ['A', 'B', 'kx81q2']) {
        add(findSpawn(UNIVERSE, homeSector(UNIVERSE, pilot, null)));
        add(shipDesign(pilot));
    }
    add(findSpawn(UNIVERSE, homeSector(UNIVERSE, 'A', '100,200')));
    return (h >>> 0).toString(16);
}

// ---- 2. Browser checks ----
// Static server for the repo root on a free port (no dependency on serve.py or port 8080).
function serve() {
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.md': 'text/plain' };
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const url = decodeURIComponent(req.url.split('?')[0]);
            const file = path.join(ROOT, url === '/' ? 'index.html' : url);
            if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                return res.end();
            }
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

// Hash of the canvas pixels, without a centre box of +-mask pixels (where the ship is).
function canvasHash(mask) {
    const c = document.getElementById('myCanvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const w = c.width, h = c.height;
    let hs = 2166136261;
    for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
            if (Math.abs(x - w / 2) < mask && Math.abs(y - h / 2) < mask) continue;
            const i = (y * w + x) * 4;
            hs = Math.imul(hs ^ (d[i] | d[i + 1] << 8 | d[i + 2] << 16), 16777619);
        }
    }
    return hs >>> 0;
}

function canvasPixels() {
    const c = document.getElementById('myCanvas');
    return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
}

async function browserChecks(base) {
    const browser = await chromium.launch();
    const errors = [];
    const open = async (query) => {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        page.on('pageerror', (e) => errors.push(query + ': ' + e.message));
        page.on('console', (m) => {
            if (m.type() === 'error' && !/favicon/.test(m.text() + JSON.stringify(m.location()))) errors.push(query + ': ' + m.text());
        });
        await page.goto(base + '/index.html?' + query);
        await page.waitForTimeout(1500);
        return page;
    };
    const info = (page) => page.evaluate(() => window.spacejam.info());

    try {
        const a = await open('pilot=A&at=100,200&still=1');
        check('page starts', !!(await a.evaluate(() => window.spacejam)));
        const startFull = await a.evaluate(canvasHash, 0);
        const startMasked = await a.evaluate(canvasHash, 60);

        const b = await open('pilot=B&at=100,200&still=1');
        check('two pilots at one place see the same universe', startMasked === await b.evaluate(canvasHash, 60));
        await b.close();

        const fps = a.evaluate(() => new Promise((resolve) => {
            let n = 0, worst = 0;
            const t0 = performance.now();
            let last = t0;
            (function frame(t) {
                n++;
                if (t) { worst = Math.max(worst, t - last); last = t; }
                if (performance.now() - t0 < 3000) requestAnimationFrame(frame);
                else resolve({ fps: Math.round(n / 3), worstMs: Math.round(worst) });
            })();
        }));
        await a.keyboard.down('w');
        await a.waitForTimeout(700);
        await a.keyboard.down('d');
        await a.waitForTimeout(250);
        await a.keyboard.up('d');
        const perf = await fps;
        await a.keyboard.up('w');
        const moved = await info(a);
        check('thrust moves the ship', moved.x !== 40200 || moved.y !== 80200);
        console.log('INFO  frame rate while thrusting: ' + perf.fps + ' fps, worst frame ' + perf.worstMs + ' ms (headless, not a pass rule)');

        await a.evaluate(() => window.spacejam.restart());
        await a.waitForTimeout(600);
        check('frame after restart equals the first frame', startFull === await a.evaluate(canvasHash, 0));

        const before = await a.evaluate(canvasPixels);
        await a.evaluate(() => window.spacejam.shiftOrigin(37, -12));
        await a.waitForTimeout(300);
        const after = await a.evaluate(canvasPixels);
        let changed = 0;
        for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) changed++;
        check('moving the origin keeps the frame', changed < before.length * 1e-4,
              changed + ' of ' + before.length + ' colour values differ, edge anti-aliasing');
        await a.close();

        const far = await open('pilot=C&at=1000000,-1000000');
        const fi = await info(far);
        check('far place loads (sector 1,000,000, -1,000,000)', Number.isFinite(fi.x) && fi.sectors > 0, 'sector ' + fi.sector);
        await far.close();

        for (const query of ['pilot=A&zoomLevel=abc', 'pilot=A&zoomLevel=Infinity', 'pilot=A&at=Infinity,0', 'pilot=A&at=1e20,0']) {
            const p = await open(query);
            const pi = await info(p);
            check('bad input does not break the page: ' + query, Number.isFinite(pi.x) && pi.sectors > 0);
            await p.close();
        }

        check('no page or console errors', errors.length === 0, errors.join(' | '));
    } finally {
        await browser.close();
    }
}

(async () => {
    const hash = universeHash();
    check('universe snapshot', hash === UNIVERSE_SNAPSHOT, 'got ' + hash);
    const server = await serve();
    try {
        await browserChecks('http://127.0.0.1:' + server.address().port);
    } finally {
        server.close();
    }
    const failed = results.filter((ok) => !ok).length;
    console.log(failed ? failed + ' check(s) failed' : 'All ' + results.length + ' checks passed');
    process.exitCode = failed ? 1 : 0;
})();
