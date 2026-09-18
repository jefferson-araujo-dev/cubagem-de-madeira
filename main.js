import * as XLSX from "xlsx-js-style";
import { ICONS } from "./js/config.js";
import {
  showToast,
  openAuthModal,
  closeAuthModal,
  updateAuthUI,
} from "./js/ui.js";
import {
  initAuth,
  handleAuthSubmit,
  handlePasswordReset,
  handleLogout,
} from "./js/auth.js";
import {
  initStore,
  setStoreUser,
  setLocalMode,
  isLocalMode,
  getItems,
  setOnDataChanged,
  loadLocalData,
  setupRealtimeSync,
  stopRealtimeSync,
  addItem,
  updateItem,
  deleteItemFromStore,
  clearAllItems,
} from "./js/store.js";
import { initFirebaseApp } from "./js/firebase.js";
import {
  isValidWoodType,
  parseDimension,
  parseQuantity,
  formatDecimalBR,
  formatDimensionInput,
  formatGrossVolumeBR,
  formatDateBR,
  createWoodItem,
  applyWoodItemEdit,
  sumOfficialVolume,
} from "./js/schema.js";

let isEditing = false;
let isRegistering = false; // Estado do modal (Login vs Registo)

// =========================================================================
// UI Elements
const statusDot = document.getElementById("statusDot");
const userEmailLabel = document.getElementById("userEmailLabel");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Modal Logic
function toggleAuthMode() {
  isRegistering = !isRegistering;
  updateAuthUI(isRegistering);
}

function forceLocalMode() {
  setLocalMode(true);
  initLocalStorage();
}

// --- System State & Init ---

