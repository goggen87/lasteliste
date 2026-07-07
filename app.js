const STORAGE_KEY = "lasteliste:v1";
const MAX_VISIBLE_MATERIALS = 6;

const baseMaterials = [
  { name: "Sprengstein", color: "#596166" },
  { name: "Jord", color: "#5c6f3a" },
  { name: "Leire", color: "#8a704d" },
  { name: "Stein", color: "#6f7880" },
  { name: "Asfalt", color: "#33383b" },
  { name: "Forurenset", color: "#8b6c3f" },
  { name: "Sand", color: "#b3833d" },
  { name: "Annet", color: "#27654f" },
];

const axleDefaults = {
  "3": 13,
  "4": 16,
};

const state = loadState();
let deferredInstallPrompt = null;

const crewForm = document.querySelector("#crewForm");
const todayLabel = document.querySelector("#todayLabel");
const operatorInput = document.querySelector("#operatorInput");
const machineInput = document.querySelector("#machineInput");
const truckForm = document.querySelector("#truckForm");
const showTruckForm = document.querySelector("#showTruckForm");
const addTruckButton = document.querySelector("#addTruckButton");
const previousTrucksButton = document.querySelector("#previousTrucksButton");
const plateInput = document.querySelector("#plateInput");
const nameInput = document.querySelector("#nameInput");
const axleInput = document.querySelector("#axleInput");
const capacityInput = document.querySelector("#capacityInput");
const formMessage = document.querySelector("#formMessage");
const truckList = document.querySelector("#truckList");
const previousTrucksPanel = document.querySelector("#previousTrucksPanel");
const materialGrid = document.querySelector("#materialGrid");
const organizeButton = document.querySelector("#organizeButton");
const destinationInput = document.querySelector("#destinationInput");
const customEntry = document.querySelector("#customEntry");
const customMaterialInput = document.querySelector("#customMaterialInput");
const cancelCustomMaterial = document.querySelector("#cancelCustomMaterial");
const overflowMaterials = document.querySelector("#overflowMaterials");
const logList = document.querySelector("#logList");
const materialTotals = document.querySelector("#materialTotals");
const selectedTruckLabel = document.querySelector("#selectedTruckLabel");
const totalLoads = document.querySelector("#totalLoads");
const totalTonnes = document.querySelector("#totalTonnes");
const activeTrucks = document.querySelector("#activeTrucks");
const exportButton = document.querySelector("#exportButton");
const clearButton = document.querySelector("#clearButton");
const installButton = document.querySelector("#installButton");
const emptyLogTemplate = document.querySelector("#emptyLogTemplate");
const deleteMaterialDialog = document.querySelector("#deleteMaterialDialog");
const deleteMaterialText = document.querySelector("#deleteMaterialText");
const confirmDeleteMaterial = document.querySelector("#confirmDeleteMaterial");
const cancelDeleteMaterial = document.querySelector("#cancelDeleteMaterial");
const deletePreviousTruckDialog = document.querySelector("#deletePreviousTruckDialog");
const deletePreviousTruckText = document.querySelector("#deletePreviousTruckText");
const confirmDeletePreviousTruck = document.querySelector("#confirmDeletePreviousTruck");
const cancelDeletePreviousTruck = document.querySelector("#cancelDeletePreviousTruck");
const exportDialog = document.querySelector("#exportDialog");
const sendPdfButton = document.querySelector("#sendPdfButton");
const sendCsvButton = document.querySelector("#sendCsvButton");
const savePdfButton = document.querySelector("#savePdfButton");
const saveCsvButton = document.querySelector("#saveCsvButton");
const cancelExportButton = document.querySelector("#cancelExportButton");
const finishDayDialog = document.querySelector("#finishDayDialog");
const confirmFinishDay = document.querySelector("#confirmFinishDay");
const cancelFinishDay = document.querySelector("#cancelFinishDay");

let pendingDeleteMaterial = null;
let draggedMaterialName = null;
let pointerDrag = null;
let lastTruckTap = { id: null, at: 0 };
let suppressMaterialClick = null;
let confirmedMaterial = null;
let isOrganizing = false;
let editingTruckId = null;
let pendingDeletePreviousTruckKey = null;

operatorInput.value = state.operatorName;
machineInput.value = state.machineName;
destinationInput.value = state.destinationText;
todayLabel.textContent = formatTodayLabel();
seedPreviousTrucks();
if (state.selectedTruckId) {
  truckForm.classList.add("is-collapsed");
}
render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

showTruckForm.addEventListener("click", () => {
  clearTruckForm();
  truckForm.classList.remove("is-collapsed");
  previousTrucksPanel.classList.add("is-hidden");
  renderTrucks();
  plateInput.focus();
});

axleInput.addEventListener("change", () => {
  const defaultCapacity = axleDefaults[axleInput.value];
  if (defaultCapacity) {
    capacityInput.value = defaultCapacity;
  }
});

addTruckButton.addEventListener("click", (event) => {
  event.preventDefault();

  if (truckForm.requestSubmit) {
    truckForm.requestSubmit();
    return;
  }

  addTruckFromForm();
});

truckForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTruckFromForm();
});

previousTrucksButton.addEventListener("click", () => {
  togglePreviousTrucks();
});

selectedTruckLabel.addEventListener("click", () => {
  if (state.selectedTruckId) return;
  openPreviousTrucks();
});

selectedTruckLabel.addEventListener("keydown", (event) => {
  if (state.selectedTruckId || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  openPreviousTrucks();
});

crewForm.addEventListener("input", () => {
  state.operatorName = operatorInput.value.trim();
  state.machineName = machineInput.value.trim();
  persist();
});

destinationInput.addEventListener("input", () => {
  state.destinationText = destinationInput.value.trim();
  persist();
});

customEntry.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = normalizeMaterial(customMaterialInput.value);
  if (!name) {
    customMaterialInput.focus();
    return;
  }

  addLoad(name, { promote: true });
  customMaterialInput.value = "";
  customEntry.classList.add("is-hidden");
  overflowMaterials.classList.add("is-hidden");
});

cancelCustomMaterial.addEventListener("click", () => {
  customMaterialInput.value = "";
  customEntry.classList.add("is-hidden");
  overflowMaterials.classList.add("is-hidden");
});

confirmDeleteMaterial.addEventListener("click", () => {
  if (!pendingDeleteMaterial) return;
  performDeleteMaterial(pendingDeleteMaterial);
  closeDeleteDialog();
});

cancelDeleteMaterial.addEventListener("click", closeDeleteDialog);

confirmDeletePreviousTruck.addEventListener("click", () => {
  if (!pendingDeletePreviousTruckKey) return;
  deletePreviousTruck(pendingDeletePreviousTruckKey);
  closeDeletePreviousTruckDialog();
});

cancelDeletePreviousTruck.addEventListener("click", closeDeletePreviousTruckDialog);

organizeButton.addEventListener("click", () => {
  isOrganizing = !isOrganizing;
  closeMaterialDrawer();
  renderMaterials();
});

document.addEventListener("pointermove", (event) => {
  if (!pointerDrag) return;

  const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
  if (!pointerDrag.dragging && distance > 12) {
    pointerDrag.dragging = true;
    pointerDrag.tile.classList.add("is-dragging");
  }

  if (!pointerDrag.dragging) return;
  event.preventDefault();

  document.querySelectorAll(".material-tile.is-drag-over").forEach((tile) => tile.classList.remove("is-drag-over"));
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".material-tile-main");
  if (target && target.dataset.material !== pointerDrag.name) {
    target.classList.add("is-drag-over");
  }
});

document.addEventListener("pointerup", (event) => {
  if (!pointerDrag) return;

  const wasDragging = pointerDrag.dragging;
  const fromName = pointerDrag.name;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".material-tile-main");
  pointerDrag.tile.classList.remove("is-dragging");
  document.querySelectorAll(".material-tile.is-drag-over").forEach((tile) => tile.classList.remove("is-drag-over"));
  pointerDrag = null;

  if (wasDragging) {
    suppressMaterialClick = fromName;
    if (target?.dataset.material && target.dataset.material !== fromName) {
      lockMaterialOrder(fromName, target.dataset.material);
    }
  }
});

document.addEventListener("pointercancel", () => {
  if (!pointerDrag) return;
  pointerDrag.tile.classList.remove("is-dragging");
  document.querySelectorAll(".material-tile.is-drag-over").forEach((tile) => tile.classList.remove("is-drag-over"));
  pointerDrag = null;
});

