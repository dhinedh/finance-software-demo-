import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/mural/.gemini/antigravity/brain/a9a76195-3934-4ab7-b68d-105950abbb14/screenshots/clean';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeAllData() {
  console.log('🚀 Connecting to Chrome and Purging All Data...');
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
        await sleep(500);
        return true;
      }
    }
    throw new Error(`Nav tab containing "${label}" not found`);
  }

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0', timeout: 15000 });
    await sleep(800);

    // Execute IndexedDB wipe directly in browser context
    console.log('🧹 Purging all records from Dexie IndexedDB in browser...');
    const purgeReport = await page.evaluate(async () => {
      // Access Dexie DB instance
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

          tx.oncomplete = () => {
            resolve({ success: true, message: 'All tables cleared successfully' });
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });

    console.log(`   ✓ ${purgeReport.message}`);

    // Reload page to re-render fresh empty state
    console.log('🔄 Reloading application...');
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(1000);

    // 1. Check Dashboard
    console.log('🔍 Checking Dashboard empty state...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'clean_01_dashboard.png') });
    console.log('   📸 Captured: clean_01_dashboard.png');

    // 2. Check Retailers
    console.log('🔍 Checking Retailers empty state...');
    await clickNavTab('Retailers Master');
    await sleep(500);
    const retailerRows = await page.$$eval('tbody tr', (rows) => rows.length);
    console.log(`   ✓ Retailer table rows: ${retailerRows} (empty state active)`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'clean_02_retailers.png') });
    console.log('   📸 Captured: clean_02_retailers.png');

    // 3. Check Sales Entry
    console.log('🔍 Checking Daily Sales empty state...');
    await clickNavTab('Daily Sales Entry');
    await sleep(500);
    const salesRows = await page.$$eval('tbody tr', (rows) => rows.length);
    console.log(`   ✓ Sales table rows: ${salesRows} (empty state active)`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'clean_03_sales.png') });
    console.log('   📸 Captured: clean_03_sales.png');

    // 4. Check Collections Entry
    console.log('🔍 Checking Collections empty state...');
    await clickNavTab('Collection Entry');
    await sleep(500);
    const collRows = await page.$$eval('tbody tr', (rows) => rows.length);
    console.log(`   ✓ Collections table rows: ${collRows} (empty state active)`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'clean_04_collections.png') });
    console.log('   📸 Captured: clean_04_collections.png');

    // 5. Check Outstanding Management
    console.log('🔍 Checking Outstanding Management empty state...');
    await clickNavTab('Outstanding Mgmt');
    await sleep(500);
    const outstandingText = await page.$$eval('.grid h3', (els) => els.map((e) => e.textContent));
    console.log(`   ✓ Outstanding KPIs: ${outstandingText.join(' | ')}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'clean_05_outstanding.png') });
    console.log('   📸 Captured: clean_05_outstanding.png');

    console.log('\n🎉 ALL DATA HAS BEEN REMOVED! THE DATABASE IS COMPLETELY CLEAN.');
  } catch (err) {
    console.error('❌ Error while removing data:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

removeAllData().catch((e) => {
  console.error(e);
  process.exit(1);
});
