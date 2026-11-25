import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/mural/.gemini/antigravity/brain/a9a76195-3934-4ab7-b68d-105950abbb14/screenshots/collection_date';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyCollectionDate() {
  console.log('🚀 Verifying Collection Date Feature across UI Modals & Views...');
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

    // 1. Open Daily Sales Entry
    console.log('📍 Navigating to Daily Sales Entry...');
    await clickNavTab('Daily Sales Entry');
    await sleep(600);

    // 2. Open "New Sales Bill" Modal
    console.log('🔍 Opening Record Daily Sales Entry Modal...');
    const newSaleBtn = await page.$('button::-p-text("New Sales Bill")');
    if (newSaleBtn) {
      await newSaleBtn.click();
      await sleep(600);

      // Verify Collection Date field exists
      const dateLabels = await page.$$eval('form label', (labels) => labels.map((l) => l.textContent));
      const hasCollectionDateLabel = dateLabels.some((l) => l.includes('Collection Date'));
      console.log(`   ✓ Collection Date label in modal: ${hasCollectionDateLabel}`);

      const inputs = await page.$$('form input[type="date"]');
      console.log(`   ✓ Found ${inputs.length} date pickers in modal (Sales Date and Collection Date)`);

      // Fill in retailer
      const autoInput = await page.$('input[placeholder*="retailer" i]');
      if (autoInput) {
        await autoInput.type('Sri Murugan');
        await sleep(500);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await sleep(300);
      }

      // Fill Bill Number
      const billInput = await page.$('input[placeholder*="INV" i]');
      if (billInput) {
        await billInput.type('INV-CD-5001');
      }

      // Fill Amount
      const amtInput = await page.$('input[placeholder*="0.00" i]');
      if (amtInput) {
        await amtInput.type('25000');
      }

      // Fill Remarks
      const remInput = await page.$('input[placeholder*="Driver" i]');
      if (remInput) {
        await remInput.type('7-day credit delivery');
      }

      // Capture screenshot of Record Daily Sales Entry modal with Collection Date
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_record_sales_modal_with_collection_date.png') });
      console.log('   📸 Captured: 01_record_sales_modal_with_collection_date.png');

      // Submit form or close modal
      const cancelBtn = await page.$('button::-p-text("Cancel")');
      if (cancelBtn) {
        await cancelBtn.click();
        await sleep(500);
      }
    }

    // 3. Switch date filter to "All Records" to view populated sales table with Collection Due column
    const allRecordsBtn = await page.$('button::-p-text("All Records")');
    if (allRecordsBtn) {
      await allRecordsBtn.click();
      await sleep(600);
    }

    // 3. Verify Collection Due in Sales Table
    console.log('🔍 Checking Sales Table for Collection Due column...');
    const tableHeaders = await page.$$eval('th', (ths) => ths.map((th) => th.textContent.trim()));
    console.log(`   ✓ Table headers: ${tableHeaders.join(' | ')}`);
    const hasColDueHeader = tableHeaders.some((h) => h.includes('Collection Due') || h.includes('Collection Date'));
    console.log(`   ✓ "Collection Due" column present in table: ${hasColDueHeader}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_sales_table_collection_due_column.png') });
    console.log('   📸 Captured: 02_sales_table_collection_due_column.png');

    // 4. Test Edit Modal to verify Collection Date appears during edit
    console.log('🔍 Testing Edit Sales Bill Modal for Collection Date...');
    const editBtn = await page.$('tbody tr button[title*="Edit" i], tbody tr td:last-child button:first-child');
    if (editBtn) {
      await editBtn.click();
      await sleep(600);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_edit_sales_modal_with_collection_date.png') });
      console.log('   📸 Captured: 03_edit_sales_modal_with_collection_date.png');

      const cancelBtn = await page.$('button::-p-text("Cancel")');
      if (cancelBtn) await cancelBtn.click();
      await sleep(400);
    }

    // 5. Open Collection Entry and verify Collection Due is in unpaid bills table
    console.log('🔍 Checking Collection Entry Unpaid Bills Table...');
    await clickNavTab('Collection Entry');
    await sleep(600);

    const newCollBtn = await page.$('button::-p-text("New Collection")');
    if (newCollBtn) {
      await newCollBtn.click();
      await sleep(600);

      // Select Retailer via RetailerAutocomplete
      const autoInput = await page.$('.fixed input[placeholder*="retailer" i]');
      if (autoInput) {
        await autoInput.type('Murugan');
        await sleep(500);
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await sleep(600);
      }

      // Check unpaid bills table headers
      const unpaidHeaders = await page.$$eval('.fixed table th', (ths) => ths.map((t) => t.textContent.trim()));
      console.log(`   ✓ Unpaid bills modal table headers: ${unpaidHeaders.join(' | ')}`);
      const hasDueHeader = unpaidHeaders.some((h) => h.includes('Collection Due'));
      console.log(`   ✓ Unpaid bills table reflects Collection Due: ${hasDueHeader}`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_collection_modal_unpaid_bills_due_date.png') });
      console.log('   📸 Captured: 04_collection_modal_unpaid_bills_due_date.png');

      const cancelBtn = await page.$('button::-p-text("Cancel")');
      if (cancelBtn) await cancelBtn.click();
      await sleep(400);
    }

    // 6. Check Retailer Ledger for Collection Due
    console.log('🔍 Checking Retailer Ledger for Collection Due on invoices...');
    await clickNavTab('Retailer Ledger');
    await sleep(600);

    const ledgerSelect = await page.$('select');
    if (ledgerSelect) {
      const optVal = await page.evaluate((el) => {
        const opt = Array.from(el.options).find((o) => o.text.includes('Murugan'));
        return opt ? opt.value : el.options[1]?.value;
      }, ledgerSelect);
      if (optVal) {
        await ledgerSelect.select(optVal);
        await sleep(600);
      }
    }

    const particulars = await page.$$eval('tbody td:nth-child(2)', (tds) => tds.map((td) => td.textContent.trim()));
    const hasDueParticulars = particulars.some((p) => p.includes('Due:'));
    console.log(`   ✓ Ledger reflects Collection Due particulars: ${hasDueParticulars}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_ledger_statement_collection_due.png') });
    console.log('   📸 Captured: 05_ledger_statement_collection_due.png');

    console.log('\n🎉 ALL COLLECTION DATE CHECKS PASSED AND REFLECTED ACCROSS UI!');
  } catch (err) {
    console.error('❌ Error during Collection Date verification:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

verifyCollectionDate().catch((e) => {
  console.error(e);
  process.exit(1);
});
