/**
 * ============================================================================
 * Importador de Planilhas - app.js (Estilo Excel / Google Sheets + Pipeline SIGA)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para leitura, seleção de
 * tipo de planilha (Modal) e pipeline modular de tratamento de dados.
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
     * A nova primeira linha passa a ser a nova 1ª linha (cabeçalho).
     * 
     * @param {Array<Array<any>>} matrix - Matriz bidimensional de dados.
     * @param {number} count - Quantidade de linhas a remover do topo.
     * @returns {Array<Array<any>>} Matriz com as linhas removidas.
     */
    function removeTopRowsRule(matrix, count = 3) {
        if (!matrix || matrix.length <= count) {
            return [];
        }
        return matrix.slice(count);
    }

    /**
     * Regra 2: Remove todas as colunas que estejam COMPLETAMENTE vazias.
     * Uma coluna é totalmente vazia quando TODAS as suas células forem vazias.
     * 
     * @param {Array<Array<any>>} matrix - Matriz bidimensional de dados.
     * @returns {Array<Array<any>>} Matriz sem as colunas vazias.
     */
    function removeEmptyColumnsRule(matrix) {
        if (!matrix || matrix.length === 0) return [];

        // Descobre a quantidade máxima de colunas existentes
        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        // Identifica quais colunas possuem pelo menos 1 valor não-vazio
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

        // Filtra a matriz mantendo apenas os índices de colunas com conteúdo
        const cleanMatrix = matrix.map(row => {
            return nonArrayColIndices.map(colIdx => row[colIdx]);
        });

        return cleanMatrix;
    }

    /**
     * Registro de Pipelines de Tratamento por Tipo de Planilha.
     * Arquitetura preparada para adicionar novos tipos e regras facilmente.
     */
    const SPREADSHEET_PIPELINES = {
        // Fluxo Planilha do SIGA: Executa Regra 1 e Regra 2
        siga: [
            (matrix) => removeTopRowsRule(matrix, 3),
            (matrix) => removeEmptyColumnsRule(matrix)
        ],
        // Fluxo Planilha de Relatório (Reservado para versões futuras)
        relatorio: []
    };

    /**
     * Executa o pipeline de tratamento correspondente ao tipo de planilha selecionado.
     * @param {string} sheetType - 'siga' ou 'relatorio'
     * @param {Array<Array<any>>} rawMatrix - Matriz de dados brutos
     * @returns {Array<Array<any>>} Matriz tratada
     */
    function runTreatmentPipeline(sheetType, rawMatrix) {
        const pipeline = SPREADSHEET_PIPELINES[sheetType];
        if (!pipeline || pipeline.length === 0) {
            return rawMatrix;
        }

        // Executa as regras em sequência de forma pura (sem mutação colateral)
        return pipeline.reduce((currentMatrix, ruleFn) => ruleFn(currentMatrix), rawMatrix);
    }

    // ------------------------------------------------------------------------
    // 3. GERENCIAMENTO DO MODAL DE SELEÇÃO (Modal Controller)
    // ------------------------------------------------------------------------

    /**
     * Abre o modal para o usuário escolher o tipo da planilha.
     */
    function openTypeModal() {
        hideModalAlert();
        typeSelectionModal.classList.remove('hidden');
    }

    /**
     * Fecha o modal de seleção.
     */
    function closeTypeModal() {
        typeSelectionModal.classList.add('hidden');
        hideModalAlert();
    }

    /**
     * Exibe o aviso para fluxos ainda não implementados.
     * @param {string} message 
     */
    function showModalAlert(message) {
        modalAlertText.textContent = message;
        modalAlert.classList.remove('hidden');
    }

    /**
     * Oculta o aviso do modal.
     */
    function hideModalAlert() {
        modalAlert.classList.add('hidden');
    }

    /**
     * Trata a seleção da opção "Planilha de Relatório".
     */
    function handleSelectRelatorio() {
        showModalAlert("Este fluxo será implementado em uma versão futura.");
    }

    /**
     * Trata a seleção da opção "Planilha do SIGA".
     */
    function handleSelectSiga() {
        appState.selectedType = 'siga';
        closeTypeModal();

        // Inicia o pipeline de tratamento do SIGA
        const treated = runTreatmentPipeline('siga', appState.rawMatrixData);
        appState.treatedMatrixData = treated;

        // Renderiza a matriz resultante na tabela
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

        // Eventos do Modal
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
                    // Abre o modal para escolha do tipo ANTES de qualquer processamento ou exibição
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

        // Descobre a quantidade de colunas da matriz tratada
        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        // --- A. Renderiza a Linha de Cabeçalho (Letras + Nome Inteligente) ---
        const trHead = document.createElement('tr');
        
        const thCorner = document.createElement('th');
        thCorner.className = 'corner-header';
        thCorner.textContent = '#';
        trHead.appendChild(thCorner);

        // A primeira linha da matriz tratada torna-se o cabeçalho
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

            // Coluna Fixa do Número da Linha
            const thRowIndex = document.createElement('th');
            thRowIndex.className = 'row-index';
            thRowIndex.textContent = rowIdx + 1;
            tr.appendChild(thRowIndex);

            // Células de Dados
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
