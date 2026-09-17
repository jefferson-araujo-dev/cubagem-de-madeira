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
import { calculateRectangularVolume } from "./js/volume.js";

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
  const desc = document.getElementById("desc").value;
  const length = parseFloat(document.getElementById("length").value);
  const width = parseFloat(document.getElementById("width").value);
  const thickness = parseFloat(document.getElementById("thickness").value);
  const qty = parseInt(document.getElementById("qty").value);
  const editId = document.getElementById("editId").value;

  if (
    !desc ||
    isNaN(length) ||
    isNaN(width) ||
    isNaN(thickness) ||
    isNaN(qty)
  ) {
    showToast("Preencha todos os campos.", "error");
    return;
  }

  const volume = calculateRectangularVolume(length, width, thickness, qty);
  const timestamp = Date.now();
  const itemData = {
    desc,
    length,
    width,
    thickness,
    qty,
    volume,
    updatedAt: timestamp,
  };

  try {
    if (isEditing && editId) {
      await updateItem(editId, itemData);
      showToast(`Atualizado (${isLocalMode() ? "Local" : "Cloud"})`, "success");
      cancelEdit();
    } else {
      itemData.createdAt = timestamp;
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
  if (!confirm("Excluir item?")) return;
  try {
    await deleteItemFromStore(id);
  } catch (e) {
    console.error(e);
  }
  if (isEditing) cancelEdit();
}

async function clearAll() {
  if (!confirm("Apagar TODOS os dados?")) return;
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
  document.getElementById("desc").value = item.desc;
  document.getElementById("length").value = item.length.toFixed(2);
  document.getElementById("width").value = item.width.toFixed(2);
  document.getElementById("thickness").value = item.thickness.toFixed(2);
  document.getElementById("qty").value = item.qty;
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
  if (fullClear) document.getElementById("desc").value = "Prancha de Madeira";
  document.getElementById("length").focus();
}

function renderTable() {
  const items = getItems();
  const tbody = document.getElementById("tableBody");
  const searchInput = document.getElementById("searchInput");
  const filterText = searchInput ? searchInput.value.toLowerCase() : "";
  tbody.innerHTML = "";

  let totalVol = 0;
  let totalQtd = 0;
  const filteredItems = items.filter((item) =>
    item.desc.toLowerCase().includes(filterText),
  );
  filteredItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (filteredItems.length === 0) {
    const iconSvg = isLocalMode() ? ICONS.emptyLocal : ICONS.emptyCloud;
    tbody.innerHTML = `<tr class="block sm:table-row"><td colspan="5" class="block sm:table-cell px-6 py-12 text-center text-stone-400"><div class="flex flex-col items-center">${iconSvg}<p>${items.length === 0 ? "A lista está vazia." : "Nenhum resultado encontrado."}</p></div></td></tr>`;
  } else {
    // Otimização de Performance: Concatenação de string em vez de múltiplos createElement
    let htmlRows = "";
    filteredItems.forEach((item) => {
      totalVol += item.volume;
      totalQtd += item.qty;
      htmlRows += `
              <tr class="grid grid-cols-2 gap-2 sm:table-row hover:bg-stone-50 transition group p-4 sm:p-0 border-b border-stone-100 sm:border-none relative">
                  <td class="col-span-2 sm:col-auto px-1 sm:px-6 py-1 sm:py-4 text-stone-900 font-bold sm:font-medium text-base sm:text-sm block sm:table-cell break-words">
                      ${item.desc}
                  </td>
                  <td class="col-span-2 sm:col-auto px-1 sm:px-3 py-0 sm:py-4 text-left sm:text-center text-stone-500 font-mono text-xs flex justify-between sm:table-cell items-center">
                      <span class="sm:hidden font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Dimensões</span>
                      <span>${item.length.toFixed(2)} x ${item.width.toFixed(2)} x ${item.thickness.toFixed(2)}</span>
                  </td>
                  <td class="col-span-1 sm:col-auto px-1 sm:px-3 py-1 sm:py-4 text-left sm:text-center text-stone-700 font-bold flex flex-col sm:table-cell">
                      <span class="sm:hidden font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Qtd</span>
                      <span class="mt-0.5 sm:mt-0">${item.qty}</span>
                  </td>
                  <td class="col-span-1 sm:col-auto px-1 sm:px-6 py-1 sm:py-4 text-right text-stone-900 font-mono font-bold flex flex-col sm:table-cell">
                      <span class="sm:hidden font-semibold text-stone-400 uppercase tracking-wide text-[10px]">Volume</span>
                      <span class="mt-0.5 sm:mt-0 text-lg sm:text-sm text-wood-700 sm:text-stone-900">${item.volume.toFixed(2)}</span>
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
  const formattedTotalVol = totalVol.toFixed(2) + " m³";
  document.getElementById("navTotalVolume").textContent = formattedTotalVol;
  document.getElementById("statVolume").textContent = totalVol.toFixed(2);
  document.getElementById("statCount").textContent = totalQtd;
  document.getElementById("tableTotalQtd").textContent = totalQtd;
  document.getElementById("tableTotalVol").textContent = formattedTotalVol;
}

function filterTable() {
  renderTable();
}

function formatDimension(input) {
  let value = input.value.replace(/\D/g, "");
  if (value === "") {
    input.value = "";
    return;
  }
  let formattedValue = (parseInt(value) / 100).toFixed(2);
  input.value = formattedValue;
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
        Descrição: item.desc,
        "Comp. (m)": Number(item.length.toFixed(2)),
        "Larg. (m)": Number(item.width.toFixed(2)),
        "Esp. (m)": Number(item.thickness.toFixed(2)),
        "Volume (m³)": Number(item.volume.toFixed(2)),
        Qtd: item.qty,
      }));

      const totalVol = items.reduce((acc, curr) => acc + curr.volume, 0);
      const totalQtd = items.reduce((acc, curr) => acc + curr.qty, 0);
      data.push({
        Descrição: "TOTAL",
        "Volume (m³)": Number(totalVol.toFixed(2)),
        Qtd: totalQtd,
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

        // Aplica a máscara '0.00' apenas se for número e estiver nas colunas B, C, D ou E
        if (cell.t === "n" && /^[B-E]/.test(cellAddress)) {
          cell.z = "0.00";
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

  // Dimension Inputs Events (Substitui o oninput)
  document.querySelectorAll(".dimension-input").forEach((input) => {
    input.addEventListener("input", (e) => formatDimension(e.target));
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
