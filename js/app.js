/**
 * ============================================================================
 * Importador de Planilhas - app.js (Estilo Excel + Pipeline SIGA + Resumo Financeiro)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para leitura, escolha do
 * tipo de planilha, tratamento via pipeline e geração de resumo financeiro.
 * 
 * Arquitetura em Módulos:
 * 1. Mapeamento & Utilidades (Excel & Number Utilities)
 * 2. Motor de Regras & Pipelines (Treatment Pipeline Engine)
 * 3. Módulo do Resumo Financeiro (Financial Summary Engine)
 * 4. Gerenciamento do Modal (Modal Controller)
 * 5. Interface & Eventos (UI Controller)
 * 6. Leitura de Arquivo (Spreadsheet Reader)
 * 7. Renderização da Tabela & Cards (Render Controller)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // Mapeamento dos Elementos do DOM
    // ------------------------------------------------------------------------
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const fileInfoCard = document.getElementById('fileInfoCard');
    const fileNameText = document.getElementById('fileNameText');
    const btnRemoveFile = document.getElementById('btnRemoveFile');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.getElementById('tableWrapper');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');

    // Elementos do Resumo Financeiro
    const summaryContainer = document.getElementById('summaryContainer');
    const summaryGrid = document.getElementById('summaryGrid');

    // Elementos do Modal
    const typeSelectionModal = document.getElementById('typeSelectionModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const btnOptionRelatorio = document.getElementById('btnOptionRelatorio');
    const btnOptionSiga = document.getElementById('btnOptionSiga');
    const modalAlert = document.getElementById('modalAlert');
    const modalAlertText = document.getElementById('modalAlertText');

    // Estado da Aplicação
    const appState = {
        currentFile: null,
        rawMatrixData: [],
        treatedMatrixData: [],
        selectedCell: null,
        selectedType: null,
        summaryData: {}
    };

    // ------------------------------------------------------------------------
    // 1. MAPEAMENTO & UTILIDADES (Excel & Number Utilities)
    // ------------------------------------------------------------------------

    /**
     * Tabela Oficial de Padronização de Nomes das Colunas (Regra 5).
     */
    const COLUMN_NAME_MAP = {
        'COM_INCP_AGENTE': 'Remuneração a Pessoal Estatutário (ACS)',
        'COM_INCP_COMISSIONADO': 'Remuneração a Pessoal - CLT',
        'COM_INCP_TEMPORARIO': 'Remuneração a Pessoal - CLT',
        'COM_INCP_ESTAGIARIO': 'Remuneração a Pessoal - CLT',
        'COM_INCP_ESTATUTARIO': 'Remuneração a Pessoal Estatutário Municipal',
        'SEM_INCP_AGENTE': 'Benefício a Pessoal Estatutário (ACS)',
        'SEM_INCP_COMISSIONADO': 'Benefício a Pessoal - CLT',
        'SEM_INCP_TEMPORARIO': 'Benefício a Pessoal - CLT',
        'SEM_INCP_ESTAGIARIO': 'Remuneração a Pessoal - CLT',
        'SEM_INCP_ESTATUTARIO': 'Benefício a Pessoal Estatutário Municipal',
        'HORA EXTRA': 'Hora Extra'
    };

    /**
     * Converte um índice numérico de coluna em letras do Excel (0 -> A, 1 -> B, 25 -> Z, 26 -> AA...).
     * @param {number} index - Índice zero-based da coluna.
     * @returns {string} Identificador alfabético da coluna.
     */
    function getExcelColumnName(index) {
        let colName = '';
        let num = index;
        while (num >= 0) {
            colName = String.fromCharCode((num % 26) + 65) + colName;
            num = Math.floor(num / 26) - 1;
        }
        return colName;
    }

    /**
     * Converte uma letra de coluna do Excel (A, B... Z, AA...) em índice numérico zero-based.
     * @param {string} letter 
     * @returns {number}
     */
    function excelColumnNameToIndex(letter) {
        const cleanLetter = String(letter).trim().toUpperCase();
        let index = 0;
        for (let i = 0; i < cleanLetter.length; i++) {
            index = index * 26 + (cleanLetter.charCodeAt(i) - 64);
        }
        return index - 1;
    }

    /**
     * Verifica se uma célula está vazia.
     * @param {any} value 
     * @returns {boolean}
     */
    function isCellEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        return false;
    }

    /**
     * Converte um valor bruto de célula em número válido (suporta decimais, negativos e formato pt-BR).
     * @param {any} val 
     * @returns {number}
     */
    function parseNumericValue(val) {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;

        let str = String(val).trim();
        if (str === '') return 0;

        // Trata formato de moeda/número brasileiro ("1.234,56" ou "-1.234,56")
        if (str.includes(',') && str.includes('.')) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else if (str.includes(',')) {
            str = str.replace(',', '.');
        }

        // Remove quaisquer caracteres que não sejam dígitos, sinal de menos ou ponto decimal
        str = str.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Formata um valor numérico em moeda brasileira (R$ 0,00).
     * @param {number} amount 
     * @returns {string}
     */
    function formatBRL(amount) {
        return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // ------------------------------------------------------------------------
    // 2. MOTOR DE REGRAS & PIPELINES (Treatment Pipeline Engine)
    // ------------------------------------------------------------------------

    /**
     * Regra 1: Remover as `count` primeiras linhas.
     */
    function removeTopRowsRule(matrix, count = 3) {
        if (!matrix || matrix.length <= count) return [];
        return matrix.slice(count);
    }

    /**
     * Regra 2: Remover colunas 100% vazias.
     */
    function removeEmptyColumnsRule(matrix) {
        if (!matrix || matrix.length === 0) return [];

        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        const nonArrayColIndices = [];
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            let hasContent = false;
            for (let rowIdx = 0; rowIdx < matrix.length; rowIdx++) {
                const cellVal = matrix[rowIdx][colIdx];
                if (!isCellEmpty(cellVal)) {
                    hasContent = true;
                    break;
                }
            }
            if (hasContent) {
                nonArrayColIndices.push(colIdx);
            }
        }

        return matrix.map(row => nonArrayColIndices.map(colIdx => row[colIdx]));
    }

    /**
     * Regra 3: Remover colunas específicas por letras (J, I, H, G, A nesta ordem).
     */
    function removeSpecificColumnsByLetterRule(matrix, lettersOrder = ['J', 'I', 'H', 'G', 'A']) {
        if (!matrix || matrix.length === 0) return [];

        let currentMatrix = matrix.map(row => [...row]);

        lettersOrder.forEach(letter => {
            const targetIdx = excelColumnNameToIndex(letter);

            if (targetIdx >= 0) {
                let currentMaxCols = 0;
                currentMatrix.forEach(row => {
                    if (row.length > currentMaxCols) currentMaxCols = row.length;
                });

                if (targetIdx < currentMaxCols) {
                    currentMatrix = currentMatrix.map(row => {
                        const newRow = [...row];
                        newRow.splice(targetIdx, 1);
                        return newRow;
                    });
                }
            }
        });

        return currentMatrix;
    }

    /**
     * Regra 4: Remover as `count` últimas linhas.
     */
    function removeBottomRowsRule(matrix, count = 2) {
        if (!matrix || matrix.length <= count) return [];
        return matrix.slice(0, matrix.length - count);
    }

    /**
     * Regra 5: Padronização dos nomes das colunas de acordo com a tabela de mapeamento.
     * @param {Array<Array<any>>} matrix 
     * @param {Object} nameMap 
     * @returns {Array<Array<any>>}
     */
    function standardizeHeaderNamesRule(matrix, nameMap = COLUMN_NAME_MAP) {
        if (!matrix || matrix.length === 0) return [];

        const updatedMatrix = matrix.map(row => [...row]);
        const headerRow = updatedMatrix[0] || [];

        const newHeaderRow = headerRow.map(cell => {
            const cellStr = String(cell).trim().toUpperCase();

            // Procura correspondência insensível a maiúsculas/minúsculas
            const foundKey = Object.keys(nameMap).find(key => key.toUpperCase() === cellStr);
            if (foundKey) {
                return nameMap[foundKey];
            }
            return cell;
        });

        updatedMatrix[0] = newHeaderRow;
        return updatedMatrix;
    }

    /**
     * Registro de Pipelines de Tratamento por Tipo de Planilha.
     */
    const SPREADSHEET_PIPELINES = {
        // Fluxo "Planilha do SIGA": Regras 1, 2, 3, 4 e 5
        siga: [
            (matrix) => removeTopRowsRule(matrix, 3),                                        // Regra 1
            (matrix) => removeEmptyColumnsRule(matrix),                                       // Regra 2
            (matrix) => removeSpecificColumnsByLetterRule(matrix, ['J', 'I', 'H', 'G', 'A']), // Regra 3
            (matrix) => removeBottomRowsRule(matrix, 2),                                      // Regra 4
            (matrix) => standardizeHeaderNamesRule(matrix, COLUMN_NAME_MAP)                   // Regra 5
        ],
        relatorio: []
    };

    /**
     * Executa o pipeline de tratamento correspondente.
     * @param {string} sheetType 
     * @param {Array<Array<any>>} rawMatrix 
     * @returns {Array<Array<any>>}
     */
    function runTreatmentPipeline(sheetType, rawMatrix) {
        const pipeline = SPREADSHEET_PIPELINES[sheetType];
        if (!pipeline || pipeline.length === 0) {
            return rawMatrix;
        }
        return pipeline.reduce((currentMatrix, ruleFn) => ruleFn(currentMatrix), rawMatrix);
    }

    // ------------------------------------------------------------------------
    // 3. MÓDULO DO RESUMO FINANCEIRO (Financial Summary Engine)
    // ------------------------------------------------------------------------

    /**
     * Regra 6: Agrupa automaticamente todas as colunas financeiras padronizadas
     * e calcula o somatório total acumulado de cada categoria.
     * 
     * @param {Array<Array<any>>} matrix - Matriz tratada (contendo o cabeçalho padronizado na linha 0)
     * @returns {Object} Dicionário contendo { [categoriaPadronizada]: valorTotal }
     */
    function calculateFinancialSummary(matrix) {
        if (!matrix || matrix.length <= 1) return {};

        const headerRow = matrix[0] || [];
        const dataRows = matrix.slice(1);

        // Obter a lista de nomes padronizados válidos
        const validStandardNames = Array.from(new Set(Object.values(COLUMN_NAME_MAP)));

        const categoryTotals = {};

        // Mapeia todas as colunas que pertencem a alguma categoria padronizada
        headerRow.forEach((colName, colIdx) => {
            const trimmedName = String(colName).trim();

            if (validStandardNames.includes(trimmedName)) {
                if (!categoryTotals[trimmedName]) {
                    categoryTotals[trimmedName] = 0;
                }

                // Soma todas as células daquela coluna nas linhas de dados
                dataRows.forEach(row => {
                    const rawVal = row[colIdx];
                    const numVal = parseNumericValue(rawVal);
                    categoryTotals[trimmedName] += numVal;
                });
            }
        });

        return categoryTotals;
    }

    /**
     * Renderiza o painel visual com cartões contendo os totais de cada categoria.
     * @param {Object} summaryTotals - Objeto com os totais calculados { categoria: valor }
     */
    function renderFinancialSummaryCards(summaryTotals) {
        summaryGrid.innerHTML = '';

        const categories = Object.keys(summaryTotals);

        if (categories.length === 0) {
            summaryContainer.classList.add('hidden');
            return;
        }

        const fragment = document.createDocumentFragment();

        categories.forEach(categoryName => {
            const totalValue = summaryTotals[categoryName] || 0;

            const card = document.createElement('div');
            card.className = 'summary-card';

            const title = document.createElement('span');
            title.className = 'summary-card-title';
            title.textContent = categoryName;

            const value = document.createElement('span');
            value.className = 'summary-card-value';
            value.textContent = formatBRL(totalValue);

            card.appendChild(title);
            card.appendChild(value);
            fragment.appendChild(card);
        });

        summaryGrid.appendChild(fragment);
        summaryContainer.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 4. GERENCIAMENTO DO MODAL DE SELEÇÃO (Modal Controller)
    // ------------------------------------------------------------------------

    function openTypeModal() {
        hideModalAlert();
        typeSelectionModal.classList.remove('hidden');
    }

    function closeTypeModal() {
        typeSelectionModal.classList.add('hidden');
        hideModalAlert();
    }

    function showModalAlert(message) {
        modalAlertText.textContent = message;
        modalAlert.classList.remove('hidden');
    }

    function hideModalAlert() {
        modalAlert.classList.add('hidden');
    }

    function handleSelectRelatorio() {
        showModalAlert("Este fluxo será implementado em uma versão futura.");
    }

    function handleSelectSiga() {
        appState.selectedType = 'siga';
        closeTypeModal();

        // 1. Executa o pipeline de tratamento do SIGA (Regras 1 a 5)
        const treated = runTreatmentPipeline('siga', appState.rawMatrixData);
        appState.treatedMatrixData = treated;

        // 2. Calcula o Resumo Financeiro (Regra 6)
        const summaryData = calculateFinancialSummary(treated);
        appState.summaryData = summaryData;

        // 3. Renderiza os cartões de resumo e a tabela tratada
        renderFinancialSummaryCards(summaryData);
        renderSpreadsheetTable(treated);
    }

    // ------------------------------------------------------------------------
    // 5. MÓDULO DE INTERFACE & EVENTOS (UI Controller)
    // ------------------------------------------------------------------------

    function initEvents() {
        fileInput.addEventListener('change', handleFileSelect);
        btnRemoveFile.addEventListener('click', resetView);

        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

        modalCloseBtn.addEventListener('click', () => {
            closeTypeModal();
            if (appState.treatedMatrixData.length === 0) {
                resetView();
            }
        });

        btnOptionRelatorio.addEventListener('click', handleSelectRelatorio);
        btnOptionSiga.addEventListener('click', handleSelectSiga);
    }

    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            processFile(file);
        }
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('drag-active');
    }

    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-active');
    }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-active');

        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            fileInput.files = files;
            processFile(file);
        }
    }

    function processFile(file) {
        const validExtensions = ['.xlsx', '.xls', '.csv', '.tsv', '.ods'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            alert('Formato não suportado. Selecione um arquivo .xlsx, .xls, .csv, .tsv ou .ods.');
            resetView();
            return;
        }

        appState.currentFile = file;
        showFileName(file.name);
        readSpreadsheetFile(file);
    }

    function showFileName(name) {
        fileNameText.textContent = name;
        fileInfoCard.classList.remove('hidden');
    }

    function resetView() {
        fileInput.value = '';
        fileNameText.textContent = 'Nenhum arquivo';
        fileInfoCard.classList.add('hidden');
        
        appState.currentFile = null;
        appState.rawMatrixData = [];
        appState.treatedMatrixData = [];
        appState.selectedCell = null;
        appState.selectedType = null;
        appState.summaryData = {};

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        summaryGrid.innerHTML = '';

        summaryContainer.classList.add('hidden');
        tableWrapper.classList.add('hidden');
        emptyState.classList.remove('hidden');
        closeTypeModal();
    }

    // ------------------------------------------------------------------------
    // 6. MÓDULO DE LEITURA DE ARQUIVO (Spreadsheet Reader)
    // ------------------------------------------------------------------------

    function readSpreadsheetFile(file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1,
                    defval: '' 
                });

                if (rawMatrix && rawMatrix.length > 0) {
                    appState.rawMatrixData = rawMatrix;
                    openTypeModal();
                } else {
                    alert('A planilha selecionada não possui dados.');
                    resetView();
                }
            } catch (error) {
                console.error('Erro ao ler a planilha:', error);
                alert('Não foi possível ler o arquivo. Certifique-se de que o arquivo não está corrompido.');
                resetView();
            }
        };

        reader.readAsArrayBuffer(file);
    }

    // ------------------------------------------------------------------------
    // 7. RENDERIZAÇÃO DA TABELA (Table Renderer)
    // ------------------------------------------------------------------------

    function renderSpreadsheetTable(matrix) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (!matrix || matrix.length === 0) {
            alert('Após o tratamento, a planilha não possui dados a exibir.');
            resetView();
            return;
        }

        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        // --- A. Renderiza o Cabeçalho (Letras + Nome Inteligente Padronizado) ---
        const trHead = document.createElement('tr');
        
        const thCorner = document.createElement('th');
        thCorner.className = 'corner-header';
        thCorner.textContent = '#';
        trHead.appendChild(thCorner);

        const firstRowData = matrix[0] || [];

        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            const th = document.createElement('th');
            th.className = 'col-header';
            th.dataset.colIndex = colIdx;

            const letter = getExcelColumnName(colIdx);
            const titleValue = firstRowData[colIdx] !== undefined && firstRowData[colIdx] !== null 
                ? String(firstRowData[colIdx]).trim() 
                : '';

            const innerDiv = document.createElement('div');
            innerDiv.className = 'col-header-inner';

            const letterSpan = document.createElement('span');
            letterSpan.className = 'col-letter';
            letterSpan.textContent = letter;
            innerDiv.appendChild(letterSpan);

            if (titleValue !== '') {
                const titleSpan = document.createElement('span');
                titleSpan.className = 'col-title';
                titleSpan.textContent = titleValue;
                innerDiv.appendChild(titleSpan);
            }

            th.appendChild(innerDiv);
            trHead.appendChild(th);
        }
        tableHead.appendChild(trHead);

        // --- B. Renderiza o Corpo da Tabela ---
        const bodyRows = matrix.slice(1);
        const fragment = document.createDocumentFragment();

        bodyRows.forEach((rowData, rowIdx) => {
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = rowIdx + 1;

            const thRowIndex = document.createElement('th');
            thRowIndex.className = 'row-index';
            thRowIndex.textContent = rowIdx + 1;
            tr.appendChild(thRowIndex);

            for (let colIdx = 0; colIdx < maxCols; colIdx++) {
                const td = document.createElement('td');
                td.dataset.colIndex = colIdx;
                td.dataset.rowIndex = rowIdx + 1;

                const cellValue = rowData[colIdx];
                td.textContent = cellValue !== undefined && cellValue !== null ? cellValue : '';

                tr.appendChild(td);
            }

            fragment.appendChild(tr);
        });

        tableBody.appendChild(fragment);

        setupTableInteractivity();

        emptyState.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
    }

    function setupTableInteractivity() {
        tableBody.removeEventListener('mouseover', handleTableMouseOver);
        tableBody.removeEventListener('mouseout', handleTableMouseOut);
        tableBody.removeEventListener('click', handleTableClick);

        tableBody.addEventListener('mouseover', handleTableMouseOver);
        tableBody.addEventListener('mouseout', handleTableMouseOut);
        tableBody.addEventListener('click', handleTableClick);
    }

    function handleTableMouseOver(event) {
        const td = event.target.closest('td');
        if (!td) return;

        const colIdx = td.dataset.colIndex;
        const tr = td.closest('tr');

        if (tr) {
            tr.classList.add('row-hover');
        }

        if (colIdx !== undefined) {
            const allColCells = tableWrapper.querySelectorAll(`[data-col-index="${colIdx}"]`);
            allColCells.forEach(cell => cell.classList.add('col-hover'));
        }
    }

    function handleTableMouseOut(event) {
        const td = event.target.closest('td');
        if (!td) return;

        const tr = td.closest('tr');
        if (tr) {
            tr.classList.remove('row-hover');
        }

        const colIdx = td.dataset.colIndex;
        if (colIdx !== undefined) {
            const allColCells = tableWrapper.querySelectorAll(`[data-col-index="${colIdx}"]`);
            allColCells.forEach(cell => cell.classList.remove('col-hover'));
        }
    }

    function handleTableClick(event) {
        const td = event.target.closest('td');
        if (!td) return;

        if (appState.selectedCell) {
            appState.selectedCell.classList.remove('cell-selected');
        }

        td.classList.add('cell-selected');
        appState.selectedCell = td;
    }

    initEvents();
});
