/**
 * ============================================================================
 * Importador de Planilhas - app.js (Estilo Excel / Google Sheets)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para leitura e 
 * visualização de planilhas nos formatos .xlsx, .xls, .csv, .tsv e .ods.
 * 
 * Arquitetura organizada em 4 módulos principais:
 * 1. Utilidades de Planilha (Excel Utilities)
 * 2. Interface & Eventos (UI Controller)
 * 3. Leitura de Arquivo (Spreadsheet Reader)
 * 4. Renderização Interativa da Tabela (Table Renderer)
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

    // Estado da Aplicação (Reservado para extensões futuras: filtros, ordenação, etc.)
    const appState = {
        currentFile: null,
        rawMatrixData: [],
        selectedCell: null
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

    // ------------------------------------------------------------------------
    // 2. MÓDULO DE INTERFACE & EVENTOS (UI Controller)
    // ------------------------------------------------------------------------

    /**
     * Inicializa os ouvintes de eventos da interface.
     */
    function initEvents() {
        // Evento de seleção de arquivo via input file
        fileInput.addEventListener('change', handleFileSelect);

        // Evento de remoção de planilha
        btnRemoveFile.addEventListener('click', resetView);

        // Eventos de Drag & Drop na zona de upload
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
    }

    /**
     * Trata a seleção de arquivo via input.
     * @param {Event} event 
     */
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            processFile(file);
        }
    }

    /**
     * Trata o efeito dragover.
     * @param {DragEvent} event 
     */
    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('drag-active');
    }

    /**
     * Trata o efeito dragleave.
     * @param {DragEvent} event 
     */
    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-active');
    }

    /**
     * Trata a soltura (drop) do arquivo na zona indicada.
     * @param {DragEvent} event 
     */
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

    /**
     * Valida os formatos suportados (.xlsx, .xls, .csv, .tsv, .ods) e envia para leitura.
     * @param {File} file 
     */
    function processFile(file) {
        const validExtensions = ['.xlsx', '.xls', '.csv', '.tsv', '.ods'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            alert('Formato não suportado. Por favor, selecione um arquivo .xlsx, .xls, .csv, .tsv ou .ods.');
            resetView();
            return;
        }

        appState.currentFile = file;
        showFileName(file.name);
        readSpreadsheetFile(file);
    }

    /**
     * Exibe a badge com o nome do arquivo selecionado.
     * @param {string} name 
     */
    function showFileName(name) {
        fileNameText.textContent = name;
        fileInfoCard.classList.remove('hidden');
    }

    /**
     * Reseta a interface para o estado padrão ("Nenhuma planilha carregada").
     */
    function resetView() {
        fileInput.value = '';
        fileNameText.textContent = 'Nenhum arquivo';
        fileInfoCard.classList.add('hidden');
        
        appState.currentFile = null;
        appState.rawMatrixData = [];
        appState.selectedCell = null;

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        tableWrapper.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 3. MÓDULO DE LEITURA DE ARQUIVO (Spreadsheet Reader)
    // ------------------------------------------------------------------------

    /**
     * Lê planilhas nos formatos Excel, CSV, TSV e ODS utilizando SheetJS no navegador.
     * @param {File} file 
     */
    function readSpreadsheetFile(file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                
                // SheetJS lê nativamente XLSX, XLS, CSV, TSV e ODS a partir do Uint8Array
                const workbook = XLSX.read(data, { type: 'array' });

                // Obtém a primeira planilha existente no arquivo
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Converte em matriz 2D mantendo valores originais sem alterações
                const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1,
                    defval: '' // Mantém células vazias com string vazia
                });

                if (rawMatrix && rawMatrix.length > 0) {
                    appState.rawMatrixData = rawMatrix;
                    renderSpreadsheetTable(rawMatrix);
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
    // 4. MÓDULO DE RENDERIZAÇÃO DA TABELA (Table Renderer)
    // ------------------------------------------------------------------------

    /**
     * Renderiza a matriz de dados em formato de planilha moderna (Excel / Google Sheets).
     * Exibe letras nas colunas (A, B, C...), números nas linhas (1, 2, 3...) e
     * nomeação inteligente com o conteúdo da primeira linha.
     * 
     * @param {Array<Array<any>>} matrix - Matriz bidimensional de dados.
     */
    function renderSpreadsheetTable(matrix) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (matrix.length === 0) return;

        // Identifica o total de colunas necessárias com base na maior linha existente
        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

        // --- A. Renderiza a Linha de Cabeçalho Superior (Letras + Título Inteligente) ---
        const trHead = document.createElement('tr');
        
        // 1. Célula Origem Superior Esquerda (Canto fixo)
        const thCorner = document.createElement('th');
        thCorner.className = 'corner-header';
        thCorner.textContent = '#';
        trHead.appendChild(thCorner);

        // A primeira linha dos dados é usada como fonte de títulos inteligentes das colunas
        const firstRowData = matrix[0] || [];

        // 2. Colunas com Letras (A, B, C...) + Nomes Inteligentes
        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            const th = document.createElement('th');
            th.className = 'col-header';
            th.dataset.colIndex = colIdx;

            const letter = getExcelColumnName(colIdx);
            const titleValue = firstRowData[colIdx] !== undefined && firstRowData[colIdx] !== null 
                ? String(firstRowData[colIdx]).trim() 
                : '';

            // Estrutura do Título: Letra + Nome Inteligente (se houver)
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

        // --- B. Renderiza o Corpo da Tabela com Numeração de Linhas (1, 2, 3...) ---
        // A partir da segunda linha de dados (índice 1 em diante)
        const bodyRows = matrix.slice(1);
        const fragment = document.createDocumentFragment();

        bodyRows.forEach((rowData, rowIdx) => {
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = rowIdx + 1; // 1-indexed para numeração amigável

            // 1. Coluna Fixa do Número da Linha (1, 2, 3...)
            const thRowIndex = document.createElement('th');
            thRowIndex.className = 'row-index';
            thRowIndex.textContent = rowIdx + 1;
            tr.appendChild(thRowIndex);

            // 2. Células de Dados da Linha
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

        // --- C. Adiciona Interatividade de Planilha (Hover de Linha/Coluna e Seleção) ---
        setupTableInteractivity();

        // --- D. Atualiza Visibilidade ---
        emptyState.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
    }

    /**
     * Configura ouvintes de interatividade para destaque visual de linhas, colunas e seleção de células.
     */
    function setupTableInteractivity() {
        // Remover listeners antigos usando delegação de eventos no tableBody
        tableBody.removeEventListener('mouseover', handleTableMouseOver);
        tableBody.removeEventListener('mouseout', handleTableMouseOut);
        tableBody.removeEventListener('click', handleTableClick);

        tableBody.addEventListener('mouseover', handleTableMouseOver);
        tableBody.addEventListener('mouseout', handleTableMouseOut);
        tableBody.addEventListener('click', handleTableClick);
    }

    /**
     * Destaca a linha inteira e a coluna inteira ao passar o mouse sobre qualquer célula.
     * @param {MouseEvent} event 
     */
    function handleTableMouseOver(event) {
        const td = event.target.closest('td');
        if (!td) return;

        const colIdx = td.dataset.colIndex;
        const tr = td.closest('tr');

        // Destaca a linha inteira
        if (tr) {
            tr.classList.add('row-hover');
        }

        // Destaca a coluna inteira (células de dados + cabeçalho da coluna)
        if (colIdx !== undefined) {
            const allColCells = tableWrapper.querySelectorAll(`[data-col-index="${colIdx}"]`);
            allColCells.forEach(cell => cell.classList.add('col-hover'));
        }
    }

    /**
     * Remove os destaques visuais quando o mouse sai da célula.
     * @param {MouseEvent} event 
     */
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

    /**
     * Gerencia a seleção visual de célula ao clicar (Estilo borda ativa do Excel).
     * @param {MouseEvent} event 
     */
    function handleTableClick(event) {
        const td = event.target.closest('td');
        if (!td) return;

        // Remove seleção anterior se houver
        if (appState.selectedCell) {
            appState.selectedCell.classList.remove('cell-selected');
        }

        // Define a nova célula selecionada
        td.classList.add('cell-selected');
        appState.selectedCell = td;
    }

    // Inicializa os eventos da aplicação
    initEvents();
});