function setSystemMode(mode, userEmail = null) {
  if (mode === "cloud") {
    setLocalMode(false);
    statusDot.className =
      "absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse";
    userEmailLabel.innerText = userEmail ? userEmail.split("@")[0] : "Online";
    userEmailLabel.title = userEmail;
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    setLocalMode(true);
    statusDot.className =
      "absolute -top-1 -right-1 w-3 h-3 bg-gray-400 rounded-full border-2 border-white";
    userEmailLabel.innerText = "Offline";
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

async function initApp() {
  try {
    // Inicializa o Firebase passando o callback de mudança de estado do usuário
    const { auth, db } = initFirebaseApp((user) => {
      setStoreUser(user);
      if (user) {
        setupRealtimeSync(user.uid, (error) => {
          console.error(error);
          if (error.code === "permission-denied") {
            alert(
              "Atenção: Permissões insuficientes no Firebase. Verifique se as Regras (Rules) estão em modo de teste.",
            );
          }
          forceLocalMode();
        });
        setSystemMode("cloud", user.email);
      } else {
        stopRealtimeSync();
        if (!isLocalMode()) {
          isRegistering = false;
          openAuthModal(isRegistering);
        } else {
          initLocalStorage();
        }
      }
    });

    // Passa as instâncias configuradas para os módulos que precisam delas
    initAuth(auth);
    initStore(db);

    // Prepara a UI para reagir às mudanças do Storage
    setOnDataChanged(() => {
      renderTable();
    });
  } catch (e) {
    console.error("Erro init:", e);
    setLocalMode(true);
    initLocalStorage();
  }
}

function initLocalStorage() {
  setSystemMode("local");
  loadLocalData();
}

// --- Standard Logic ---
async function handleSubmit() {
  const woodType = document.getElementById("woodType").value;
  const lengthM = parseDimension(document.getElementById("length").value);
  const widthM = parseDimension(document.getElementById("width").value);
  const thicknessM = parseDimension(document.getElementById("thickness").value);
  const quantity = parseQuantity(document.getElementById("qty").value);
  const editId = document.getElementById("editId").value;

  if (!isValidWoodType(woodType)) {
    showToast("Selecione uma madeira válida.", "error");
    return;
  }
  if (lengthM === null || widthM === null || thicknessM === null) {
    showToast(
      "Dimensões inválidas. Use números maiores que zero com no máximo 2 casas decimais.",
      "error",
    );
    return;
  }
  if (quantity === null) {
    showToast("Quantidade inválida. Use um número inteiro maior ou igual a 1.", "error");
    return;
  }

  try {
    if (isEditing && editId) {
      const items = getItems();
      const existing = items.find((i) => i.id == editId);
      if (!existing) {
        showToast("Registro não encontrado.", "error");
        return;
      }
      const updated = applyWoodItemEdit(existing, {
        woodType,
        lengthM,
        widthM,
        thicknessM,
        quantity,
      });
      await updateItem(editId, updated);
      showToast(`Atualizado (${isLocalMode() ? "Local" : "Cloud"})`, "success");
      cancelEdit();
    } else {
      const itemData = createWoodItem({
        woodType,
        lengthM,
        widthM,
        thicknessM,
        quantity,
      });
      await addItem(itemData);
      showToast(`Salvo (${isLocalMode() ? "Local" : "Cloud"})`, "success");
      resetForm(false);
    }
  } catch (e) {
    console.error(e);
    if (e.message === "local_storage_full") {
      showToast("Atenção: Limite de armazenamento local atingido!", "error");
    } else {
      showToast("Erro ao guardar. Verifique permissões.", "error");
    }
  }
}

async function deleteItem(id) {
  if (
    !confirm(
      "Excluir este registro definitivamente? Esta ação não poderá ser desfeita.",
    )
  )
    return;
  try {
    await deleteItemFromStore(id);
  } catch (e) {
    console.error(e);
  }
  if (isEditing) cancelEdit();
}

async function clearAll() {
  if (
    !confirm(
      "Apagar TODOS os dados definitivamente? Esta ação não poderá ser desfeita.",
    )
  )
    return;
  try {
    await clearAllItems();
    if (!isLocalMode()) showToast("Limpo (Cloud)", "success");
  } catch (e) {
    console.error(e);
  }
  cancelEdit();
}

function editItem(id) {
  const items = getItems();
  const item = items.find((i) => i.id == id);
  if (!item) return;
  isEditing = true;
  document.getElementById("editId").value = item.id;
  document.getElementById("formTitle").textContent = "Editar Entrada";
  const btn = document.getElementById("submitBtn");
  const svgIcon = isLocalMode() ? ICONS.saveLocal : ICONS.saveCloud;
  btn.innerHTML = `${svgIcon} <span>Salvar Alterações</span>`;
  btn.classList.remove("bg-wood-600", "hover:bg-wood-700");
  btn.classList.add("bg-blue-600", "hover:bg-blue-700");
  document.getElementById("cancelEditBtn").classList.remove("hidden");
  document.getElementById("woodType").value = item.woodType;
  document.getElementById("length").value = formatDecimalBR(item.lengthM);
  document.getElementById("width").value = formatDecimalBR(item.widthM);
  document.getElementById("thickness").value = formatDecimalBR(item.thicknessM);
  document.getElementById("qty").value = item.quantity;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
  isEditing = false;
  document.getElementById("editId").value = "";
  document.getElementById("formTitle").textContent = "Nova Entrada";
  const btn = document.getElementById("submitBtn");
  btn.innerHTML = `${ICONS.add} <span>Adicionar Registro</span>`;
  btn.classList.add("bg-wood-600", "hover:bg-wood-700");
  btn.classList.remove("bg-blue-600", "hover:bg-blue-700");
  document.getElementById("cancelEditBtn").classList.add("hidden");
  resetForm(true);
}

function resetForm(fullClear = true) {
  document.getElementById("length").value = "";
  document.getElementById("width").value = "";
  document.getElementById("thickness").value = "";
  document.getElementById("qty").value = "1";
  if (fullClear) document.getElementById("woodType").value = "";
  document.getElementById("length").focus();
}

function renderTable() {
  const items = getItems();
  const tbody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");
  const filterText = searchInput ? searchInput.value.toLowerCase() : "";
  tbody.innerHTML = "";

  let totalQtd = 0;
  const filteredItems = items.filter((item) =>
    item.woodType.toLowerCase().includes(filterText),
  );
  filteredItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const totalVol = sumOfficialVolume(filteredItems);

  if (filteredItems.length === 0) {
    const iconSvg = isLocalMode() ? ICONS.emptyLocal : ICONS.emptyCloud;
    tbody.innerHTML = `<tr class="block sm:table-row"><td colspan="5" class="block sm:table-cell px-6 py-12 text-center text-stone-400"><div class="flex flex-col items-center">${iconSvg}<p>${items.length === 0 ? "A lista está vazia." : "Nenhum resultado encontrado."}</p></div></td></tr>`;
  } else {
    // Otimização de Performance: Concatenação de string em vez de múltiplos createElement
    let htmlRows = "";
    filteredItems.forEach((item) => {
      totalQtd += item.quantity;
      htmlRows += `
              <tr class="grid grid-cols-2 gap-2 sm:table-row hover:bg-stone-50 transition group p-4 sm:p-0 border-b border-stone-100 sm:border-none relative">
                  <td class="col-span-2 sm:col-auto px-1 sm:px-6 py-1 sm:py-4 text-stone-900 font-bold sm:font-medium text-base sm:text-sm block sm:table-cell break-words">
                      ${item.woodType}
                  </td>
                  <td class="col-span-2 sm:col-auto px-1 sm:px-3 py-0 sm:py-4 text-left sm:text-center text-stone-500 font-mono text-xs flex justify-between sm:table-cell items-center">
                      <span class="sm:hidden font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Dimensões</span>
                      <span>${formatDecimalBR(item.lengthM)} x ${formatDecimalBR(item.widthM)} x ${formatDecimalBR(item.thicknessM)}</span>
                  </td>
                  <td class="col-span-1 sm:col-auto px-1 sm:px-3 py-1 sm:py-4 text-left sm:text-center text-stone-700 font-bold flex flex-col sm:table-cell">
                      <span class="sm:hidden font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Qtd</span>
                      <span class="mt-0.5 sm:mt-0">${item.quantity}</span>
                  </td>
                  <td class="col-span-1 sm:col-auto px-1 sm:px-6 py-1 sm:py-4 text-right text-stone-900 font-mono font-bold flex flex-col sm:table-cell">
                      <span class="sm:hidden font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Volume</span>
                      <span class="mt-0.5 sm:mt-0 text-lg sm:text-sm text-wood-700 sm:text-stone-900">${formatDecimalBR(item.officialVolumeM3)}</span>
                  </td>
                  <td class="hidden print:table-cell px-3 py-4 text-right font-mono text-stone-500 text-xs">
                      ${formatGrossVolumeBR(item.grossVolumeM3)}
                  </td>
                  <td class="hidden print:table-cell px-3 py-4 text-center text-stone-500 text-xs">
                      ${formatDateBR(item.createdAt)}
                  </td>
                  <td class="hidden print:table-cell px-3 py-4 text-center text-stone-500 text-xs">
                      ${formatDateBR(item.updatedAt)}
                  </td>
                  <td class="col-span-2 sm:col-auto pt-3 pb-1 sm:px-6 sm:py-4 text-center no-print border-t border-stone-100 sm:border-none mt-2 sm:mt-0 block sm:table-cell">
                      <div class="flex justify-end sm:justify-center gap-4 sm:gap-2 opacity-100 sm:opacity-50 group-hover:opacity-100 transition">
                          <button data-action="edit" data-id="${item.id}" class="text-blue-500 hover:text-blue-700 p-2 sm:p-1 flex items-center gap-1 bg-blue-50 sm:bg-transparent rounded sm:rounded-none"><span class="sm:hidden text-xs font-medium">Editar</span>${ICONS.edit}</button>
                          <button data-action="delete" data-id="${item.id}" class="text-red-400 hover:text-red-600 p-2 sm:p-1 flex items-center gap-1 bg-red-50 sm:bg-transparent rounded sm:rounded-none"><span class="sm:hidden text-xs font-medium">Excluir</span>${ICONS.delete}</button>
                      </div>
                  </td>
              </tr>`;
    });
    tbody.innerHTML = htmlRows;
  }
  const formattedTotalVol = formatDecimalBR(totalVol) + " m³";
  document.getElementById("navTotalVolume").textContent = formattedTotalVol;
  document.getElementById("statVolume").textContent = formatDecimalBR(totalVol);
  document.getElementById("statCount").textContent = totalQtd;
  document.getElementById("tableTotalQtd").textContent = totalQtd;
  document.getElementById("tableTotalVol").textContent = formattedTotalVol;
}

function filterTable() {
  renderTable();
}

function adjustQty(change) {
  const input = document.getElementById("qty");
  let val = parseInt(input.value) || 0;
  val = Math.max(1, val + change);
  input.value = val;
}

function exportTableToExcel(filename) {
  const items = getItems();
  if (items.length === 0) {
    showToast("Sem dados.", "error");
    return;
  }

  const btn = document.getElementById("exportExcelBtn");
  const originalHtml = btn.innerHTML;

  // Atualiza a UI para o estado de carregando
  btn.innerHTML = `${ICONS.spinner} Exportando...`;
  btn.disabled = true;
  btn.classList.add("opacity-75", "cursor-wait");

  // Usamos setTimeout para dar tempo ao navegador de renderizar o botão de carregamento
  // antes de travar a thread principal com o processamento do Excel
  setTimeout(() => {
    try {
      const data = items.map((item) => ({
        Madeira: item.woodType,
        "Comprimento (m)": Number(item.lengthM.toFixed(2)),
        "Largura (m)": Number(item.widthM.toFixed(2)),
        "Espessura (m)": Number(item.thicknessM.toFixed(2)),
        Quantidade: item.quantity,
        // Volume Bruto preserva o valor exato calculado (pode ter até 6
        // casas decimais, já que as 3 dimensões têm no máximo 2 casas cada);
        // a formatação visual de até 6 casas é aplicada via máscara da
        // célula (cell.z) abaixo, sem arredondar o valor armazenado.
        "Volume Bruto (m³)": item.grossVolumeM3,
        "Volume Oficial (m³)": Number(item.officialVolumeM3.toFixed(2)),
        "Data de Criação": formatDateBR(item.createdAt),
        "Última Atualização": formatDateBR(item.updatedAt),
      }));

      const totalVol = sumOfficialVolume(items);
      const totalQtd = items.reduce((acc, curr) => acc + curr.quantity, 0);
      data.push({
        Madeira: "TOTAL",
        Quantidade: totalQtd,
        "Volume Oficial (m³)": Number(totalVol.toFixed(2)),
      });

      const worksheet = XLSX.utils.json_to_sheet(data);

      // Ajustar automaticamente a largura das colunas
      const colWidths = Object.keys(data[0]).map((key) => {
        let max = key.toString().length; // Tamanho base é o do título da coluna
        data.forEach((row) => {
          const val =
            row[key] !== undefined && row[key] !== null
              ? row[key].toString()
              : "";
          if (val.length > max) max = val.length;
        });
        return { wch: max + 3 }; // +3 para dar uma margem visual de respiro
      });
      worksheet["!cols"] = colWidths;

      // Estilo do cabeçalho (Fundo marrom e texto branco em negrito)
      const headerStyle = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "9A5338" } }, // Cor equivalente ao 'wood-700'
        alignment: { horizontal: "center", vertical: "center" },
      };

      // Descobre qual é a última linha no Excel (Tamanho dos dados + 1 linha do cabeçalho)
      const totalRowIndex = data.length + 1;

      // Forçar a formatação visual do Excel para exibir exatamente 2 casas decimais (ex: 1.50)
      for (let cellAddress in worksheet) {
        if (cellAddress[0] === "!") continue; // Ignora chaves internas do SheetJS
        const cell = worksheet[cellAddress];
        const rowIndex = cellAddress.replace(/\D/g, ""); // Extrai apenas o número da linha

        // Aplica o estilo se for a primeira linha (cabeçalho)
        if (rowIndex === "1") {
          cell.s = headerStyle;
        } else if (rowIndex === totalRowIndex.toString()) {
          // Aplica fonte maior e negrito na linha de TOTAL
          cell.s = { font: { bold: true, sz: 12 } };
        }

        // Comprimento, Largura, Espessura e Volume Oficial: exibição fixa em
        // 2 casas decimais (o valor já é exato nessas colunas).
        if (cell.t === "n" && /^[BCDG]/.test(cellAddress)) {
          cell.z = "0.00";
        }
        // Volume Bruto: o valor armazenado não é arredondado (pode ter até
        // 6 casas, já que vem de 3 dimensões com no máximo 2 casas cada);
        // a máscara só controla a exibição, exibindo até 6 casas sem zeros
        // à direita desnecessários, sem alterar o valor da célula.
        if (cell.t === "n" && /^F/.test(cellAddress)) {
          cell.z = "0.######";
        }
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Cubagem");

      XLSX.writeFile(workbook, filename);
      showToast("Excel gerado com sucesso.", "success");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      showToast("Erro ao exportar Excel.", "error");
    } finally {
      // Restaura o botão para o estado original em qualquer situação (sucesso ou erro)
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      btn.classList.remove("opacity-75", "cursor-wait");
    }
  }, 50); // 50ms de atraso intencional
}