function addTruckFromForm() {
  const plate = normalizePlate(plateInput.value);
  const name = nameInput.value.trim();
  const axles = axleInput.value;
  const capacity = Number.parseFloat(capacityInput.value) || 0;

  formMessage.textContent = "";

  if (!plate && !name) {
    formMessage.textContent = "Skriv inn navn/firma eller skiltnr.";
    nameInput.focus();
    return;
  }

  const existing = editingTruckId
    ? state.trucks.find((truck) => truck.id === editingTruckId)
    : state.trucks.find((truck) => {
        if (plate && truck.plate === plate) return true;
        return !plate && !truck.plate && truck.name?.trim().toLowerCase() === name.toLowerCase();
      });
  if (existing) {
    existing.plate = plate;
    existing.name = name;
    existing.axles = axles;
    existing.capacity = capacity;
    existing.lastUsedAt = new Date().toISOString();
    state.selectedTruckId = existing.id;
    rememberTruck(existing);
  } else {
    const truck = {
      id: createId(),
      plate,
      name,
      axles,
      capacity,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    state.trucks.push(truck);
    state.selectedTruckId = truck.id;
    rememberTruck(truck);
  }

  clearTruckForm();
  truckForm.classList.add("is-collapsed");
  previousTrucksPanel.classList.add("is-hidden");
  persistAndRender();
}

exportButton.addEventListener("click", () => {
  if (!state.logs.length) {
    window.alert("Ingen lass å eksportere ennå.");
    return;
  }
  exportDialog.classList.remove("is-hidden");
});

sendPdfButton.addEventListener("click", async () => {
  exportDialog.classList.add("is-hidden");
  await exportPdf();
  askFinishDay();
});

sendCsvButton.addEventListener("click", async () => {
  exportDialog.classList.add("is-hidden");
  await exportCsv();
  askFinishDay();
});

savePdfButton.addEventListener("click", () => {
  exportDialog.classList.add("is-hidden");
  savePdf();
  askFinishDay();
});

saveCsvButton.addEventListener("click", () => {
  exportDialog.classList.add("is-hidden");
  saveCsv();
  askFinishDay();
});

cancelExportButton.addEventListener("click", () => {
  exportDialog.classList.add("is-hidden");
});

confirmFinishDay.addEventListener("click", () => {
  finishDayDialog.classList.add("is-hidden");
  finishDay();
});

cancelFinishDay.addEventListener("click", () => {
  finishDayDialog.classList.add("is-hidden");
});

clearButton.addEventListener("click", () => {
  if (!state.logs.length && !state.trucks.length) return;
  const confirmed = window.confirm("Vil du rydde dagens biler og logg?");
  if (!confirmed) return;
  finishDay();
});

function render() {
  renderMaterials();
  renderTrucks();
  renderPreviousTrucks();
  renderLogs();
  renderMaterialTotals();
  renderSummary();
}

function renderMaterials() {
  materialGrid.classList.toggle("is-organizing", isOrganizing);
  organizeButton.textContent = isOrganizing ? "Ferdig" : "Organiser";
  organizeButton.classList.toggle("is-active", isOrganizing);

  const fixedMaterials = baseMaterials.filter((material) => material.name !== "Annet" && !isDeletedMaterial(material.name));
  const fixedNames = new Set(fixedMaterials.map((material) => material.name.toUpperCase()));
  const customTopMaterials = state.customMaterials
    .filter((name) => !fixedNames.has(name.toUpperCase()) && !isDeletedMaterial(name))
    .map((name) => createMaterial(name, "#2f6f73", true));
  const sortedMaterials = sortMaterials([...fixedMaterials, ...customTopMaterials]);
  const visibleMaterials = sortedMaterials.slice(0, MAX_VISIBLE_MATERIALS);
  const overflow = sortedMaterials.slice(MAX_VISIBLE_MATERIALS);
  const otherMaterial = baseMaterials.find((material) => material.name === "Annet");

  materialGrid.replaceChildren(
    ...visibleMaterials.map((material) => createMaterialTile(material, "main")),
    createOtherTile(otherMaterial, overflow.length),
  );

  renderOverflowMaterials(overflow);
}

function renderOverflowMaterials(materials) {
  if (!materials.length) {
    const empty = document.createElement("p");
    empty.className = "custom-empty";
    empty.textContent = "Ingen andre masser akkurat nå.";
    overflowMaterials.replaceChildren(empty);
    return;
  }

  overflowMaterials.replaceChildren(...materials.map((material) => createMaterialTile(material, "overflow")));
}

function renderTrucks() {
  if (!state.trucks.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Legg inn første bil for dagen.";
    truckList.replaceChildren(empty);
    selectedTruckLabel.textContent = "Velg bil først";
    selectedTruckLabel.classList.add("is-actionable");
    selectedTruckLabel.setAttribute("role", "button");
    selectedTruckLabel.setAttribute("tabindex", "0");
    return;
  }

  const selected = state.trucks.find((truck) => truck.id === state.selectedTruckId);
  selectedTruckLabel.textContent = selected ? getTruckLogLabel(selected) : "Velg bil først";
  selectedTruckLabel.classList.toggle("is-actionable", !selected);
  if (selected) {
    selectedTruckLabel.removeAttribute("role");
    selectedTruckLabel.removeAttribute("tabindex");
  } else {
    selectedTruckLabel.setAttribute("role", "button");
    selectedTruckLabel.setAttribute("tabindex", "0");
  }
  selectedTruckLabel.ondblclick = () => {
    if (!state.selectedTruckId) return;
    editTruck(state.selectedTruckId);
  };

  const shouldHideTruckList =
    Boolean(state.selectedTruckId) &&
    state.trucks.length <= 1 &&
    truckForm.classList.contains("is-collapsed") &&
    previousTrucksPanel.classList.contains("is-hidden");

  if (shouldHideTruckList) {
    truckList.classList.add("is-hidden");
    truckList.replaceChildren();
    return;
  }

  truckList.classList.remove("is-hidden");
  truckList.classList.toggle("is-pair", state.trucks.length === 2);
  truckList.classList.toggle("is-compact", state.trucks.length >= 3 && state.trucks.length <= 4);
  truckList.classList.toggle("is-dense", state.trucks.length >= 5);

  truckList.replaceChildren(
    ...state.trucks.map((truck) => {
      const loads = state.logs.filter((log) => log.truckId === truck.id).length;
      const card = document.createElement("div");
      card.className = `truck-card${truck.id === state.selectedTruckId ? " is-selected" : ""}`;
      card.title = `${getTruckLabel(truck)} - ${loads} lass. Dobbelttrykk for å redigere.`;

      const selectButton = document.createElement("button");
      selectButton.className = "truck-select";
      selectButton.type = "button";
      selectButton.addEventListener("click", () => {
        const now = Date.now();
        const isDoubleTap = lastTruckTap.id === truck.id && now - lastTruckTap.at < 450;
        lastTruckTap = { id: truck.id, at: now };
        state.selectedTruckId = truck.id;
        if (isDoubleTap) {
          editTruck(truck.id);
        }
        persistAndRender();
      });

      const text = document.createElement("span");
      const plate = document.createElement("span");
      plate.className = "truck-plate";
      plate.textContent = getTruckLabel(truck);
      const meta = document.createElement("span");
      meta.className = "truck-meta";
      meta.textContent = [truck.plate, formatAxles(truck.axles), `${formatTonnes(truck.capacity)} tonn/lass`]
        .filter(Boolean)
        .join(" · ");
      text.append(plate, meta);

      const count = document.createElement("span");
      count.className = "truck-count";
      count.textContent = `${loads} lass`;
      selectButton.append(text, count);

      card.append(selectButton);
      return card;
    }),
  );
}

function renderPreviousTrucks() {
  if (!previousTrucksPanel || previousTrucksPanel.classList.contains("is-hidden")) return;

  const previous = [...state.previousTrucks].sort((first, second) => {
    return new Date(second.lastUsedAt ?? 0) - new Date(first.lastUsedAt ?? 0);
  });

  if (!previous.length) {
    const empty = document.createElement("p");
    empty.className = "custom-empty";
    empty.textContent = "Ingen tidligere biler ennå.";
    previousTrucksPanel.replaceChildren(empty);
    return;
  }

  previousTrucksPanel.replaceChildren(
    ...previous.map((truck) => {
      const active = state.trucks.some((item) => getTruckKey(item) === getTruckKey(truck));
      const item = document.createElement("div");
      item.className = `previous-truck-item${active ? " is-added" : ""}`;

      const button = document.createElement("button");
      button.className = "previous-truck";
      button.type = "button";
      button.textContent = `${getTruckLabel(truck)}${truck.plate ? ` · ${truck.plate}` : ""}${active ? " ✓" : ""}`;
      button.addEventListener("click", () => addPreviousTruck(truck));

      const deleteButton = document.createElement("button");
      deleteButton.className = "delete-previous-truck";
      deleteButton.type = "button";
      deleteButton.textContent = "×";
      deleteButton.setAttribute("aria-label", `Slett ${getTruckLabel(truck)} fra tidligere-listen`);
      deleteButton.addEventListener("click", () => askDeletePreviousTruck(truck));

      item.append(button, deleteButton);
      return item;
    }),
  );
}

function togglePreviousTrucks() {
  truckForm.classList.add("is-collapsed");
  previousTrucksPanel.classList.toggle("is-hidden");
  renderTrucks();
  renderPreviousTrucks();
}

function openPreviousTrucks() {
  truckForm.classList.add("is-collapsed");
  previousTrucksPanel.classList.remove("is-hidden");
  renderTrucks();
  renderPreviousTrucks();
}

function renderLogs() {
  if (!state.logs.length) {
    logList.replaceChildren(emptyLogTemplate.content.firstElementChild.cloneNode(true));
    return;
  }

  const header = document.createElement("div");
  header.className = "log-row log-header";
  ["Tid", "Bil", "Masse", "Til", "Tonn", ""].forEach((label) => {
    const cell = document.createElement("span");
    cell.textContent = label;
    header.append(cell);
  });

  const rows = [...state.logs].reverse().map((log) => {
    const truck = state.trucks.find((item) => item.id === log.truckId);
    const item = document.createElement("div");
    item.className = "log-row";

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = formatTime(log.createdAt);

    const truckCell = document.createElement("span");
    truckCell.className = "log-truck";
    truckCell.textContent = truck ? getTruckLogLabel(truck) : getFallbackLogLabel(log);

    const material = document.createElement("span");
    material.className = "log-material";
    material.textContent = log.material;

    const destination = document.createElement("span");
    destination.className = "log-destination";
    destination.textContent = log.destination || "-";

    const tonnes = document.createElement("span");
    tonnes.className = "log-tonnes";
    tonnes.textContent = formatTonnes(log.capacity);

    const remove = document.createElement("button");
    remove.className = "delete-log";
    remove.type = "button";
    remove.setAttribute("aria-label", "Slett lass");
    remove.textContent = "x";
    remove.addEventListener("click", () => {
      state.logs = state.logs.filter((itemLog) => itemLog.id !== log.id);
      persistAndRender();
    });

    item.append(time, truckCell, material, destination, tonnes, remove);
    return item;
  });

  logList.replaceChildren(header, ...rows);
}

function renderMaterialTotals() {
  const counts = getMaterialCounts();

  if (!counts.length) {
    materialTotals.replaceChildren();
    return;
  }

  const title = document.createElement("h3");
  title.textContent = "Totalt per masse";

  const list = document.createElement("div");
  list.className = "totals-grid";
  list.replaceChildren(
    ...counts.map(([material, count]) => {
      const item = document.createElement("span");
      item.textContent = `${material}: ${count}`;
      return item;
    }),
  );

  materialTotals.replaceChildren(title, list);
}

function renderSummary() {
  const tonneSum = state.logs.reduce((sum, log) => sum + (Number(log.capacity) || 0), 0);
  totalLoads.textContent = state.logs.length;
  totalTonnes.textContent = formatTonnes(tonneSum);
  activeTrucks.textContent = state.trucks.length;
}

function addLoad(material, options = {}) {
  if (isOrganizing) return;

  const truck = state.trucks.find((item) => item.id === state.selectedTruckId);
  if (!truck) return;

  state.logs.push({
    id: createId(),
    truckId: truck.id,
    plate: truck.plate,
    truckName: truck.name,
    material,
    destination: destinationInput.value.trim(),
    capacity: truck.capacity,
    createdAt: new Date().toISOString(),
  });

  truck.lastUsedAt = new Date().toISOString();
  rememberTruck(truck);
  rememberCustomMaterial(material);
  if (options.promote) {
    promoteMaterial(material);
  } else if (!state.materialOrderLocked) {
    state.lastSelectedMaterial = material;
  }
  closeMaterialDrawer();
  confirmedMaterial = material;
  persistAndRender();
  window.setTimeout(() => {
    document
      .querySelectorAll(`[data-material="${cssEscape(material)}"] .material-button`)
      .forEach((button) => button.classList.remove("is-confirmed"));
    if (confirmedMaterial === material) confirmedMaterial = null;
  }, 2200);
}

function handleMaterialClick(material) {
  if (material !== "Annet") {
    addLoad(material);
    return;
  }

  customEntry.classList.remove("is-hidden");
  overflowMaterials.classList.remove("is-hidden");
  customMaterialInput.focus();
}

async function exportCsv() {
  const blob = createCsvBlob();
  const file = new File([blob], getExportFilename("csv"), { type: "text/csv" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Lasteliste" }).catch(() => downloadBlob(blob, file.name));
    return;
  }

  downloadBlob(blob, file.name);
}

function saveCsv() {
  downloadBlob(createCsvBlob(), getExportFilename("csv"));
}

function createCsvBlob() {
  if (!state.logs.length) {
    window.alert("Ingen lass å eksportere ennå.");
    return new Blob([""], { type: "text/csv;charset=utf-8" });
  }

  const header = ["Dato", "Tid", "Operatør", "Maskin", "Bil", "Skiltnr", "Biltype", "Masse", "Kjører til", "Tonn per lass"];
  const rows = state.logs.map((log) => {
    const truck = state.trucks.find((item) => item.id === log.truckId);
    const date = new Date(log.createdAt);
    return [
      date.toLocaleDateString("no-NO"),
      date.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }),
      state.operatorName,
      state.machineName,
      truck ? getTruckLabel(truck) : getFallbackLogLabel(log),
      log.plate || "",
      formatAxles(truck?.axles ?? "custom"),
      log.material,
      log.destination || "",
      String(log.capacity).replace(".", ","),
    ];
  });

  const totals = ["", "", "", "", "SUM", "", "", `${state.logs.length} lass`, "", String(sumTonnes()).replace(".", ",")];
  const csv = [header, ...rows, totals].map((row) => row.map(escapeCsv).join(";")).join("\n");
  return new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
}

