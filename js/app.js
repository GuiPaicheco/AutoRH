/**
 * ============================================================================
 * Importador de Planilhas Excel - app.js
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para importação e 
 * visualização de dados de planilhas Excel (.xlsx, .xls) no navegador.
 * 
 * Arquitetura organizada em 3 módulos principais:
 * 1. Interface & Eventos (UI Controller)
 * 2. Leitura do Arquivo Excel (Excel Reader)
 * 3. Renderização da Tabela (Table Renderer)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // Mapeamento de Elementos do DOM
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

    // ------------------------------------------------------------------------
    // 1. MÓDULO DE INTERFACE & EVENTOS (UI Controller)
    // ------------------------------------------------------------------------

    /**
     * Inicializa os ouvintes de eventos da interface do usuário.
     */
    function initEvents() {
        // Evento de seleção de arquivo via input
        fileInput.addEventListener('change', handleFileSelect);

        // Evento de remoção de arquivo
        btnRemoveFile.addEventListener('click', resetView);

        // Eventos de Drag & Drop na área de upload
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
    }

    /**
     * Manipula a seleção de arquivo via input padrão.
     * @param {Event} event 
     */
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            processFile(file);
        }
    }

    /**
     * Manipula o evento quando o arquivo é arrastado para cima da zona de soltura.
     * @param {DragEvent} event 
     */
    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.add('drag-active');
    }

    /**
     * Manipula o evento quando o arquivo sai da zona de soltura.
     * @param {DragEvent} event 
     */
    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-active');
    }

    /**
     * Manipula a soltura (drop) do arquivo na zona indicada.
     * @param {DragEvent} event 
     */
    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        dropZone.classList.remove('drag-active');

        const files = event.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            // Atualiza também o input file
            fileInput.files = files;
            processFile(file);
        }
    }

    /**
     * Processa e valida o tipo do arquivo selecionado antes da leitura.
     * @param {File} file 
     */
    function processFile(file) {
        const validExtensions = ['.xlsx', '.xls'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            alert('Por favor, selecione um arquivo Excel válido (.xlsx ou .xls).');
            resetView();
            return;
        }

        // Exibe o nome do arquivo na interface
        showFileName(file.name);

        // Inicia a leitura do arquivo Excel
        readExcelFile(file);
    }

    /**
     * Exibe o nome do arquivo importado e ajusta a exibição dos cards.
     * @param {string} name 
     */
    function showFileName(name) {
        fileNameText.textContent = name;
        fileInfoCard.classList.remove('hidden');
    }

    /**
     * Reseta a interface para o estado inicial ("Nenhuma planilha carregada").
     */
    function resetView() {
        fileInput.value = '';
        fileNameText.textContent = 'Nenhum arquivo';
        fileInfoCard.classList.add('hidden');
        
        // Limpa a tabela
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        // Alterna para o estado vazio
        tableWrapper.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 2. MÓDULO DE LEITURA DO ARQUIVO EXCEL (Excel Reader)
    // ------------------------------------------------------------------------

    /**
     * Lê o conteúdo do arquivo Excel utilizando a biblioteca SheetJS (XLSX).
     * Toda a leitura é realizada 100% no navegador (Client-Side).
     * @param {File} file 
     */
    function readExcelFile(file) {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                
                // Lê o livro do Excel (Workbook)
                const workbook = XLSX.read(data, { type: 'array' });

                // Seleciona a PRIMEIRA planilha existente
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Converte os dados da planilha em uma matriz 2D (array de arrays)
                // header: 1 garante que cada linha seja um array sequencial de valores
                const rawData = XLSX.utils.sheet_to_json(worksheet, { 
                    header: 1,
                    defval: '' // Preenche células vazias com string vazia
                });

                // Se houver dados, chama o módulo de renderização
                if (rawData && rawData.length > 0) {
                    renderTable(rawData);
                } else {
                    alert('A planilha selecionada está vazia.');
                    resetView();
                }
            } catch (error) {
                console.error('Erro ao ler o arquivo Excel:', error);
                alert('Ocorreu um erro ao tentar ler o arquivo Excel.');
                resetView();
            }
        };

        reader.readAsArrayBuffer(file);
    }

    // ------------------------------------------------------------------------
    // 3. MÓDULO DE RENDERIZAÇÃO DA TABELA (Table Renderer)
    // ------------------------------------------------------------------------

    /**
     * Renderiza os dados no elemento <table> preservando a estrutura original.
     * A primeira linha da planilha é utilizada como cabeçalho (<thead>).
     * @param {Array<Array<any>>} data - Matriz 2D contendo os dados da planilha
     */
    function renderTable(data) {
        // Limpa qualquer conteúdo anterior
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.length === 0) return;

        // --- 1. Renderiza o Cabeçalho (Primeira Linha da Planilha) ---
        const headerRowData = data[0];
        const trHead = document.createElement('tr');

        headerRowData.forEach((cellValue) => {
            const th = document.createElement('th');
            th.textContent = cellValue !== undefined && cellValue !== null ? cellValue : '';
            trHead.appendChild(th);
        });
        tableHead.appendChild(trHead);

        // --- 2. Renderiza o Corpo da Tabela (Demais Linhas) ---
        const bodyRowsData = data.slice(1);
        const fragment = document.createDocumentFragment();

        bodyRowsData.forEach((rowData) => {
            // Ignora linhas totalmente vazias se desejado ou renderiza mantendo colunas
            const tr = document.createElement('tr');
            
            // Garante que cada linha renderize todas as colunas correspondentes ao cabeçalho
            for (let i = 0; i < headerRowData.length; i++) {
                const td = document.createElement('td');
                const cellValue = rowData[i];
                td.textContent = cellValue !== undefined && cellValue !== null ? cellValue : '';
                tr.appendChild(td);
            }

            fragment.appendChild(tr);
        });

        tableBody.appendChild(fragment);

        // --- 3. Atualiza Visibilidade da Interface ---
        emptyState.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
    }

    // Inicializa a aplicação
    initEvents();
});
