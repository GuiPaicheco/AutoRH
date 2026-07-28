/**
 * ============================================================================
 * Importador de Planilhas - app.js (Resiliência & Modo Debug de Diagnóstico)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para leitura, escolha do
 * tipo de planilha, tratamento robusto via pipeline e diagnóstico avançado.
 * 
 * Arquitetura em Módulos:
 * 1. Mapeamento & Utilidades (Header Normalization & Number Utilities)
 * 2. Módulo de Diagnóstico (Debug & Diagnostic Engine)
 * 3. Motor de Regras & Pipelines (Treatment Pipeline Engine)
 * 4. Módulo do Resumo Financeiro (Financial Summary Engine)
 * 5. Gerenciamento do Modal (Modal Controller)
 * 6. Interface & Eventos (UI Controller)
 * 7. Leitura de Arquivo (Spreadsheet Reader)
 * 8. Renderização da Tabela & Debug (Render Controller)
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

    // Elementos do Modo Debug
    const btnToggleDebug = document.getElementById('btnToggleDebug');
    const debugPanel = document.getElementById('debugPanel');
    const debugGrid = document.getElementById('debugGrid');
    const debugWarningsContainer = document.getElementById('debugWarningsContainer');

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
        summaryData: {},
        isDebugMode: false
    };

    // Estado de Diagnóstico (Debug Context)
    const debugContext = {
        rawRowsCount: 0,
        rawColsCount: 0,
        originalHeaders: [],
        normalizedHeaders: [],
        removedTopRowsCount: 0,
        removedBottomRowsCount: 0,
        removedEmptyColsCount: 0,
        removedSpecificColsLog: [],
        renamedColsLog: [],
        groupedCategoriesLog: [],
        missingExpectedCols: [],
        categoryTotals: {}
    };

    // ------------------------------------------------------------------------
    // 1. MAPEAMENTO & UTILIDADES (Header Normalization & Number Utilities)
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
     * Normaliza nomes de cabeçalhos eliminando variações de digitação, espaços extras,
     * caracteres invisíveis (\r, \n, \t, \u00A0), e convertendo para CAIXA ALTA.
     * 
     * @param {any} header 
     * @returns {string} Cabeçalho limpo e padronizado para comparação robusta
     */
    function normalizeHeaderName(header) {
        if (header === null || header === undefined) return '';
        let str = String(header);

        // 1. Remove caracteres invisíveis de controle (ASCII 0-31 e 127-159) e espaço inseparável
        str = str.replace(/[\u0000-\u001F\u007F-\u009F\u00A0\uFEFF]/g, ' ');

        // 2. Substitui quebras de linha e tabulações por um espaço simples
        str = str.replace(/[\r\n\t]+/g, ' ');

        // 3. Reduz múltiplos espaços internos sequenciais a apenas um espaço
        str = str.replace(/\s+/g, ' ');

        // 4. Remove espaços nas extremidades e converte para CAIXA ALTA
        return str.trim().toUpperCase();
    }

    /**
     * Converte um índice numérico de coluna em letras do Excel (0 -> A, 1 -> B, 25 -> Z...).
     * @param {number} index 
     * @returns {string}
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
     * Verifica se uma célula está completamente vazia.
     * @param {any} value 
     * @returns {boolean}
     */
    function isCellEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        return false;
    }

    /**
     * Parser numérico blindado à prova de NaN.
     * Aceita moedas (R$), decimais com vírgula ou ponto, inteiros, negativos e texto numérico.
     * Células vazias ou inválidas retornam 0.
     * 
     * @param {any} val 
     * @returns {number}
     */
    function parseNumericValue(val) {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;

        let str = String(val).trim();
        if (str === '') return 0;

        // Trata formato de moeda/número brasileiro ou americano
        if (str.includes(',') && str.includes('.')) {
            // "1.250,50" -> remove o ponto de milhar e troca a vírgula decimal por ponto
            if (str.indexOf('.') < str.indexOf(',')) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                // "1,250.50" -> formato americano
                str = str.replace(/,/g, '');
            }
        } else if (str.includes(',')) {
            // "1250,50" -> troca vírgula por ponto
            str = str.replace(',', '.');
        }

        // Remove R$, espaços e caracteres não numéricos exceto hífen (negativo) e ponto
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
    // 2. MÓDULO DE DIAGNÓSTICO (Debug & Diagnostic Engine)
    // ------------------------------------------------------------------------

    function resetDebugContext() {
        debugContext.rawRowsCount = 0;
        debugContext.rawColsCount = 0;
        debugContext.originalHeaders = [];
        debugContext.normalizedHeaders = [];
        debugContext.removedTopRowsCount = 0;
        debugContext.removedBottomRowsCount = 0;
        debugContext.removedEmptyColsCount = 0;
        debugContext.removedSpecificColsLog = [];
        debugContext.renamedColsLog = [];
        debugContext.groupedCategoriesLog = [];
        debugContext.missingExpectedCols = [];
        debugContext.categoryTotals = {};
    }

    /**
     * Renderiza o painel de diagnóstico com todas as métricas e avisos do Modo Debug.
     */
    function renderDebugPanel() {
        if (!appState.isDebugMode) {
            debugPanel.classList.add('hidden');
            return;
        }

        debugPanel.classList.remove('hidden');
        debugWarningsContainer.innerHTML = '';
        debugGrid.innerHTML = '';

        // --- A. Renderiza Avisos de Colunas Ausentes ---
        if (debugContext.missingExpectedCols.length > 0) {
            debugWarningsContainer.classList.remove('hidden');
            debugContext.missingExpectedCols.forEach(missingCol => {
                const warnCard = document.createElement('div');
                warnCard.className = 'debug-warning-card';
                warnCard.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span><strong>Aviso de Diagnóstico:</strong> Coluna esperada não encontrada na planilha: <code>${missingCol}</code></span>
                `;
                debugWarningsContainer.appendChild(warnCard);
            });
        } else {
            debugWarningsContainer.classList.add('hidden');
        }

        // --- B. Card 1: Métricas de Entrada & Importação ---
        const cardImport = document.createElement('div');
        cardImport.className = 'debug-card';
        cardImport.innerHTML = `
            <div class="debug-card-title">1. Dados Importados</div>
            <div class="debug-metric-list">
                <div class="debug-metric-item"><span class="debug-metric-label">Linhas Brutas:</span><span class="debug-metric-value">${debugContext.rawRowsCount}</span></div>
                <div class="debug-metric-item"><span class="debug-metric-label">Colunas Brutas:</span><span class="debug-metric-value">${debugContext.rawColsCount}</span></div>
                <div class="debug-metric-item"><span class="debug-metric-label">Arquivo:</span><span class="debug-metric-value">${appState.currentFile ? appState.currentFile.name : 'Nenhum'}</span></div>
            </div>
        `;

        // --- C. Card 2: Mapeamento & Normalização de Cabeçalhos ---
        const cardHeaders = document.createElement('div');
        cardHeaders.className = 'debug-card';
        const normItems = debugContext.normalizedHeaders.map((norm, idx) => {
            const orig = debugContext.originalHeaders[idx] || '';
            return `<div><strong>${getExcelColumnName(idx)}:</strong> "${orig}" ➔ <code>"${norm}"</code></div>`;
        }).join('');
        cardHeaders.innerHTML = `
            <div class="debug-card-title">2. Normalização de Cabeçalhos</div>
            <div class="debug-log-box">${normItems || 'Nenhum cabeçalho identificado'}</div>
        `;

        // --- D. Card 3: Transformações & Remoções de Estrutura ---
        const cardRemovals = document.createElement('div');
        cardRemovals.className = 'debug-card';
        cardRemovals.innerHTML = `
            <div class="debug-card-title">3. Remoções do Pipeline</div>
            <div class="debug-metric-list">
                <div class="debug-metric-item"><span class="debug-metric-label">Linhas do Topo Removidas:</span><span class="debug-metric-value">${debugContext.removedTopRowsCount}</span></div>
                <div class="debug-metric-item"><span class="debug-metric-label">Linhas do Rodapé Removidas:</span><span class="debug-metric-value">${debugContext.removedBottomRowsCount}</span></div>
                <div class="debug-metric-item"><span class="debug-metric-label">Colunas Vazias Removidas:</span><span class="debug-metric-value">${debugContext.removedEmptyColsCount}</span></div>
                <div class="debug-metric-item"><span class="debug-metric-label">Colunas Específicas Removidas:</span><span class="debug-metric-value">${debugContext.removedSpecificColsLog.join(', ') || 'Nenhuma'}</span></div>
            </div>
        `;

        // --- E. Card 4: Renomeações & Agrupamentos ---
        const cardRenames = document.createElement('div');
        cardRenames.className = 'debug-card';
        const renameLogs = debugContext.renamedColsLog.map(item => `<div>• <code>${item.original}</code> ➔ <strong>${item.renamed}</strong></div>`).join('');
        cardRenames.innerHTML = `
            <div class="debug-card-title">4. Renomeação & Agrupamento</div>
            <div class="debug-log-box">${renameLogs || 'Nenhuma coluna renomeada'}</div>
        `;

        // --- F. Card 5: Resumo Calculado por Categoria ---
        const cardTotals = document.createElement('div');
        cardTotals.className = 'debug-card';
        const totalItems = Object.keys(debugContext.categoryTotals).map(cat => {
            return `<div class="debug-metric-item"><span class="debug-metric-label">${cat}:</span><span class="debug-metric-value">${formatBRL(debugContext.categoryTotals[cat])}</span></div>`;
        }).join('');
        cardTotals.innerHTML = `
            <div class="debug-card-title">5. Totais Calculados</div>
            <div class="debug-metric-list">${totalItems || 'Nenhum total calculado'}</div>
        `;

        debugGrid.appendChild(cardImport);
        debugGrid.appendChild(cardHeaders);
        debugGrid.appendChild(cardRemovals);
        debugGrid.appendChild(cardRenames);
        debugGrid.appendChild(cardTotals);
    }

    // ------------------------------------------------------------------------
    // 3. MOTOR DE REGRAS & PIPELINES (Treatment Pipeline Engine)
    // ------------------------------------------------------------------------

    function removeTopRowsRule(matrix, count = 3) {
        if (!matrix || matrix.length <= count) {
            debugContext.removedTopRowsCount = matrix ? matrix.length : 0;
            return [];
        }
        debugContext.removedTopRowsCount = count;
        return matrix.slice(count);
    }

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

        debugContext.removedEmptyColsCount = maxCols - nonArrayColIndices.length;
        return matrix.map(row => nonArrayColIndices.map(colIdx => row[colIdx]));
    }

    function removeSpecificColumnsByLetterRule(matrix, lettersOrder = ['J', 'I', 'H', 'G', 'A']) {
        if (!matrix || matrix.length === 0) return [];

        let currentMatrix = matrix.map(row => [...row]);
        debugContext.removedSpecificColsLog = [];

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
                    debugContext.removedSpecificColsLog.push(letter);
                }
            }
        });

        return currentMatrix;
    }

    function removeBottomRowsRule(matrix, count = 2) {
        if (!matrix || matrix.length <= count) {
            debugContext.removedBottomRowsCount = matrix ? matrix.length : 0;
            return [];
        }
        debugContext.removedBottomRowsCount = count;
        return matrix.slice(0, matrix.length - count);
    }

    /**
     * Regra 5: Padronização dos nomes das colunas com comparações normalizadas e robustas.
     */
    function standardizeHeaderNamesRule(matrix, nameMap = COLUMN_NAME_MAP) {
        if (!matrix || matrix.length === 0) return [];

        const updatedMatrix = matrix.map(row => [...row]);
        const headerRow = updatedMatrix[0] || [];

        debugContext.originalHeaders = [...headerRow];
        debugContext.normalizedHeaders = headerRow.map(h => normalizeHeaderName(h));
        debugContext.renamedColsLog = [];
        debugContext.missingExpectedCols = [];

        // Prepara o dicionário de busca com chaves normalizadas
        const normalizedMap = {};
        Object.keys(nameMap).forEach(key => {
            normalizedMap[normalizeHeaderName(key)] = nameMap[key];
        });

        const foundNormalizedKeys = new Set();

        const newHeaderRow = headerRow.map(cell => {
            const normCell = normalizeHeaderName(cell);
            if (normalizedMap[normCell]) {
                const newName = normalizedMap[normCell];
                debugContext.renamedColsLog.push({
                    original: String(cell).trim(),
                    renamed: newName
                });
                foundNormalizedKeys.add(normCell);
                return newName;
            }
            return cell;
        });

        // Identifica quais colunas mapeadas esperadas NÃO foram encontradas
        Object.keys(COLUMN_NAME_MAP).forEach(key => {
            const normKey = normalizeHeaderName(key);
            if (!foundNormalizedKeys.has(normKey)) {
                debugContext.missingExpectedCols.push(key);
            }
        });

        updatedMatrix[0] = newHeaderRow;
        return updatedMatrix;
    }

    const SPREADSHEET_PIPELINES = {
        siga: [
            (matrix) => removeTopRowsRule(matrix, 3),                                        // Regra 1
            (matrix) => removeEmptyColumnsRule(matrix),                                       // Regra 2
            (matrix) => removeSpecificColumnsByLetterRule(matrix, ['J', 'I', 'H', 'G', 'A']), // Regra 3
            (matrix) => removeBottomRowsRule(matrix, 2),                                      // Regra 4
            (matrix) => standardizeHeaderNamesRule(matrix, COLUMN_NAME_MAP)                   // Regra 5
        ],
        relatorio: []
    };

    function runTreatmentPipeline(sheetType, rawMatrix) {
        const pipeline = SPREADSHEET_PIPELINES[sheetType];
        if (!pipeline || pipeline.length === 0) {
            return rawMatrix;
        }
        return pipeline.reduce((currentMatrix, ruleFn) => ruleFn(currentMatrix), rawMatrix);
    }

    // ------------------------------------------------------------------------
    // 4. MÓDULO DO RESUMO FINANCEIRO (Financial Summary Engine)
    // ------------------------------------------------------------------------

    function calculateFinancialSummary(matrix) {
        if (!matrix || matrix.length <= 1) return {};

        const headerRow = matrix[0] || [];
        const dataRows = matrix.slice(1);
        const validStandardNames = Array.from(new Set(Object.values(COLUMN_NAME_MAP)));

        const categoryTotals = {};
        debugContext.groupedCategoriesLog = [];

        headerRow.forEach((colName, colIdx) => {
            const trimmedName = String(colName).trim();

            if (validStandardNames.includes(trimmedName)) {
                if (!categoryTotals[trimmedName]) {
                    categoryTotals[trimmedName] = 0;
                    debugContext.groupedCategoriesLog.push(trimmedName);
                }

                dataRows.forEach(row => {
                    const rawVal = row[colIdx];
                    const numVal = parseNumericValue(rawVal);
                    categoryTotals[trimmedName] += numVal;
                });
            }
        });

        debugContext.categoryTotals = categoryTotals;
        return categoryTotals;
    }

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
    // 5. GERENCIAMENTO DO MODAL DE SELEÇÃO (Modal Controller)
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

        // 3. Renderiza o Modo Debug, Cartões e Tabela
        renderFinancialSummaryCards(summaryData);
        renderSpreadsheetTable(treated);
        renderDebugPanel();
    }

    // ------------------------------------------------------------------------
    // 6. MÓDULO DE INTERFACE & EVENTOS (UI Controller)
    // ------------------------------------------------------------------------

    function initEvents() {
        fileInput.addEventListener('change', handleFileSelect);
        btnRemoveFile.addEventListener('click', resetView);

        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

        // Evento de Alternância do Modo Debug
        btnToggleDebug.addEventListener('click', () => {
            appState.isDebugMode = !appState.isDebugMode;
            btnToggleDebug.classList.toggle('active', appState.isDebugMode);
            renderDebugPanel();
        });

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

        resetDebugContext();

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        summaryGrid.innerHTML = '';

        summaryContainer.classList.add('hidden');
        tableWrapper.classList.add('hidden');
        debugPanel.classList.add('hidden');
        emptyState.classList.remove('hidden');
        closeTypeModal();
    }

    // ------------------------------------------------------------------------
    // 7. MÓDULO DE LEITURA DE ARQUIVO (Spreadsheet Reader)
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
                    resetDebugContext();
                    appState.rawMatrixData = rawMatrix;

                    // Registra estatísticas iniciais de diagnóstico
                    debugContext.rawRowsCount = rawMatrix.length;
                    let maxCols = 0;
                    rawMatrix.forEach(r => { if (r.length > maxCols) maxCols = r.length; });
                    debugContext.rawColsCount = maxCols;

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
    // 8. RENDERIZAÇÃO DA TABELA (Table Renderer)
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

        // --- A. Renderiza o Cabeçalho ---
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
