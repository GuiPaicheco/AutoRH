/**
 * ============================================================================
 * Importador de Planilhas - app.js (Estilo Excel / Google Sheets + Pipeline SIGA Completo)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para leitura, escolha do
 * tipo de planilha e execução do pipeline de tratamento de dados.
 * 
 * Arquitetura em Módulos:
 * 1. Utilidades de Planilha (Excel Utilities)
 * 2. Motor de Regras & Pipelines (Treatment Pipeline Engine)
 * 3. Gerenciamento do Modal (Modal Controller)
 * 4. Interface & Eventos (UI Controller)
 * 5. Leitura de Arquivo (Spreadsheet Reader)
 * 6. Renderização Interativa da Tabela (Table Renderer)
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
        selectedType: null
    };

    // ------------------------------------------------------------------------
    // 1. MÓDULO DE UTILIDADES DE PLANILHA (Excel Utilities)
    // ------------------------------------------------------------------------

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
     * Converte uma letra de coluna do Excel (A, B, C... Z, AA...) em seu índice numérico zero-based.
     * Exemplo: 'A' -> 0, 'G' -> 6, 'H' -> 7, 'I' -> 8, 'J' -> 9.
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
     * Verifica se um valor de célula é considerado totalmente vazio.
     * Células nulas, indefinidas, string vazia ("") ou contendo apenas espaços são vazias.
     * @param {any} value 
     * @returns {boolean}
     */
    function isCellEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        return false;
    }

    // ------------------------------------------------------------------------
    // 2. MOTOR DE REGRAS & PIPELINES (Treatment Pipeline Engine)
    // ------------------------------------------------------------------------

    /**
     * Regra 1: Remove completamente as `count` primeiras linhas da planilha.
     * @param {Array<Array<any>>} matrix 
     * @param {number} count 
     * @returns {Array<Array<any>>}
     */
    function removeTopRowsRule(matrix, count = 3) {
        if (!matrix || matrix.length <= count) {
            return [];
        }
        return matrix.slice(count);
    }

    /**
     * Regra 2: Remove todas as colunas que estejam COMPLETAMENTE vazias.
     * @param {Array<Array<any>>} matrix 
     * @returns {Array<Array<any>>}
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

        const cleanMatrix = matrix.map(row => {
            return nonArrayColIndices.map(colIdx => row[colIdx]);
        });

        return cleanMatrix;
    }

    /**
     * Regra 3: Remover colunas por letras em uma ordem específica.
     * Exemplo: ['J', 'I', 'H', 'G', 'A'].
     * A ordem decrescente é fundamental para evitar alteração dos índices restantes.
     * Caso a coluna não exista na matriz atual, a remoção é ignorada.
     * 
     * @param {Array<Array<any>>} matrix 
     * @param {Array<string>} lettersOrder - Lista de letras na ordem exata de remoção
     * @returns {Array<Array<any>>}
     */
    function removeSpecificColumnsByLetterRule(matrix, lettersOrder = ['J', 'I', 'H', 'G', 'A']) {
        if (!matrix || matrix.length === 0) return [];

        // Cria uma cópia profunda/superficial das linhas da matriz
        let currentMatrix = matrix.map(row => [...row]);

        lettersOrder.forEach(letter => {
            const targetIdx = excelColumnNameToIndex(letter);

            // Verifica se o índice existe na matriz atual
            if (targetIdx >= 0) {
                // Descobre se a matriz possui largura suficiente para essa coluna
                let currentMaxCols = 0;
                currentMatrix.forEach(row => {
                    if (row.length > currentMaxCols) currentMaxCols = row.length;
                });

                if (targetIdx < currentMaxCols) {
                    // Remove a coluna `targetIdx` de todas as linhas
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
     * Regra 4: Remover as `count` últimas linhas da planilha.
     * Sempre remove as duas últimas linhas. Se houver 2 ou menos linhas, esvazia.
     * 
     * @param {Array<Array<any>>} matrix 
     * @param {number} count - Quantidade de linhas do final a remover
     * @returns {Array<Array<any>>}
     */
    function removeBottomRowsRule(matrix, count = 2) {
        if (!matrix || matrix.length <= count) {
            return [];
        }
        return matrix.slice(0, matrix.length - count);
    }

    /**
     * Registro de Pipelines de Tratamento por Tipo de Planilha.
     */
    const SPREADSHEET_PIPELINES = {
        // Fluxo "Planilha do SIGA": Executa em ordem estrita Regras 1, 2, 3 e 4
        siga: [
            (matrix) => removeTopRowsRule(matrix, 3),                                        // Regra 1
            (matrix) => removeEmptyColumnsRule(matrix),                                       // Regra 2
            (matrix) => removeSpecificColumnsByLetterRule(matrix, ['J', 'I', 'H', 'G', 'A']), // Regra 3
            (matrix) => removeBottomRowsRule(matrix, 2)                                      // Regra 4
        ],
        // Fluxo "Planilha de Relatório" (Reservado para versões futuras)
        relatorio: []
    };

    /**
     * Executa o pipeline de tratamento correspondente ao tipo de planilha selecionado.
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
    // 3. GERENCIAMENTO DO MODAL DE SELEÇÃO (Modal Controller)
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

        // Executa o pipeline expandido do SIGA (Regras 1, 2, 3 e 4)
        const treated = runTreatmentPipeline('siga', appState.rawMatrixData);
        appState.treatedMatrixData = treated;

        // Renderiza a tabela final com os dados tratados
        renderSpreadsheetTable(treated);
    }

    // ------------------------------------------------------------------------
    // 4. MÓDULO DE INTERFACE & EVENTOS (UI Controller)
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

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        tableWrapper.classList.add('hidden');
        emptyState.classList.remove('hidden');
        closeTypeModal();
    }

    // ------------------------------------------------------------------------
    // 5. MÓDULO DE LEITURA DE ARQUIVO (Spreadsheet Reader)
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
    // 6. MÓDULO DE RENDERIZAÇÃO DA TABELA (Table Renderer)
    // ------------------------------------------------------------------------

    /**
     * Renderiza a matriz tratada em formato de planilha moderna (Excel / Google Sheets).
     * @param {Array<Array<any>>} matrix - Matriz bidimensional tratada
     */
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

        // --- A. Renderiza o Cabeçalho (Letras + Nome Inteligente) ---
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

        // --- B. Renderiza o Corpo da Tabela (Linhas Restantes) ---
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
