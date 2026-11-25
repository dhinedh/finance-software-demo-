import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/mural/.gemini/antigravity/brain/a9a76195-3934-4ab7-b68d-105950abbb14/screenshots/nomock';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wipeAllMockData() {
  console.log('🚀 Launching Chrome to wipe all mock data and capture pristine empty state...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  async function clickNavTab(label) {
    const navButtons = await page.$$('nav button');
    for (const btn of navButtons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes(label)) {
        await btn.click();
        await sleep(600);
        return true;
      }
    }
    throw new Error(`Nav tab containing "${label}" not found`);
  }

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(1000);

    // Clear all transactional and mock data in browser IndexedDB
    console.log('🧹 Purging all tables in RetailFinanceDB...');
    const result = await page.evaluate(async () => {
      const req = indexedDB.open('RetailFinanceDB');
      return new Promise((resolve, reject) => {
        req.onsuccess = (e) => {
          const idb = e.target.result;
          const tx = idb.transaction(
            ['retailers', 'sales', 'collections', 'collectionAllocations', 'dailyBalances', 'auditLogs'],
            'readwrite'
          );

          tx.objectStore('retailers').clear();
          tx.objectStore('sales').clear();
          tx.objectStore('collections').clear();
          tx.objectStore('collectionAllocations').clear();
          tx.objectStore('dailyBalances').clear();
          tx.objectStore('auditLogs').clear();

          tx.oncomplete = () => resolve({ cleared: true });
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log('   ✓ Tables cleared:', result.cleared);

    // Reload page to reflect fresh empty state
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    // Verify record counts
    const counts = await page.evaluate(async () => {
      const req = indexedDB.open('RetailFinanceDB');
      return new Promise((resolve) => {
        req.onsuccess = (e) => {
          const idb = e.target.result;
          const tx = idb.transaction(
            ['beats', 'retailers', 'sales', 'collections', 'collectionAllocations'],
            'readonly'
          );

          Promise.all([
            new Promise((r) => (tx.objectStore('beats').count().onsuccess = (ev) => r(ev.target.result))),
            new Promise((r) => (tx.objectStore('retailers').count().onsuccess = (ev) => r(ev.target.result))),
            new Promise((r) => (tx.objectStore('sales').count().onsuccess = (ev) => r(ev.target.result))),
            new Promise((r) => (tx.objectStore('collections').count().onsuccess = (ev) => r(ev.target.result))),
            new Promise((r) => (tx.objectStore('collectionAllocations').count().onsuccess = (ev) => r(ev.target.result))),
          ]).then(([beats, retailers, sales, collections, allocations]) => {
            resolve({ beats, retailers, sales, collections, allocations });
          });
        };
      });
    });

    console.log('   ✓ Verified DB Counts:', counts);

    // 1. Capture Clean Dashboard
    console.log('📸 1. Capturing Clean Dashboard...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_dashboard_no_mock.png') });

    // 2. Capture Clean Retailers Master
    console.log('📸 2. Capturing Clean Retailers Master...');
    await clickNavTab('Retailers Master');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_retailers_no_mock.png') });

    // 3. Capture Clean Daily Sales
    console.log('📸 3. Capturing Clean Daily Sales Entry...');
    await clickNavTab('Daily Sales Entry');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_sales_no_mock.png') });

    // 4. Capture Clean Collections
    console.log('📸 4. Capturing Clean Collection Entry...');
    await clickNavTab('Collection Entry');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_collections_no_mock.png') });

    // 5. Capture Clean Collection Schedule
    console.log('📸 5. Capturing Clean Collection Schedule...');
    await clickNavTab('Collection Schedule');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_schedule_no_mock.png') });

    // 6. Capture Clean Outstanding
    console.log('📸 6. Capturing Clean Outstanding Mgmt...');
    await clickNavTab('Outstanding Mgmt');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06_outstanding_no_mock.png') });

    console.log('🎉 ALL MOCK DATA HAS BEEN PURGED AND SCREENSHOTS CAPTURED!');
  } finally {
    await browser.close();
  }
}

wipeAllMockData().catch((err) => {
  console.error('❌ Wipe failed:', err);
  process.exit(1);
});
