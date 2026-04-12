// Script to fetch AngelOne Scrip Master data and save as JSON
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRIP_MASTER_URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';
const OUTPUT_FILE = path.join(__dirname, '../public/data/scripMaster.json');

async function fetchScripMaster() {
  try {
    console.log('📥 Fetching scrip master data from AngelOne...');
    const response = await axios.get(SCRIP_MASTER_URL, {
      timeout: 30000, // 30 second timeout
    });

    const data = response.data;
    console.log(`✅ Fetched ${Array.isArray(data) ? data.length : Object.keys(data).length} records`);

    // Create directory if it doesn't exist
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created directory: ${outputDir}`);
    }

    // Save raw data
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Saved to: ${OUTPUT_FILE}`);

    // Filter and show stats
    if (Array.isArray(data)) {
      const nseEquity = data.filter(
        (item) => item.exchange === 'NSE' && item.instrumenttype === 'EQ'
      );
      const bseEquity = data.filter(
        (item) => item.exchange === 'BSE' && item.instrumenttype === 'EQ'
      );
      
      console.log('\n📊 Statistics:');
      console.log(`   NSE Equity: ${nseEquity.length}`);
      console.log(`   BSE Equity: ${bseEquity.length}`);
      console.log(`   Total Records: ${data.length}`);
    }

    console.log('\n✅ Scrip master data saved successfully!');
  } catch (error) {
    console.error('❌ Error fetching scrip master:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    process.exit(1);
  }
}

fetchScripMaster();

