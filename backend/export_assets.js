require('dotenv').config();
const { db } = require('./models/db');
const fs = require('fs');
const path = require('path');

async function exportAssets() {
  const [rows] = await db.query(
    `SELECT 
      asset_id, equipment_category, equipment_name, brand, model, serial_id, 
      asset_tag_number, processor, storage, ram, operating_system, ip_address, 
      division, assigned_officer, designation, equipment_condition, 
      operational_status, remarks, qr_code_path 
    FROM assets 
    WHERE asset_id LIKE 'MoDE/%' 
    ORDER BY division, asset_id`
  );

  const outDir = path.resolve(__dirname, '..', 'files');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // JSON
  fs.writeFileSync(path.join(outDir, 'mode_assets_complete.json'), JSON.stringify(rows, null, 2));

  // CSV
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map(row =>
        headers
          .map(h => {
            const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
    ];
    fs.writeFileSync(path.join(outDir, 'mode_assets_complete.csv'), csvLines.join('\n'));
  }

  console.log(`Exported ${rows.length} assets to files/mode_assets_complete.json and CSV successfully.`);
  process.exit(0);
}

exportAssets().catch(err => {
  console.error(err);
  process.exit(1);
});