async function exportPdf() {
  const blob = createPdfBlob(getReportLines());
  const file = new File([blob], getExportFilename("pdf"), { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "Lasteliste" }).catch(() => downloadBlob(blob, file.name));
    return;
  }

  downloadBlob(blob, file.name);
}

function savePdf() {
  const blob = createPdfBlob(getReportLines());
  downloadBlob(blob, getExportFilename("pdf"));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      trucks: Array.isArray(saved?.trucks) ? saved.trucks : [],
      logs: Array.isArray(saved?.logs) ? saved.logs : [],
      customMaterials: Array.isArray(saved?.customMaterials) ? saved.customMaterials : [],
      previousTrucks: Array.isArray(saved?.previousTrucks) ? saved.previousTrucks : [],
      deletedMaterials: Array.isArray(saved?.deletedMaterials) ? saved.deletedMaterials : [],
      materialOrder: Array.isArray(saved?.materialOrder) ? saved.materialOrder : [],
      materialOrderLocked: Boolean(saved?.materialOrderLocked),
      lastSelectedMaterial: saved?.lastSelectedMaterial ?? "",
      operatorName: saved?.operatorName ?? "",
      machineName: saved?.machineName ?? "",
      destinationText: saved?.destinationText ?? "",
      selectedTruckId: saved?.selectedTruckId ?? null,
    };
  } catch {
    return {
      trucks: [],
      logs: [],
      customMaterials: [],
      previousTrucks: [],
      deletedMaterials: [],
      materialOrder: [],
      materialOrderLocked: false,
      lastSelectedMaterial: "",
      operatorName: "",
      machineName: "",
      destinationText: "",
      selectedTruckId: null,
    };
  }
}