function printReport() {
  document.getElementById("printDate").innerText = new Date().toLocaleString(
    "pt-BR",
  );
  window.print();
}

// =========================================================================
// EVENT LISTENERS SETUP
// =========================================================================
function setupEventListeners() {
  // Auth Modal Events
  document.getElementById("authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleAuthSubmit(isRegistering);
  });
  document
    .getElementById("forgotPasswordBtn")
    .addEventListener("click", handlePasswordReset);
  document
    .getElementById("toggleAuthBtn")
    .addEventListener("click", toggleAuthMode);
  document.getElementById("forceLocalAuthBtn").addEventListener("click", () => {
    closeAuthModal();
    forceLocalMode();
  });

  // Navbar Events
  document.getElementById("loginBtn").addEventListener("click", () => {
    isRegistering = false;
    openAuthModal(isRegistering);
  });
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("clearAllBtn").addEventListener("click", clearAll);

  // Form Events
  document.getElementById("woodForm").addEventListener("submit", (e) => {
    e.preventDefault();
    handleSubmit();
  });
  document
    .getElementById("cancelEditBtn")
    .addEventListener("click", cancelEdit);
  document
    .getElementById("qtyMinusBtn")
    .addEventListener("click", () => adjustQty(-1));
  document
    .getElementById("qtyPlusBtn")
    .addEventListener("click", () => adjustQty(1));

  // Máscara decimal automática: o usuário digita só algarismos e os 2
  // últimos são posicionados como casas decimais (ex.: 462 -> 4,62).
  ["length", "width", "thickness"].forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
      input.value = formatDimensionInput(input.value);
      input.setSelectionRange(input.value.length, input.value.length);
    });
  });

  // Navegação com a tecla Enter entre os campos de dimensão
  const formFlow = ["length", "width", "thickness", "qty"];
  formFlow.forEach((id, index) => {
    if (index < formFlow.length - 1) {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault(); // Evita submeter o formulário antes de chegar à quantidade
          document.getElementById(formFlow[index + 1]).focus();
        }
      });
    }
  });

  // Submete o formulário ao pressionar Enter no campo de quantidade
  document.getElementById("qty").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Impede o comportamento padrão do Enter
      handleSubmit();
    }
  });

  // Toolbar Events
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", filterTable); // O evento 'input' é superior ao 'keyup'
  document.getElementById("printBtn").addEventListener("click", printReport);
  document.getElementById("exportExcelBtn").addEventListener("click", () => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    exportTableToExcel(`relatorio_cubagem_${yyyy}${mm}${dd}.xlsx`);
  });

  // Table Events (Delegação de Eventos para os botões editar/eliminar)
  document.getElementById("tableBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.action === "edit") editItem(btn.dataset.id);
    if (btn.dataset.action === "delete") deleteItem(btn.dataset.id);
  });
}

// Boot
setupEventListeners();
initApp();
