/**
 * controllers/asset.controller.js
 */

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { db } = require("../models/db");

const qrcodeDir = path.resolve(__dirname, "..", "uploads", "qrcodes");
if (!fs.existsSync(qrcodeDir)) {
  fs.mkdirSync(qrcodeDir, { recursive: true });
}

// Get all assets + statistics + recent activities for the dashboard
exports.getDashboardData = async (req, res) => {
  try {
    const conn = await db.getConnection();

    try {
      // 1. Get statistics
      const [[{ totalAssets }]] = await conn.query("SELECT COUNT(*) as totalAssets FROM assets");
      const [[{ inUse }]] = await conn.query("SELECT COUNT(*) as inUse FROM assets WHERE status IN ('In Use', 'In use')");
      const [[{ available }]] = await conn.query("SELECT COUNT(*) as available FROM assets WHERE status IN ('Available', 'No use', 'Unpack')");
      const [[{ inMaintenance }]] = await conn.query("SELECT COUNT(*) as inMaintenance FROM assets WHERE status IN ('Maintenance', 'Repair', 'Broken')");

      // 2. Get assets list with assigned user details
      const [assets] = await conn.query(`
        SELECT a.*, u.username as assigned_user_name, u.email as assigned_user_email
        FROM assets a
        LEFT JOIN users u ON a.assigned_user_id = u.id
        ORDER BY a.division ASC, a.asset_id ASC
      `);

      // 3. Get recent activities
      const [activities] = await conn.query(`
        SELECT aa.*, u.username as user_name
        FROM asset_activities aa
        LEFT JOIN users u ON aa.user_id = u.id
        ORDER BY aa.created_at DESC
        LIMIT 10
      `);

      res.json({
        stats: { totalAssets, inUse, available, inMaintenance },
        assets,
        activities
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error fetching asset dashboard data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create new asset
exports.createAsset = async (req, res) => {
  try {
    const {
      asset_id, asset_name, description, category, serial_id, status, assigned_user_id,
      equipment_category, equipment_name, brand, model, asset_tag_number,
      processor, storage, ram, operating_system, ip_address, division,
      assigned_officer, designation, equipment_condition, operational_status, remarks
    } = req.body;

    let image_path = null;
    if (req.file) {
      image_path = req.file.path;
    }

    const effectiveSerial = serial_id || req.body.serial_number || "";
    const effectiveCategory = equipment_category || category || "General";
    const effectiveName = equipment_name || asset_name || `${brand || ""} ${model || ""}`.trim() || "Device";
    const effectiveStatus = operational_status || status || "In Use";

    // Generate QR Code
    let relativeQrPath = null;
    let qrPayload = null;
    if (asset_id) {
      const safeId = asset_id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const qrFileName = `qr_${safeId}.png`;
      const qrFilePath = path.join(qrcodeDir, qrFileName);
      relativeQrPath = `uploads/qrcodes/${qrFileName}`;

      qrPayload = JSON.stringify({
        org: "Ministry of Digital Economy (MoDE)",
        asset_id: asset_id,
        serial_number: effectiveSerial,
        asset_tag: asset_tag_number || "",
        category: effectiveCategory,
        name: effectiveName,
        brand: brand || "",
        model: model || "",
        specs: { processor: processor || "-", ram: ram || "-", storage: storage || "-", os: operating_system || "-", ip: ip_address || "-" },
        division: division || "",
        assigned_officer: assigned_officer || "",
        designation: designation || "",
        condition: equipment_condition || "Good",
        status: effectiveStatus,
        remarks: remarks || "-"
      }, null, 2);

      await QRCode.toFile(qrFilePath, qrPayload, {
        errorCorrectionLevel: "M",
        type: "png",
        margin: 2,
        width: 350,
        color: { dark: "#1e1b4b", light: "#ffffff" }
      });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO assets (
          asset_id, asset_name, description, category, serial_id, status, assigned_user_id, image_path,
          equipment_category, equipment_name, brand, model, asset_tag_number,
          processor, storage, ram, operating_system, ip_address, division,
          assigned_officer, designation, equipment_condition, operational_status,
          remarks, qr_code_data, qr_code_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          asset_id || null, effectiveName, description || null, effectiveCategory, effectiveSerial,
          effectiveStatus, assigned_user_id || null, image_path,
          effectiveCategory, effectiveName, brand || null, model || null, asset_tag_number || null,
          processor || null, storage || null, ram || null, operating_system || null, ip_address || null, division || null,
          assigned_officer || null, designation || null, equipment_condition || "Good", effectiveStatus,
          remarks || null, qrPayload, relativeQrPath
        ]
      );

      const newAssetId = result.insertId;

      // Log activity
      await conn.query(
        `INSERT INTO asset_activities (asset_id, user_id, action_type, description)
         VALUES (?, ?, 'Registered', ?)`,
        [newAssetId, req.user?.userId || null, `Asset registered: ${effectiveName} (${asset_id || newAssetId})`]
      );

      await conn.commit();
      res.json({ message: "Asset created successfully", id: newAssetId, qr_code_path: relativeQrPath });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error creating asset:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "Asset ID must be unique" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Update an asset
exports.updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_id, asset_name, description, category, serial_id, status, assigned_user_id,
      equipment_category, equipment_name, brand, model, asset_tag_number,
      processor, storage, ram, operating_system, ip_address, division,
      assigned_officer, designation, equipment_condition, operational_status, remarks
    } = req.body;
    
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Check current state to log changes
      const [[currentAsset]] = await conn.query("SELECT * FROM assets WHERE id = ?", [id]);
      if (!currentAsset) {
        await conn.rollback();
        return res.status(404).json({ error: "Asset not found" });
      }

      let image_path = currentAsset.image_path;
      if (req.file) {
        image_path = req.file.path;
      }

      const effectiveId = asset_id || currentAsset.asset_id;
      const effectiveSerial = serial_id || req.body.serial_number || currentAsset.serial_id || "";
      const effectiveCategory = equipment_category || category || currentAsset.equipment_category || currentAsset.category || "General";
      const effectiveName = equipment_name || asset_name || currentAsset.asset_name;
      const effectiveStatus = operational_status || status || currentAsset.status || "In Use";
      const effectiveDivision = division || currentAsset.division;
      const effectiveOfficer = assigned_officer || currentAsset.assigned_officer;
      const effectiveCondition = equipment_condition || currentAsset.equipment_condition;

      // Regenerate QR Code if asset_id or serial changed
      let relativeQrPath = currentAsset.qr_code_path;
      let qrPayload = currentAsset.qr_code_data;
      if (effectiveId) {
        const safeId = effectiveId.replace(/[^a-zA-Z0-9_-]/g, "_");
        const qrFileName = `qr_${safeId}.png`;
        const qrFilePath = path.join(qrcodeDir, qrFileName);
        relativeQrPath = `uploads/qrcodes/${qrFileName}`;

        qrPayload = JSON.stringify({
          org: "Ministry of Digital Economy (MoDE)",
          asset_id: effectiveId,
          serial_number: effectiveSerial,
          asset_tag: asset_tag_number || currentAsset.asset_tag_number || "",
          category: effectiveCategory,
          name: effectiveName,
          brand: brand || currentAsset.brand || "",
          model: model || currentAsset.model || "",
          specs: {
            processor: processor || currentAsset.processor || "-",
            ram: ram || currentAsset.ram || "-",
            storage: storage || currentAsset.storage || "-",
            os: operating_system || currentAsset.operating_system || "-",
            ip: ip_address || currentAsset.ip_address || "-"
          },
          division: effectiveDivision || "",
          assigned_officer: effectiveOfficer || "",
          designation: designation || currentAsset.designation || "",
          condition: effectiveCondition || "Good",
          status: effectiveStatus,
          remarks: remarks || currentAsset.remarks || "-"
        }, null, 2);

        await QRCode.toFile(qrFilePath, qrPayload, {
          errorCorrectionLevel: "M",
          type: "png",
          margin: 2,
          width: 350,
          color: { dark: "#1e1b4b", light: "#ffffff" }
        });
      }

      await conn.query(
        `UPDATE assets SET 
          asset_id = ?, asset_name = ?, description = ?, category = ?, 
          serial_id = ?, status = ?, assigned_user_id = ?, image_path = ?,
          equipment_category = ?, equipment_name = ?, brand = ?, model = ?, asset_tag_number = ?,
          processor = ?, storage = ?, ram = ?, operating_system = ?, ip_address = ?, division = ?,
          assigned_officer = ?, designation = ?, equipment_condition = ?, operational_status = ?,
          remarks = ?, qr_code_data = ?, qr_code_path = ?
         WHERE id = ?`,
        [
          effectiveId || null, effectiveName, description || null, effectiveCategory,
          effectiveSerial, effectiveStatus, assigned_user_id || null, image_path,
          effectiveCategory, effectiveName, brand || null, model || null, asset_tag_number || null,
          processor || null, storage || null, ram || null, operating_system || null, ip_address || null, effectiveDivision || null,
          effectiveOfficer || null, designation || null, effectiveCondition || "Good", effectiveStatus,
          remarks || null, qrPayload, relativeQrPath, id
        ]
      );

      // Log activity based on status change or general update
      let actionType = 'Updated';
      let logDesc = `Asset ${effectiveName} details updated.`;

      if (currentAsset.status !== effectiveStatus && (effectiveStatus === 'Maintenance' || effectiveStatus === 'Broken' || effectiveStatus === 'Repair')) {
        actionType = 'Maintenance Logged';
        logDesc = `Asset reported for maintenance (${effectiveStatus}).`;
      } else if (currentAsset.assigned_officer !== effectiveOfficer && effectiveOfficer) {
        actionType = 'Reassigned';
        logDesc = `Asset assigned to officer ${effectiveOfficer}.`;
      }

      await conn.query(
        `INSERT INTO asset_activities (asset_id, user_id, action_type, description)
         VALUES (?, ?, ?, ?)`,
        [id, req.user?.userId || null, actionType, logDesc]
      );

      await conn.commit();
      res.json({ message: "Asset updated successfully", qr_code_path: relativeQrPath });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error updating asset:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: "Asset ID must be unique" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete an asset
exports.deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM assets WHERE id = ?", [id]);
    res.json({ message: "Asset deleted successfully" });
  } catch (error) {
    console.error("Error deleting asset:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