function persistAndRender() {
  persist();
  render();
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizePlate(value) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

function normalizeMaterial(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function rememberCustomMaterial(material) {
  const normalized = normalizeMaterial(material);
  const isBaseMaterial = baseMaterials.some((item) => item.name.toUpperCase() === normalized);
  if (!normalized) return;
  if (isBaseMaterial) {
    state.deletedMaterials = state.deletedMaterials.filter((name) => name !== normalized);
    return;
  }
  if (state.customMaterials.includes(normalized)) return;
  state.customMaterials.push(normalized);
}

function createMaterial(name, color, isCustom = false) {
  return { name, color, isCustom };
}

function createMaterialTile(material, variant) {
  const tile = document.createElement("div");
  tile.className = `material-tile material-tile-${variant}${material.isCustom ? " is-custom" : ""}`;
  tile.dataset.material = material.name;

  const button = document.createElement("button");
  button.className = [
    "material-button",
    getMassImageClass(material.name),
    material.isCustom ? "is-custom" : "",
    confirmedMaterial === material.name ? "is-confirmed" : "",
  ]
    .filter(Boolean)
    .join(" ");
  button.type = "button";
  button.textContent = getMaterialButtonLabel(material.name, material.isCustom);
  button.style.backgroundColor = material.color;
  button.disabled = !state.selectedTruckId;
  button.addEventListener("pointerdown", (event) => {
    if (!isOrganizing || variant !== "main" || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    pointerDrag = {
      dragging: false,
      name: material.name,
      startX: event.clientX,
      startY: event.clientY,
      tile,
    };
  });
  button.addEventListener("click", () => {
    if (isOrganizing) return;
    if (suppressMaterialClick === material.name) {
      suppressMaterialClick = null;
      return;
    }
    addLoad(material.name, { promote: variant === "overflow" });
  });

  const dragHint = document.createElement("span");
  dragHint.className = "drag-hint";
  dragHint.textContent = "flytt";

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-material";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Slett ${material.name}`);
  deleteButton.textContent = "×";
  deleteButton.addEventListener("click", () => deleteMaterial(material.name));

  tile.append(button, dragHint, deleteButton);
  return tile;
}

function createOtherTile(material, overflowCount) {
  const tile = document.createElement("div");
  tile.className = "material-tile material-tile-other";

  const button = document.createElement("button");
  button.className = "material-button";
  button.type = "button";
  button.textContent = overflowCount ? `Annet (${overflowCount})` : "Annet";
  button.style.background = material.color;
  button.disabled = !state.selectedTruckId;
  button.addEventListener("click", () => handleMaterialClick("Annet"));

  tile.append(button);
  return tile;
}

function getMassImageClass(material) {
  const classes = {
    ASFALT: "mass-asfalt",
    SPRENGSTEIN: "mass-sprengstein",
    FORURENSET: "mass-forurenset",
    JORD: "mass-jord",
    LEIRE: "mass-leire",
    SAND: "mass-sand",
  };
  return classes[normalizeMaterial(material)] ?? "";
}

function deleteMaterial(material) {
  pendingDeleteMaterial = material;
  deleteMaterialText.textContent = `Vil du slette "${material}" fra valglisten? Loggede lass blir stående.`;
  deleteMaterialDialog.classList.remove("is-hidden");
  confirmDeleteMaterial.focus();
}

function performDeleteMaterial(material) {
  const normalized = normalizeMaterial(material);
  state.customMaterials = state.customMaterials.filter((name) => normalizeMaterial(name) !== normalized);
  state.materialOrder = state.materialOrder.filter((name) => normalizeMaterial(name) !== normalized);
  if (normalizeMaterial(state.lastSelectedMaterial) === normalized) {
    state.lastSelectedMaterial = "";
  }
  if (baseMaterials.some((item) => item.name.toUpperCase() === normalized) && normalized !== "ANNET") {
    state.deletedMaterials.push(normalized);
    state.deletedMaterials = [...new Set(state.deletedMaterials)];
  }

  customEntry.classList.add("is-hidden");
  overflowMaterials.classList.add("is-hidden");
  persistAndRender();
}

function closeDeleteDialog() {
  pendingDeleteMaterial = null;
  deleteMaterialDialog.classList.add("is-hidden");
}

function askDeletePreviousTruck(truck) {
  pendingDeletePreviousTruckKey = getTruckKey(truck);
  deletePreviousTruckText.textContent = `Vil du slette "${getTruckLabel(truck)}" fra tidligere-listen? Dagens logg og aktive biler blir ikke endret.`;
  deletePreviousTruckDialog.classList.remove("is-hidden");
  confirmDeletePreviousTruck.focus();
}

function deletePreviousTruck(key) {
  state.previousTrucks = state.previousTrucks.filter((truck) => getTruckKey(truck) !== key);
  persistAndRender();
}

function closeDeletePreviousTruckDialog() {
  pendingDeletePreviousTruckKey = null;
  deletePreviousTruckDialog.classList.add("is-hidden");
}

function sortMaterials(materials) {
  if (state.materialOrderLocked && state.materialOrder.length) {
    const order = new Map(state.materialOrder.map((name, index) => [normalizeMaterial(name), index]));
    return materials.sort((first, second) => {
      const firstIndex = order.has(normalizeMaterial(first.name)) ? order.get(normalizeMaterial(first.name)) : Number.MAX_SAFE_INTEGER;
      const secondIndex = order.has(normalizeMaterial(second.name)) ? order.get(normalizeMaterial(second.name)) : Number.MAX_SAFE_INTEGER;
      return firstIndex - secondIndex || first.name.localeCompare(second.name, "no");
    });
  }

  return materials.sort((first, second) => {
    if (state.lastSelectedMaterial === first.name && state.lastSelectedMaterial !== second.name) return -1;
    if (state.lastSelectedMaterial === second.name && state.lastSelectedMaterial !== first.name) return 1;
    return getMaterialCount(second.name) - getMaterialCount(first.name) || first.name.localeCompare(second.name, "no");
  });
}

function getMaterialButtonLabel(name, isCustom) {
  return name;
}

function isDeletedMaterial(material) {
  return state.deletedMaterials.includes(normalizeMaterial(material));
}

function lockMaterialOrder(fromName, toName) {
  const currentOrder = [...materialGrid.querySelectorAll(".material-tile-main")]
    .map((tile) => tile.dataset.material)
    .filter(Boolean);
  const fromIndex = currentOrder.indexOf(fromName);
  const toIndex = currentOrder.indexOf(toName);
  if (fromIndex < 0 || toIndex < 0) return;

  currentOrder.splice(fromIndex, 1);
  currentOrder.splice(toIndex, 0, fromName);

  const fullOrder = sortMaterials(getAllAvailableMaterials())
    .map((material) => material.name)
    .filter((name) => !currentOrder.includes(name));
  state.materialOrder = [...currentOrder, ...fullOrder];
  state.materialOrderLocked = true;
  persistAndRender();
}

function promoteMaterial(material) {
  if (!state.materialOrderLocked) {
    state.lastSelectedMaterial = material;
    return;
  }

  const normalized = normalizeMaterial(material);
  const rest = sortMaterials(getAllAvailableMaterials())
    .map((item) => item.name)
    .filter((name) => normalizeMaterial(name) !== normalized);
  state.materialOrder = [material, ...rest];
}

function getAllAvailableMaterials() {
  const fixedMaterials = baseMaterials.filter((material) => material.name !== "Annet" && !isDeletedMaterial(material.name));
  const fixedNames = new Set(fixedMaterials.map((material) => material.name.toUpperCase()));
  const customMaterials = state.customMaterials
    .filter((name) => !fixedNames.has(name.toUpperCase()) && !isDeletedMaterial(name))
    .map((name) => createMaterial(name, "#2f6f73", true));
  return [...fixedMaterials, ...customMaterials];
}

function closeMaterialDrawer() {
  customEntry.classList.add("is-hidden");
  overflowMaterials.classList.add("is-hidden");
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(value);
  return String(value).replaceAll('"', '\\"');
}

function editTruck(truckId) {
  const truck = state.trucks.find((item) => item.id === truckId);
  if (!truck) return;

  editingTruckId = truck.id;
  plateInput.value = truck.plate ?? "";
  nameInput.value = truck.name ?? "";
  axleInput.value = truck.axles ?? "4";
  capacityInput.value = truck.capacity ?? axleDefaults["4"];
  addTruckButton.textContent = "Oppdater bil";
  formMessage.textContent = "";
  truckForm.classList.remove("is-collapsed");
  previousTrucksPanel.classList.add("is-hidden");
}

function clearTruckForm() {
  editingTruckId = null;
  plateInput.value = "";
  nameInput.value = "";
  axleInput.value = "4";
  capacityInput.value = axleDefaults["4"];
  addTruckButton.textContent = "Legg til bil";
  formMessage.textContent = "";
}

function addPreviousTruck(previousTruck) {
  const existing = state.trucks.find((truck) => {
    if (previousTruck.plate && truck.plate === previousTruck.plate) return true;
    return !previousTruck.plate && truck.name?.trim().toLowerCase() === previousTruck.name?.trim().toLowerCase();
  });

  if (existing) {
    state.selectedTruckId = existing.id;
  } else {
    const truck = {
      id: createId(),
      plate: previousTruck.plate ?? "",
      name: previousTruck.name ?? "",
      axles: previousTruck.axles ?? "4",
      capacity: previousTruck.capacity ?? axleDefaults["4"],
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    state.trucks.push(truck);
    state.selectedTruckId = truck.id;
    rememberTruck(truck);
  }

  truckForm.classList.add("is-collapsed");
  persistAndRender();
}

function rememberTruck(truck) {
  const key = getTruckKey(truck);
  if (!key) return;

  const saved = state.previousTrucks.find((item) => getTruckKey(item) === key);
  const data = {
    plate: truck.plate ?? "",
    name: truck.name ?? "",
    axles: truck.axles ?? "4",
    capacity: truck.capacity ?? axleDefaults["4"],
    lastUsedAt: truck.lastUsedAt ?? new Date().toISOString(),
  };

  if (saved) {
    Object.assign(saved, data);
  } else {
    state.previousTrucks.push(data);
  }
}

function seedPreviousTrucks() {
  state.trucks.forEach((truck) => {
    rememberTruck({ ...truck, lastUsedAt: truck.lastUsedAt ?? truck.createdAt ?? new Date().toISOString() });
  });
  persist();
}

function getTruckKey(truck) {
  return truck.plate ? `plate:${truck.plate}` : truck.name ? `name:${truck.name.trim().toLowerCase()}` : "";
}

function finishDay() {
  state.trucks.forEach((truck) => rememberTruck({ ...truck, lastUsedAt: truck.lastUsedAt ?? new Date().toISOString() }));
  state.trucks = [];
  state.logs = [];
  state.selectedTruckId = null;
  clearTruckForm();
  previousTrucksPanel.classList.add("is-hidden");
  persistAndRender();
}

function askFinishDay() {
  if (!state.logs.length && !state.trucks.length) return;
  finishDayDialog.classList.remove("is-hidden");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getExportFilename(extension) {
  return `lasteliste-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function getReportLines() {
  const date = new Date().toLocaleDateString("no-NO");
  const tableHeader = `${"Tid".padEnd(8)} ${"Bil".padEnd(22)} ${"Masse".padEnd(14)} ${"Til".padEnd(15)} ${"Tonn".padStart(6)}`;
  const lines = [
    "Lasteliste",
    `Dato: ${date}`,
    `Operatør: ${state.operatorName || "-"}`,
    `Maskin: ${state.machineName || "-"}`,
    "",
    tableHeader,
    "-".repeat(tableHeader.length),
  ];

  state.logs.forEach((log) => {
    const truck = state.trucks.find((item) => item.id === log.truckId);
    const tonnes = formatTonnes(log.capacity).padStart(6);
    lines.push(
      `${formatTime(log.createdAt).padEnd(8)} ${truncate(truck ? getTruckLogLabel(truck) : getFallbackLogLabel(log), 22).padEnd(22)} ${truncate(log.material, 14).padEnd(14)} ${truncate(log.destination || "-", 15).padEnd(15)} ${tonnes}`,
    );
  });

  lines.push("");
  lines.push(`Totalt lass: ${state.logs.length}`);
  lines.push(`Ca. tonn: ${formatTonnes(sumTonnes())}`);
  lines.push("");
  lines.push("Totalt per masse:");
  getMaterialCounts().forEach(([material, count]) => lines.push(`${material}: ${count}`));
  return lines;
}

function createPdfBlob(lines) {
  const safeLines = lines.map((line) => toPdfText(line));
  const content = [
    "BT",
    "/F1 10.5 Tf",
    "50 790 Td",
    "14 TL",
    ...safeLines.map((line, index) => `${index === 0 ? "" : "T* "}(${escapePdfText(line)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    `<< /Length ${latin1Length(content)} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(latin1Length(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = latin1Length(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([latin1Bytes(pdf)], { type: "application/pdf" });
}

function toPdfText(value) {
  return String(value)
    .replaceAll("–", "-")
    .replaceAll("·", "-")
    .replaceAll("…", "...")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, "?");
}

function escapePdfText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function latin1Length(value) {
  return value.length;
}

function latin1Bytes(value) {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function truncate(value, length) {
  const text = String(value ?? "");
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function formatTodayLabel() {
  const date = new Date();
  const weekday = new Intl.DateTimeFormat("no-NO", { weekday: "long" }).format(date);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${capitalize(weekday)} ${day}.${month}-${year}`;
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function getTruckLabel(truck) {
  return truck.name?.trim() || truck.plate;
}

function getTruckLogLabel(truck) {
  return [truck.name?.trim(), truck.plate].filter(Boolean).join(" · ");
}

function getFallbackLogLabel(log) {
  return [log.truckName, log.plate].filter(Boolean).join(" · ") || "Ukjent";
}

function getMaterialCount(material) {
  return state.logs.filter((log) => log.material === material).length;
}

function getMaterialCounts() {
  const counts = new Map();
  state.logs.forEach((log) => {
    counts.set(log.material, (counts.get(log.material) ?? 0) + 1);
  });

  return [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], "no"));
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatAxles(axles) {
  if (axles === "3") return "3 aks";
  if (axles === "4") return "4 aks";
  return "Egendefinert";
}

function formatTonnes(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(".", ",");
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
}

function sumTonnes() {
  return state.logs.reduce((sum, log) => sum + (Number(log.capacity) || 0), 0);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (!/[;"\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
