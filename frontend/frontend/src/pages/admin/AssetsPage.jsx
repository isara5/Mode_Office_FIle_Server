import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Database,
  User,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  QrCode,
  Printer,
  Download,
  Search,
  Filter,
  Eye,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Layers,
  X
} from "lucide-react";
import { AssetsAPI, UsersAPI, BASE_URL } from "../../api";
import { Modal } from "../../components/Modal";

// Quick timeAgo helper
const timeAgo = (dateInput) => {
  if (!dateInput) return "";
  const diffMs = new Date() - new Date(dateInput);
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return `yesterday`;
  return `${diffDays}d ago`;
};

const DIVISIONS = [
  "All",
  "Accounts",
  "Administration",
  "Commercialization",
  "Development",
  "General",
  "General-admin",
  "Ict",
  "Internal audit",
  "Planning",
  "Procurement",
  "Secretary Office",
];

const CATEGORIES = [
  "All",
  "Laptop",
  "Desktop",
  "Printer",
  "Landphone",
  "Smart board",
  "Tv",
  "Shredder machine",
  "Monitor",
  "Computer",
];

export function AssetsPage() {
  const [data, setData] = useState({ stats: {}, assets: [], activities: [] });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedAssetForQr, setSelectedAssetForQr] = useState(null);
  const [editAsset, setEditAsset] = useState(null);
  const [copiedSerial, setCopiedSerial] = useState(null);

  // Form State
  const initialForm = {
    asset_id: "",
    equipment_category: "Laptop",
    equipment_name: "Laptop computer",
    brand: "",
    model: "",
    serial_id: "",
    asset_tag_number: "",
    processor: "",
    storage: "",
    ram: "",
    operating_system: "",
    ip_address: "",
    division: "Accounts",
    assigned_officer: "",
    designation: "",
    equipment_condition: "Good",
    operational_status: "In use",
    remarks: "",
    assigned_user_id: "",
    description: "",
  };

  const [form, setForm] = useState(initialForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);
  const printAreaRef = useRef(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [assetsRes, usersRes] = await Promise.all([
        AssetsAPI.list(),
        UsersAPI.list(),
      ]);
      setData(assetsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error("Failed to fetch assets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditAsset(null);
    setForm(initialForm);
    setImageFile(null);
    setImagePreview(null);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditAsset(a);
    setForm({
      asset_id: a.asset_id || "",
      equipment_category: a.equipment_category || a.category || "Laptop",
      equipment_name: a.equipment_name || a.asset_name || "",
      brand: a.brand || "",
      model: a.model || "",
      serial_id: a.serial_id || "",
      asset_tag_number: a.asset_tag_number || "",
      processor: a.processor || "",
      storage: a.storage || "",
      ram: a.ram || "",
      operating_system: a.operating_system || "",
      ip_address: a.ip_address || "",
      division: a.division || "Accounts",
      assigned_officer: a.assigned_officer || "",
      designation: a.designation || "",
      equipment_condition: a.equipment_condition || "Good",
      operational_status: a.operational_status || a.status || "In use",
      remarks: a.remarks || "",
      assigned_user_id: a.assigned_user_id || "",
      description: a.description || "",
    });
    setImageFile(null);
    setImagePreview(a.image_path ? `${BASE_URL}/${a.image_path.replace(/\\/g, "/")}` : null);
    setError("");
    setModalOpen(true);
  };

  const openQrModal = (asset) => {
    setSelectedAssetForQr(asset);
    setQrModalOpen(true);
  };

  const handleCopySerial = (serial) => {
    if (!serial) return;
    navigator.clipboard.writeText(serial);
    setCopiedSerial(serial);
    setTimeout(() => setCopiedSerial(null), 2000);
  };

  const handlePrintSticker = () => {
    window.print();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.asset_id) {
      setError("Asset ID (e.g. MoDE/FIN/001) is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      Object.keys(form).forEach((key) => {
        if (form[key] !== null && form[key] !== undefined) {
          formData.append(key, form[key]);
        }
      });

      // Composite asset_name for fallback
      const compositeName = `${form.brand || ""} ${form.model || ""}`.trim() || form.equipment_name || "Device";
      formData.set("asset_name", compositeName);
      formData.set("category", form.equipment_category);
      formData.set("status", form.operational_status);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      if (editAsset) {
        await AssetsAPI.update(editAsset.id, formData);
      } else {
        await AssetsAPI.create(formData);
      }

      await fetchAll();
      setModalOpen(false);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this asset?")) return;
    try {
      await AssetsAPI.delete(id);
      fetchAll();
    } catch (err) {
      alert("Failed to delete asset");
    }
  };

  const renderStatus = (status) => {
    const s = (status || "Available").toLowerCase();
    let classes = "";
    let dotClass = "";

    if (s.includes("in use")) {
      classes = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
      dotClass = "bg-emerald-500";
    } else if (s.includes("repair") || s.includes("broken") || s.includes("maintenance")) {
      classes = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
      dotClass = "bg-rose-500";
    } else if (s.includes("unpack")) {
      classes = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
      dotClass = "bg-amber-500";
    } else {
      classes = "bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20";
      dotClass = "bg-slate-500";
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${classes}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {status || "In use"}
      </span>
    );
  };

  const renderCondition = (cond) => {
    const c = (cond || "").toLowerCase();
    let colorClass = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    if (c.includes("very good")) {
      colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    } else if (c.includes("good")) {
      colorClass = "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    } else if (c.includes("bad")) {
      colorClass = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    }
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${colorClass}`}>
        {cond || "-"}
      </span>
    );
  };

  if (loading && !data.assets?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-semibold text-sm">Loading Asset Registry...</p>
      </div>
    );
  }

  const { stats = {}, assets = [], activities = [] } = data;

  // Filter logic
  const filteredAssets = assets.filter((asset) => {
    // Division filter
    if (selectedDivision !== "All" && asset.division !== selectedDivision) {
      return false;
    }
    // Category filter
    if (
      selectedCategory !== "All" &&
      asset.equipment_category !== selectedCategory &&
      asset.category !== selectedCategory
    ) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = (asset.asset_id || "").toLowerCase().includes(q);
      const matchTag = (asset.asset_tag_number || "").toLowerCase().includes(q);
      const matchSerial = (asset.serial_id || "").toLowerCase().includes(q);
      const matchName = (asset.asset_name || "").toLowerCase().includes(q);
      const matchEquip = (asset.equipment_name || "").toLowerCase().includes(q);
      const matchBrand = (asset.brand || "").toLowerCase().includes(q);
      const matchModel = (asset.model || "").toLowerCase().includes(q);
      const matchOfficer = (asset.assigned_officer || "").toLowerCase().includes(q);
      const matchRemarks = (asset.remarks || "").toLowerCase().includes(q);
      return (
        matchId ||
        matchTag ||
        matchSerial ||
        matchName ||
        matchEquip ||
        matchBrand ||
        matchModel ||
        matchOfficer ||
        matchRemarks
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 px-2.5 py-1 rounded-lg">
              Total Assets
            </span>
          </div>
          <h3 className="text-3xl font-extrabold text-[var(--text-main)]">
            {stats.totalAssets || assets.length}
          </h3>
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
            Registered Ministry Devices
          </p>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2.5 py-1 rounded-lg">
              Operational
            </span>
          </div>
          <h3 className="text-3xl font-extrabold text-[var(--text-main)]">
            {stats.inUse || 0}
          </h3>
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
            Currently In Use
          </p>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400 px-2.5 py-1 rounded-lg">
              Attention
            </span>
          </div>
          <h3 className="text-3xl font-extrabold text-[var(--text-main)]">
            {stats.inMaintenance || 0}
          </h3>
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
            Repair / Broken / Faulty
          </p>
        </div>

        <div className="bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-2xl p-5 flex flex-col relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400 px-2.5 py-1 rounded-lg">
              QR Tagged
            </span>
          </div>
          <h3 className="text-3xl font-extrabold text-[var(--text-main)]">
            {assets.filter((a) => a.qr_code_path).length}
          </h3>
          <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
            QR Stickers Generated
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-4">
        {/* Header and Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--bg-panel)] border border-[var(--border-main)] p-4 rounded-2xl">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
              Ministry Asset Register & QR Codes
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Official IT inventory of the Ministry of Digital Economy (MoDE). Showing{" "}
              <strong className="text-[var(--text-main)]">{filteredAssets.length}</strong> of {assets.length} devices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold px-4 py-2 rounded-xl transition-all shadow-md text-sm"
            >
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-main)] p-4 rounded-2xl flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Asset ID, Serial No, Tag, Officer, Model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-xl pl-9 pr-4 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Division Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Division:</span>
            <select
              value={selectedDivision}
              onChange={(e) => setSelectedDivision(e.target.value)}
              className="bg-[var(--bg-soft)] border border-[var(--border-main)] text-xs text-[var(--text-main)] rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-indigo-500"
            >
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-[var(--bg-soft)] border border-[var(--border-main)] text-xs text-[var(--text-main)] rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-indigo-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {(selectedDivision !== "All" || selectedCategory !== "All" || searchQuery) && (
            <button
              onClick={() => {
                setSelectedDivision("All");
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Table Area */}
        <div className="bg-[var(--bg-panel)] border border-[var(--border-main)] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-soft)] text-[var(--text-muted)] uppercase tracking-wider font-bold text-[10px]">
                  <th className="px-4 py-3 text-center">QR Code</th>
                  <th className="px-4 py-3">Asset ID / Tag</th>
                  <th className="px-4 py-3">Device / Model</th>
                  <th className="px-4 py-3">Serial Number</th>
                  <th className="px-4 py-3">Specs (Processor / RAM / Storage / OS)</th>
                  <th className="px-4 py-3">Division</th>
                  <th className="px-4 py-3">Assigned Officer</th>
                  <th className="px-4 py-3">Condition & Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)]">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-5 py-12 text-center text-[var(--text-muted)]">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-semibold">No assets found matching the criteria.</p>
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => {
                    const qrUrl = asset.qr_code_path
                      ? `${BASE_URL}/${asset.qr_code_path.replace(/\\/g, "/")}`
                      : null;

                    return (
                      <tr
                        key={asset.id}
                        className="hover:bg-[var(--bg-soft)]/60 transition-colors group"
                      >
                        {/* QR Code Column */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {qrUrl ? (
                            <button
                              onClick={() => openQrModal(asset)}
                              className="relative inline-block group/qr p-1 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 hover:scale-105 transition-transform shadow-xs"
                              title="Click to view & print QR Sticker"
                            >
                              <img
                                src={qrUrl}
                                alt="QR Code"
                                className="w-10 h-10 object-contain rounded"
                              />
                              <div className="absolute inset-0 bg-indigo-600/10 opacity-0 group-hover/qr:opacity-100 rounded flex items-center justify-center transition-opacity">
                                <Printer className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-300 drop-shadow" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400 mx-auto">
                              <QrCode className="w-4 h-4" />
                            </div>
                          )}
                        </td>

                        {/* Asset ID & Tag */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-bold text-[var(--text-main)] text-sm">
                            {asset.asset_id || `#AST-${asset.id}`}
                          </div>
                          {asset.asset_tag_number && asset.asset_tag_number !== "-" && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
                              Tag: {asset.asset_tag_number}
                            </span>
                          )}
                        </td>

                        {/* Device / Model */}
                        <td className="px-4 py-3 max-w-[220px]">
                          <div className="font-semibold text-[var(--text-main)] truncate" title={asset.asset_name || asset.equipment_name}>
                            {asset.brand && asset.brand !== "-" ? `${asset.brand} ` : ""}
                            {asset.model && asset.model !== "-" ? asset.model : asset.equipment_name}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium text-[10px]">
                              {asset.equipment_category || asset.category}
                            </span>
                            {asset.equipment_name && (
                              <span className="truncate">{asset.equipment_name}</span>
                            )}
                          </div>
                        </td>

                        {/* Serial Number */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {asset.serial_id && asset.serial_id !== "-" ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-main)] bg-[var(--bg-soft)] px-2 py-1 rounded border border-[var(--border-main)]">
                              <span className="truncate max-w-[140px]" title={asset.serial_id}>
                                {asset.serial_id}
                              </span>
                              <button
                                onClick={() => handleCopySerial(asset.serial_id)}
                                className="text-[var(--text-muted)] hover:text-indigo-600 transition-colors"
                                title="Copy Serial"
                              >
                                {copiedSerial === asset.serial_id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] italic text-[11px]">-</span>
                          )}
                        </td>

                        {/* Specs */}
                        <td className="px-4 py-3 max-w-[240px]">
                          {asset.processor && asset.processor !== "-" ? (
                            <div className="space-y-0.5">
                              <div className="font-medium text-[var(--text-main)] truncate" title={asset.processor}>
                                {asset.processor}
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-2">
                                {asset.ram && asset.ram !== "-" && <span>RAM: {asset.ram}</span>}
                                {asset.storage && asset.storage !== "-" && <span>HDD: {asset.storage}</span>}
                                {asset.operating_system && asset.operating_system !== "-" && (
                                  <span className="truncate">{asset.operating_system}</span>
                                )}
                              </div>
                              {asset.ip_address && asset.ip_address !== "-" && (
                                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                                  IP: {asset.ip_address}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] text-[11px]">-</span>
                          )}
                        </td>

                        {/* Division */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {asset.division || "Unassigned"}
                          </span>
                        </td>

                        {/* Assigned Officer */}
                        <td className="px-4 py-3">
                          {asset.assigned_officer && asset.assigned_officer !== "-" ? (
                            <div>
                              <div className="font-semibold text-[var(--text-main)]">
                                {asset.assigned_officer}
                              </div>
                              {asset.designation && asset.designation !== "-" && (
                                <div className="text-[10px] text-[var(--text-muted)]">
                                  {asset.designation}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-muted)] italic text-xs">Unassigned</span>
                          )}
                        </td>

                        {/* Condition & Status */}
                        <td className="px-4 py-3 whitespace-nowrap space-y-1">
                          <div>{renderStatus(asset.operational_status || asset.status)}</div>
                          <div>{renderCondition(asset.equipment_condition)}</div>
                          {asset.remarks && asset.remarks !== "-" && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 max-w-[150px] truncate" title={asset.remarks}>
                              ⚠️ {asset.remarks}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openQrModal(asset)}
                              className="text-[var(--text-soft)] hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                              title="Print QR Sticker"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEdit(asset)}
                              className="text-[var(--text-soft)] hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                              title="Edit Asset"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(asset.id)}
                              className="text-[var(--text-soft)] hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                              title="Delete Asset"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* QR Code Sticker Modal */}
      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Asset QR Code Sticker"
      >
        {selectedAssetForQr && (
          <div className="space-y-6">
            {/* Printable Sticker Box */}
            <div
              ref={printAreaRef}
              id="printable-sticker"
              className="bg-white text-slate-900 border-2 border-slate-900 rounded-2xl p-6 shadow-md max-w-sm mx-auto flex flex-col items-center text-center relative"
            >
              {/* Header */}
              <div className="border-b border-slate-300 pb-3 w-full mb-3">
                <p className="text-[10px] font-black tracking-widest text-indigo-900 uppercase">
                  Democratic Socialist Republic of Sri Lanka
                </p>
                <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                  Ministry of Digital Economy
                </h4>
                <p className="text-[11px] font-bold text-indigo-700 uppercase">
                  Official IT Asset Inventory Tag
                </p>
              </div>

              {/* QR Image */}
              <div className="p-2 border border-slate-200 rounded-xl bg-white shadow-xs my-1">
                {selectedAssetForQr.qr_code_path ? (
                  <img
                    src={`${BASE_URL}/${selectedAssetForQr.qr_code_path.replace(/\\/g, "/")}`}
                    alt="QR Code"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-400">
                    No QR Generated
                  </div>
                )}
              </div>

              {/* Asset Identifiers */}
              <div className="w-full mt-3 space-y-1.5 text-left border-t border-slate-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Asset ID:</span>
                  <span className="text-sm font-black text-indigo-950 font-mono">
                    {selectedAssetForQr.asset_id}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Serial No:</span>
                  <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                    {selectedAssetForQr.serial_id || "-"}
                  </span>
                </div>

                {selectedAssetForQr.asset_tag_number && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">Asset Tag:</span>
                    <span className="text-xs font-semibold text-slate-800">
                      {selectedAssetForQr.asset_tag_number}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Division:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedAssetForQr.division || "MoDE"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Assigned To:</span>
                  <span className="text-xs font-medium text-slate-800 truncate max-w-[160px]">
                    {selectedAssetForQr.assigned_officer || "Unassigned"}
                  </span>
                </div>

                {selectedAssetForQr.remarks && selectedAssetForQr.remarks !== "-" && (
                  <div className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded mt-2 border border-amber-200">
                    <strong>Note:</strong> {selectedAssetForQr.remarks}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-2 border-t border-dashed border-slate-300 w-full text-[9px] text-slate-400 font-mono">
                Scan with any QR scanner to verify authentication
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrintSticker}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-md text-sm"
              >
                <Printer className="w-4 h-4" /> Print QR Label Sticker
              </button>

              {selectedAssetForQr.qr_code_path && (
                <a
                  href={`${BASE_URL}/${selectedAssetForQr.qr_code_path.replace(/\\/g, "/")}`}
                  download={`QR_${selectedAssetForQr.asset_id.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-soft)] border border-[var(--border-main)] hover:bg-[var(--bg-panel)] font-bold rounded-xl text-xs transition-colors text-[var(--text-main)]"
                >
                  <Download className="w-4 h-4" /> Download PNG
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Asset Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editAsset ? "Edit Asset Register" : "Add New Asset to Ministry Register"}
        wide={true}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Identifiers */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Asset ID *
              </label>
              <input
                type="text"
                value={form.asset_id}
                onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                placeholder="e.g. MoDE/FIN/001"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Serial Number *
              </label>
              <input
                type="text"
                value={form.serial_id}
                onChange={(e) => setForm({ ...form, serial_id: e.target.value })}
                placeholder="e.g. 1LWFPG3"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Asset Tag Number
              </label>
              <input
                type="text"
                value={form.asset_tag_number}
                onChange={(e) => setForm({ ...form, asset_tag_number: e.target.value })}
                placeholder="e.g. FIN/001"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Device Info */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Equipment Category
              </label>
              <select
                value={form.equipment_category}
                onChange={(e) => setForm({ ...form, equipment_category: e.target.value })}
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              >
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Equipment Name
              </label>
              <input
                type="text"
                value={form.equipment_name}
                onChange={(e) => setForm({ ...form, equipment_name: e.target.value })}
                placeholder="e.g. Laptop computer"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g. Dell / HP / Canon"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Model
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. Dell latitude 3520"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Specifications */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Processor
              </label>
              <input
                type="text"
                value={form.processor}
                onChange={(e) => setForm({ ...form, processor: e.target.value })}
                placeholder="e.g. Intel core i5"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                RAM & Storage
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.ram}
                  onChange={(e) => setForm({ ...form, ram: e.target.value })}
                  placeholder="8gb"
                  className="bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  value={form.storage}
                  onChange={(e) => setForm({ ...form, storage: e.target.value })}
                  placeholder="256gb"
                  className="bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-2.5 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Operating System
              </label>
              <input
                type="text"
                value={form.operating_system}
                onChange={(e) => setForm({ ...form, operating_system: e.target.value })}
                placeholder="e.g. Windows 11 pro"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                IP Address (if applicable)
              </label>
              <input
                type="text"
                value={form.ip_address}
                onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                placeholder="e.g. 10.81.14.29"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Division & Custody */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Division / Unit
              </label>
              <select
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              >
                {DIVISIONS.filter((d) => d !== "All").map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Assigned Officer
              </label>
              <input
                type="text"
                value={form.assigned_officer}
                onChange={(e) => setForm({ ...form, assigned_officer: e.target.value })}
                placeholder="e.g. A R C Silva"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Designation
              </label>
              <input
                type="text"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="e.g. DO / MSO / Director"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Status & Condition */}
            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Equipment Condition
              </label>
              <select
                value={form.equipment_condition}
                onChange={(e) => setForm({ ...form, equipment_condition: e.target.value })}
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              >
                <option value="Good">Good</option>
                <option value="Very good">Very good</option>
                <option value="Bad">Bad</option>
                <option value="Unknown">Unknown</option>
                <option value="Not use">Not use</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Operational Status
              </label>
              <select
                value={form.operational_status}
                onChange={(e) => setForm({ ...form, operational_status: e.target.value })}
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              >
                <option value="In use">In use</option>
                <option value="Repair">Repair</option>
                <option value="Broken">Broken</option>
                <option value="Unpack">Unpack</option>
                <option value="No use">No use</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] mb-1 uppercase tracking-wider">
                Remarks
              </label>
              <input
                type="text"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="e.g. Laptop charger is faulty"
                className="w-full bg-[var(--bg-soft)] border border-[var(--border-main)] rounded-lg px-3 py-2 text-xs text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-xs font-semibold">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50 text-sm"
          >
            {saving ? "Saving & Generating QR Code..." : editAsset ? "Save Changes" : "Register Asset & Generate QR"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
export default AssetsPage;
