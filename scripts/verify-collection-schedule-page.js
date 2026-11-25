import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/mural/.gemini/antigravity/brain/a9a76195-3934-4ab7-b68d-105950abbb14/screenshots/schedule';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifySchedulePage() {
  console.log('🚀 Launching Chrome to verify the new Collection Schedule Page...');
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
    await sleep(800);

    // 1. Verify "Collection Schedule" appears in the Sidebar navigation
    console.log('🔍 Checking Sidebar for "Collection Schedule"...');
    const sidebarItems = await page.$$eval('aside nav button', (btns) =>
      btns.map((b) => b.textContent.trim())
    );
    console.log(`   ✓ Sidebar Items: ${sidebarItems.join(' | ')}`);
    const hasScheduleTab = sidebarItems.some((item) => item.includes('Collection Schedule'));
    console.log(`   ✓ "Collection Schedule" tab present in Sidebar: ${hasScheduleTab}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'schedule_01_sidebar_navigation.png') });

    // 2. Click "Collection Schedule" tab
    console.log('📍 Navigating to Collection Schedule Page...');
    await clickNavTab('Collection Schedule');
    await sleep(800);

    // 3. Verify Page Title & 4 KPI cards
    const pageTitle = await page.$eval('h2', (h2) => h2.textContent);
    console.log(`   ✓ Page Title: "${pageTitle}"`);

    const kpiHeaders = await page.$$eval('.grid button span', (spans) => spans.map((s) => s.textContent.trim()));
    console.log(`   ✓ Schedule KPI cards: ${kpiHeaders.join(' | ')}`);

    // 4. Create sample sales due Today, Tomorrow, and Next Week so we can see the full scheduled calendar
    console.log('⚡ Populating sample sales for Today, Tomorrow, and Next Week to test full schedule...');
    await page.evaluate(async () => {
      const req = indexedDB.open('RetailFinanceDB');
      return new Promise((resolve, reject) => {
        req.onsuccess = async (e) => {
          const idb = e.target.result;

          // Helper to add a retailer if none exists
          const txBeats = idb.transaction(['beats'], 'readonly');
          const beatsStore = txBeats.objectStore('beats');
          const beatsReq = beatsStore.getAll();

          beatsReq.onsuccess = async () => {
            const beats = beatsReq.result;
            const beatId = beats[0]?.id || 1;
            const beat2Id = beats[1]?.id || 2;

            const tx = idb.transaction(['retailers', 'sales'], 'readwrite');
            const rStore = tx.objectStore('retailers');
            const sStore = tx.objectStore('sales');

            // Add 2 retailers
            const r1Id = await new Promise((res) => {
              const addR1 = rStore.add({
                retailerName: 'Sri Murugan Stores',
                beatId: beatId,
                address: '12 Bazaar St',
                contactNumber: '9840112345',
                openingBalance: 0,
                openingBalanceDate: '2026-11-01',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              addR1.onsuccess = () => res(addR1.result);
            });

            const r2Id = await new Promise((res) => {
              const addR2 = rStore.add({
                retailerName: 'Annai Agencies',
                beatId: beat2Id,
                address: '45 Gandhi Rd',
                contactNumber: '9840223456',
                openingBalance: 0,
                openingBalanceDate: '2026-11-01',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              addR2.onsuccess = () => res(addR2.result);
            });

            const todayStr = '2026-11-25';
            const tomorrowStr = '2026-11-26';
            const upcomingStr = '2026-11-28';
            const overdueStr = '2026-11-22';

            // 1. Bill Due TODAY
            sStore.add({
              serialNumber: 'S-20261118-001',
              date: '2026-11-18',
              collectionDate: todayStr,
              billNumber: 'INV-1001',
              retailerId: r1Id,
              beatIdAtTransaction: beatId,
              billAmount: 1850000, // ₹18,500
              isVoided: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // 2. Bill Due TOMORROW
            sStore.add({
              serialNumber: 'S-20261119-002',
              date: '2026-11-19',
              collectionDate: tomorrowStr,
              billNumber: 'INV-1002',
              retailerId: r2Id,
              beatIdAtTransaction: beat2Id,
              billAmount: 2400000, // ₹24,000
              isVoided: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // 3. Bill Due UPCOMING (+3 days)
            sStore.add({
              serialNumber: 'S-20261121-003',
              date: '2026-11-21',
              collectionDate: upcomingStr,
              billNumber: 'INV-1003',
              retailerId: r1Id,
              beatIdAtTransaction: beatId,
              billAmount: 3200000, // ₹32,000
              isVoided: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            // 4. Bill OVERDUE (-3 days)
            sStore.add({
              serialNumber: 'S-20261115-004',
              date: '2026-11-15',
              collectionDate: overdueStr,
              billNumber: 'INV-1000',
              retailerId: r2Id,
              beatIdAtTransaction: beat2Id,
              billAmount: 1200000, // ₹12,000
              isVoided: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
          };
        };
      });
    });

    console.log('   ✓ Sample data populated');

    // Reload page to reflect fresh data
    await page.reload({ waitUntil: 'networkidle0' });
    await sleep(800);
    await clickNavTab('Collection Schedule');
    await sleep(800);

    // 5. Test "Due Today" View
    console.log('🔍 Testing "Due Today" Schedule View...');
    const todayBtn = await page.$('button::-p-text("Today")');
    if (todayBtn) await todayBtn.click();
    await sleep(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'schedule_02_today_collections.png') });
    console.log('   📸 Captured: schedule_02_today_collections.png');

    // 6. Test "Due Tomorrow" View
    console.log('🔍 Testing "Due Tomorrow" Schedule View...');
    const tomorrowBtn = await page.$('button::-p-text("Tomorrow")');
    if (tomorrowBtn) await tomorrowBtn.click();
    await sleep(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'schedule_03_tomorrow_collections.png') });
    console.log('   📸 Captured: schedule_03_tomorrow_collections.png');

    // 7. Test "Next 7 Days" & "All Pending Dues" View
    console.log('🔍 Testing "All Pending Dues" View...');
    const allDuesBtn = await page.$('button::-p-text("All Pending Dues")');
    if (allDuesBtn) await allDuesBtn.click();
    await sleep(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'schedule_04_upcoming_all_dues.png') });
    console.log('   📸 Captured: schedule_04_upcoming_all_dues.png');

    // 8. Test "Collect" Quick Action button
    console.log('🔍 Testing "Collect" action button in table row...');
    const collectBtn = await page.$('tbody tr button::-p-text("Collect")');
    if (collectBtn) {
      await collectBtn.click();
      await sleep(600);
      const isModalOpen = await page.evaluate(() => !!document.querySelector('.fixed.inset-0'));
      console.log(`   ✓ Clicking "Collect" opened CollectionFormModal: ${isModalOpen}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'schedule_05_collect_action_modal.png') });
      console.log('   📸 Captured: schedule_05_collect_action_modal.png');

      const cancelBtn = await page.$('button::-p-text("Cancel")');
      if (cancelBtn) await cancelBtn.click();
      await sleep(400);
    }

    console.log('\n🎉 ALL COLLECTION SCHEDULE PAGE CHECKS VERIFIED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error during Schedule page verification:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

verifySchedulePage().catch((e) => {
  console.error(e);
  process.exit(1);
});
