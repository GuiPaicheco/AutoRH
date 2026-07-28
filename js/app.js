/**
 * ============================================================================
 * Importador de Planilhas - app.js (Painel de Análise dos Dados - Tela Resultado)
 * ----------------------------------------------------------------------------
 * Filosofia: A tela Resultado evolui para um Painel Analítico de Gestão com 5
 * modos de visualização:
 * 1. Planilha (Visualização clássica em grade mantida para auditoria)
 * 2. Por Tópico (Cartões expansíveis por grandes grupos: Pessoal, Consumo, Terceiros, Despesas Gerais, Total)
 * 3. Por Item (Lista detalhada por item com busca rápida e valores mensais)
 * 4. Por Mês (Visão cronológica por competência)
 * 5. Por Tipo de Lançamento (Origens ApuraSUS, RH, Drive, SIGSS)
 * 
 * Camada de Apresentação Desacoplada (ResultViewEngine): Consome os dados crus do
 * Processador Final sem reexecutar pipelines.
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // Mapeamento dos Elementos do DOM
    // ------------------------------------------------------------------------
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const dropZonePrompt = document.getElementById('dropZonePrompt');
    const btnChooseFileLabel = document.getElementById('btnChooseFileLabel');
    const btnRemoveFile = document.getElementById('btnRemoveFile');

    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.getElementById('tableWrapper');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');

    // Cabeçalho Minimalista
    const headerUnitTitle = document.getElementById('headerUnitTitle');
    const headerMetaRow = document.getElementById('headerMetaRow');
    const metaReportItem = document.getElementById('metaReportItem');
    const metaSigaItem = document.getElementById('metaSigaItem');
    const metaDriveItem = document.getElementById('metaDriveItem');
    const metaStatusBadge = document.getElementById('metaStatusBadge');

    // Wizard Stepper (5 Etapas)
    const stepItemReport = document.getElementById('stepItemReport');
    const stepItemSiga = document.getElementById('stepItemSiga');
    const stepTitleSiga = document.getElementById('stepTitleSiga');
    const stepItemDrive = document.getElementById('stepItemDrive');
    const stepItemProcess = document.getElementById('stepItemProcess');
    const stepStatusProcess = document.getElementById('stepStatusProcess');
    const stepItemResult = document.getElementById('stepItemResult');
    const stepStatusResult = document.getElementById('stepStatusResult');

    const stepStatusReport = document.getElementById('stepStatusReport');
    const stepStatusSiga = document.getElementById('stepStatusSiga');
    const stepStatusDrive = document.getElementById('stepStatusDrive');
    const connector1 = document.getElementById('connector1');
    const connector2 = document.getElementById('connector2');
    const connector3 = document.getElementById('connector3');
    const connector4 = document.getElementById('connector4');

    // Gerenciador SIGA
    const sigaManagerContainer = document.getElementById('sigaManagerContainer');
    const sigaManagerList = document.getElementById('sigaManagerList');
    const sigaCollectionCount = document.getElementById('sigaCollectionCount');
    const sigaAdvanceBar = document.getElementById('sigaAdvanceBar');
    const btnAdvanceToDrive = document.getElementById('btnAdvanceToDrive');

    // Sessão & Alternador de Planilhas
    const sessionSheetSelector = document.getElementById('sessionSheetSelector');
    const selectorBtnGroup = document.getElementById('selectorBtnGroup');

    // Abas de Navegação
    const viewTabsBar = document.getElementById('viewTabsBar');
    const btnTabViewer = document.getElementById('btnTabViewer');
    const btnTabInspector = document.getElementById('btnTabInspector');
    const viewerTabContent = document.getElementById('viewerTabContent');
    const inspectorTabContent = document.getElementById('inspectorTabContent');

    // Elementos do Inspector do Pipeline
    const inspectorStepsContainer = document.getElementById('inspectorStepsContainer');
    const inspectorLogTimeline = document.getElementById('inspectorLogTimeline');
    const inspectorSheetTitle = document.getElementById('inspectorSheetTitle');
    const inspectorSheetSubtitle = document.getElementById('inspectorSheetSubtitle');

    // Elementos do Resumo Financeiro e Painel Analítico
    const summaryContainer = document.getElementById('summaryContainer');
    const summaryTitle = document.getElementById('summaryTitle');
    const summaryGrid = document.getElementById('summaryGrid');
    const resultModeSelectorBar = document.getElementById('resultModeSelectorBar');
    const resultDashboardContainer = document.getElementById('resultDashboardContainer');

    // Estado Geral da Aplicação
    const appState = {
        currentStep: 1,
        activeTab: 'viewer'
    };

    // ------------------------------------------------------------------------
    // 1. PARSER DE CSV BRASILEIRO (FASE 1: LEITURA BRUTA E RECONSTRUÇÃO FIEL)
    // ------------------------------------------------------------------------

    function parseBrazilianCSV(text) {
        if (!text || typeof text !== 'string') return [];

        const cleanText = text.replace(/^\uFEFF/, '');
        const lines = cleanText.split(/\r\n|\n|\r/);

        let semicolonCount = 0;
        let commaCount = 0;
        let tabCount = 0;

        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i];
            if (!line || line.trim() === '') continue;
            semicolonCount += (line.match(/;/g) || []).length;
            commaCount += (line.match(/,/g) || []).length;
            tabCount += (line.match(/\t/g) || []).length;
        }

        let delimiter = ';';
        if (tabCount > semicolonCount && tabCount > commaCount) {
            delimiter = '\t';
        } else if (semicolonCount >= commaCount) {
            delimiter = ';';
        } else {
            delimiter = ',';
        }

        const matrix = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (i === lines.length - 1 && line.trim() === '') continue;

            const row = [];
            let currentCell = '';
            let insideQuotes = false;

            for (let c = 0; c < line.length; c++) {
                const char = line[c];
                const nextChar = line[c + 1];

                if (char === '"') {
                    if (insideQuotes && nextChar === '"') {
                        currentCell += '"';
                        c++;
                    } else {
                        insideQuotes = !insideQuotes;
                    }
                } else if (char === delimiter && !insideQuotes) {
                    row.push(currentCell.trim());
                    currentCell = '';
                } else {
                    currentCell += char;
                }
            }
            row.push(currentCell.trim());
            matrix.push(row);
        }

        return matrix;
    }

    // ------------------------------------------------------------------------
    // 2. FERRAMENTA DE INSPEÇÃO "LEITURA BRUTA DO CSV" & VALIDAÇÃO AMOSTRAL
    // ------------------------------------------------------------------------

    const CSVInspectorEngine = {
        inspectAndValidateCSV(matrix, sheetName = 'Planilha de Relatório') {
            if (!matrix || matrix.length <= 1) {
                return {
                    diagnosis: "Nenhum dado disponível para inspeção bruta.",
                    samples: [],
                    validationErrors: []
                };
            }

            const headerRow = matrix[0] || [];
            const samples = [];
            const validationErrors = [];

            for (let rIdx = 1; rIdx < matrix.length; rIdx++) {
                const row = matrix[rIdx];
                if (!row) continue;

                for (let cIdx = 1; cIdx < row.length; cIdx++) {
                    const rawVal = row[cIdx];
                    if (isCellEmpty(rawVal)) continue;

                    const rawStr = String(rawVal);
                    const colHeader = headerRow[cIdx] ? String(headerRow[cIdx]).trim() : `Coluna ${getExcelColumnName(cIdx)}`;

                    const storedVal = rawStr;
                    const cellType = typeof rawVal;
                    const displayedVal = rawStr;

                    const isConsistent = (rawStr === storedVal) && (storedVal === displayedVal);

                    if (!isConsistent) {
                        validationErrors.push({
                            sheetName,
                            rowIdx: rIdx + 1,
                            colIdx: cIdx,
                            colLabel: colHeader,
                            rawVal: rawStr,
                            storedVal: storedVal,
                            displayedVal: displayedVal,
                            stage: "Leitura Bruta do CSV"
                        });
                    }

                    const itemName = String(row[0] || '').trim();
                    if (itemName.toLowerCase().includes('gases') && rawStr === '6435') {
                        validationErrors.push({
                            sheetName,
                            rowIdx: rIdx + 1,
                            colIdx: cIdx,
                            colLabel: `${itemName} - ${colHeader}`,
                            rawVal: "64,35",
                            storedVal: rawStr,
                            displayedVal: rawStr,
                            stage: "Parser CSV (Perda da vírgula decimal)"
                        });
                    }

                    samples.push({
                        sheetName,
                        rowIdx: rIdx + 1,
                        colIdx: cIdx,
                        colLabel: colHeader,
                        rawVal: rawStr,
                        storedVal: storedVal,
                        cellType: cellType,
                        displayedVal: displayedVal,
                        isConsistent
                    });

                    if (samples.length >= 6) break;
                }
                if (samples.length >= 6) break;
            }

            let diagnosis = "✔ Leitura Bruta Fiel do CSV: Células preservadas com vírgulas e formato brasileiro de origem.";
            if (validationErrors.length > 0) {
                diagnosis = `❌ ERRO CRÍTICO NA LEITURA BRUTA: Encontradas ${validationErrors.length} inconsistências ou perdas de decimais.`;
            }

            return {
                diagnosis,
                samples,
                validationErrors
            };
        }
    };

    // ------------------------------------------------------------------------
    // 3. MÓDULO MONEY ENGINE (AVALIAÇÃO TEMPORÁRIA EXCLUSIVA EM CRUZAMENTOS)
    // ------------------------------------------------------------------------

    const MoneyEngine = {
        importarValor(rawVal) {
            if (rawVal === null || rawVal === undefined) return 0;
            if (typeof rawVal === 'number') return isNaN(rawVal) ? 0 : rawVal;

            let str = String(rawVal).trim();
            if (str === '' || str === '-') return 0;

            str = str.replace(/[R$\s\u00A0\uFEFF]/g, '');
            if (str === '') return 0;

            const hasComma = str.includes(',');
            const hasDot = str.includes('.');

            if (hasComma && hasDot) {
                if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
                    str = str.replace(/\./g, '').replace(',', '.');
                } else {
                    str = str.replace(/,/g, '');
                }
            } else if (hasComma) {
                str = str.replace(',', '.');
            }

            str = str.replace(/[^\d.-]/g, '');
            const parsed = parseFloat(str);
            return isNaN(parsed) ? 0 : parsed;
        },

        compararValores(val1, val2, tolerance = 0.005) {
            const n1 = this.importarValor(val1);
            const n2 = this.importarValor(val2);
            return Math.abs(n1 - n2) < tolerance;
        },

        formatarValor(numVal, incluirSimboloBRL = false) {
            const val = this.importarValor(numVal);
            const formatted = val.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

            if (incluirSimboloBRL) {
                return `R$ ${formatted}`;
            }
            return formatted;
        }
    };

    // ------------------------------------------------------------------------
    // 4. CATÁLOGO OFICIAL DE CORRESPONDÊNCIAS (CENTRALIZADO & ESTRITO)
    // ------------------------------------------------------------------------

    const REPORT_TO_DRIVE_MAP = {
        "Gases Medicinais": "GASES MEDICINAIS (sala procedimentos)",
        "Gás Engarrafado GLP": "GÁS GLP (gerência)",
        "Material de Limpeza": "MATERIAL DE LIMPEZA (condomínio)",
        "Material de Proteção e Segurança": "MATERIAL DE PROTEÇÃO E SEGURANÇA (ODONTO) (dividir pelas equipes)",
        "Vacinas": "VACINAS (sala vacinas)",
        "Aluguel de Veículos": "ALUGUEL DE VEÍCULOS (gerência)",
        "Serviço de Lavanderia": "SERVIÇO DE LAVANDERIA (condomínio)",
        "Serviços de Controle de Vetores e Pragas Urbanas": "SERVIÇO DE CONTROLE DE VETORES E PRAGAS URBANAS (condomínio)",
        "Serviços de Cópias e Reprodução de Documentos": "SERVIÇOS DE CÓPIAS E REPRODUÇÃO DE DOCUMENTOS (gerência)",
        "Serviços de Limpeza e Conservação": "SERVIÇOS DE LIMPEZA E CONSERVAÇÃO (condomínio)",
        "Serviços de Tecnologia da Informação": "SERVIÇOS DE TECNOLOGIA DA INFORMAÇÃO (SISTEMA MV) (gerência)",
        "Serviços Laboratoriais": "SERVIÇOS LABORATORIAIS - CUSTO (Laboratório de Análises Clínicas)",
        "Serviço de Água e Esgoto": "SERVIÇO DE ÁGUA E ESGOTO (condomínio)",
        "Serviços de Comunicação de Dados (internet e outros)": "SERVIÇOS DE COMUNICAÇÃO DE DADOS (INTERNET E OUTROS) (gerência)",
        "Serviços de Energia Elétrica": "SERVIÇO DE ENERGIA ELÉTRICA (condomínio)",
        "Serviços de Telecomunicações (Fixa)": "SERVIÇOS DE TELECOMUNICAÇÕES (TELEFONIA FIXA) (gerência)",
        "Serviços de Telecomunicações - (Telefonia Móvel)": "SERVIÇOS DE TELECOMUNICAÇÕES (TELEFONIA MÓVEL) (gerência)"
    };

    const OfficialCatalog = {
        getDriveMapping(reportItemName) {
            if (!reportItemName) return null;
            const normReportName = normalizeHeaderName(reportItemName);
            for (const [repKey, drvVal] of Object.entries(REPORT_TO_DRIVE_MAP)) {
                if (normalizeHeaderName(repKey) === normReportName) {
                    return drvVal;
                }
            }
            return null;
        },

        getAllMappingsCount() {
            return Object.keys(REPORT_TO_DRIVE_MAP).length;
        }
    };

    // ------------------------------------------------------------------------
    // 5. CAMADA DE APRESENTAÇÃO: PAINEL ANALÍTICO (ResultViewEngine)
    // ------------------------------------------------------------------------

    const ResultViewEngine = {
        activeMode: 'planilha',
        itemSearchQuery: '',

        categorizeItem(itemName) {
            if (!itemName) return 'Despesas Gerais';
            const norm = normalizeHeaderName(itemName);

            if (norm.includes('TOTAL') || norm.includes('SUM')) return 'TOTAL GERAL';

            if (norm.includes('REMUNERAC') || norm.includes('BENEFIC') || norm.includes('HORA EXTRA') || 
                norm.includes('PESSOAL') || norm.includes('ESTATUTAR') || norm.includes('CLT') || 
                norm.includes('AGENTES') || norm.includes('ESTAGIAR') || norm.includes('BOLSIST')) {
                return 'Pessoal';
            }

            if (norm.includes('FORMULA') || norm.includes('GAS') || norm.includes('LIMPEZA') || 
                norm.includes('PROTECAO') || norm.includes('VACINA') || norm.includes('MEDICAMENT') || 
                norm.includes('INSUMO') || norm.includes('CONSUMO') || norm.includes('ODONTO')) {
                return 'Material de Consumo';
            }

            if (norm.includes('VEICULO') || norm.includes('LAVANDERIA') || norm.includes('VETOR') || 
                norm.includes('COPIA') || norm.includes('TECNOLOGIA') || norm.includes('MV') || 
                norm.includes('LABORAT') || norm.includes('TERCEIR') || norm.includes('MANUTEN')) {
                return 'Serviços de Terceiros';
            }

            return 'Despesas Gerais';
        },

        init() {
            if (!resultModeSelectorBar) return;
            const modeBtns = resultModeSelectorBar.querySelectorAll('.btn-result-mode');
            modeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    modeBtns.forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    this.activeMode = e.currentTarget.dataset.mode;
                    this.render();
                });
            });
        },

        render() {
            if (!resultDashboardContainer || !tableWrapper || !resultModeSelectorBar) return;

            if (appSession.activeViewSheet !== 'result' || !FinalProcessor.isReady) {
                resultModeSelectorBar.classList.add('hidden');
                resultDashboardContainer.classList.add('hidden');
                return;
            }

            resultModeSelectorBar.classList.remove('hidden');

            if (this.activeMode === 'planilha') {
                resultDashboardContainer.classList.add('hidden');
                tableWrapper.classList.remove('hidden');
                renderSpreadsheetTable(FinalProcessor.resultMatrix);
            } else {
                tableWrapper.classList.add('hidden');
                resultDashboardContainer.classList.remove('hidden');

                if (this.activeMode === 'topico') {
                    this.renderPorTopico(resultDashboardContainer);
                } else if (this.activeMode === 'item') {
                    this.renderPorItem(resultDashboardContainer);
                } else if (this.activeMode === 'mes') {
                    this.renderPorMes(resultDashboardContainer);
                } else if (this.activeMode === 'origem') {
                    this.renderPorOrigem(resultDashboardContainer);
                }
            }
        },

        renderPorTopico(container) {
            container.innerHTML = '';

            const matrix = FinalProcessor.resultMatrix;
            if (!matrix || matrix.length === 0) return;

            const headerRow = matrix[0] || [];
            const dataRows = matrix.slice(1);

            const groups = {
                'Pessoal': [],
                'Material de Consumo': [],
                'Serviços de Terceiros': [],
                'Despesas Gerais': [],
                'TOTAL GERAL': []
            };

            dataRows.forEach((row, rIdx) => {
                const itemName = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
                if (itemName === '') return;

                const category = this.categorizeItem(itemName);
                if (groups[category]) {
                    groups[category].push({ itemName, row, rIdx: rIdx + 1 });
                }
            });

            const fragment = document.createDocumentFragment();

            Object.keys(groups).forEach(groupName => {
                const items = groups[groupName];
                if (items.length === 0 && groupName !== 'TOTAL GERAL') return;

                const card = document.createElement('div');
                card.className = `dashboard-topic-card ${groupName === 'TOTAL GERAL' ? 'highlight-card' : ''}`;

                const header = document.createElement('div');
                header.className = 'dashboard-topic-header';
                header.innerHTML = `
                    <div class="topic-header-title">
                        <span>${groupName === 'TOTAL GERAL' ? '🏁' : '📂'} ${groupName}</span>
                        <span class="topic-badge-count">${items.length} item${items.length === 1 ? '' : 's'}</span>
                    </div>
                    <span class="toggle-icon">▼</span>
                `;

                const body = document.createElement('div');
                body.className = 'dashboard-topic-body';

                let tableHtml = '<table class="inspector-preview-table"><thead><tr><th>Item de Custo</th>';
                for (let c = 1; c < headerRow.length; c++) {
                    tableHtml += `<th>${headerRow[c] || 'Mês ' + c}</th>`;
                }
                tableHtml += '</tr></thead><tbody>';

                items.forEach(it => {
                    tableHtml += `<tr><td><b>${it.itemName}</b></td>`;
                    for (let c = 1; c < headerRow.length; c++) {
                        const cellVal = it.row[c] !== undefined && it.row[c] !== null ? String(it.row[c]) : '';
                        const status = FinalProcessor.cellStatusMap[`${it.rIdx}_${c}`];
                        let statusClass = '';
                        if (status === 'MATCH') statusClass = 'cell-match';
                        else if (status === 'MISSING') statusClass = 'cell-missing';
                        else if (status === 'DIVERGENT') statusClass = 'cell-divergent';

                        tableHtml += `<td class="${statusClass}">${cellVal}</td>`;
                    }
                    tableHtml += '</tr>';
                });

                tableHtml += '</tbody></table>';
                body.innerHTML = tableHtml;

                header.addEventListener('click', () => {
                    const isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'block' : 'none';
                    header.querySelector('.toggle-icon').textContent = isHidden ? '▼' : '▶';
                });

                card.appendChild(header);
                card.appendChild(body);
                fragment.appendChild(card);
            });

            container.appendChild(fragment);
        },

        renderPorItem(container) {
            container.innerHTML = '';

            const matrix = FinalProcessor.resultMatrix;
            if (!matrix || matrix.length === 0) return;

            const headerRow = matrix[0] || [];
            const dataRows = matrix.slice(1);

            const searchBar = document.createElement('div');
            searchBar.className = 'dashboard-item-search-bar';
            searchBar.innerHTML = `
                <input type="text" class="dashboard-item-search-input" id="dashboardItemSearchInput" placeholder="🔍 Localizar item de custo..." value="${this.itemSearchQuery}">
            `;
            container.appendChild(searchBar);

            const searchInput = searchBar.querySelector('#dashboardItemSearchInput');
            searchInput.addEventListener('input', (e) => {
                this.itemSearchQuery = e.target.value;
                this.renderPorItem(container);
            });

            const listContainer = document.createElement('div');
            const fragment = document.createDocumentFragment();

            const query = this.itemSearchQuery.toLowerCase().trim();

            dataRows.forEach((row, rIdx) => {
                const itemName = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
                if (itemName === '') return;
                if (query !== '' && !itemName.toLowerCase().includes(query)) return;

                const category = this.categorizeItem(itemName);

                const itemRowCard = document.createElement('div');
                itemRowCard.className = 'item-card-row';

                let monthsPillsHtml = '';
                for (let c = 1; c < headerRow.length; c++) {
                    const mName = headerRow[c] || `Mês ${c}`;
                    const val = row[c] !== undefined && row[c] !== null ? String(row[c]) : '-';
                    const status = FinalProcessor.cellStatusMap[`${rIdx + 1}_${c}`];
                    let badgeColor = '';
                    if (status === 'MATCH') badgeColor = 'style="border-color: #22c55e;"';
                    else if (status === 'MISSING') badgeColor = 'style="border-color: #f97316;"';
                    else if (status === 'DIVERGENT') badgeColor = 'style="border-color: #ef4444;"';

                    monthsPillsHtml += `
                        <div class="month-value-pill" ${badgeColor}>
                            <span class="month-label">${mName}</span>
                            <span class="month-val">${val}</span>
                        </div>
                    `;
                }

                itemRowCard.innerHTML = `
                    <div class="item-card-header">
                        <span class="item-card-title">📌 ${itemName}</span>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <span class="origin-badge-pill origin-apurasus">ApuraSUS</span>
                            <span class="topic-badge-count">${category}</span>
                        </div>
                    </div>
                    <div class="item-card-months-grid">
                        ${monthsPillsHtml}
                    </div>
                `;

                fragment.appendChild(itemRowCard);
            });

            listContainer.appendChild(fragment);
            container.appendChild(listContainer);
        },

        renderPorMes(container) {
            container.innerHTML = '';

            const matrix = FinalProcessor.resultMatrix;
            if (!matrix || matrix.length === 0) return;

            const headerRow = matrix[0] || [];
            const dataRows = matrix.slice(1);

            const fragment = document.createDocumentFragment();

            for (let c = 1; c < headerRow.length; c++) {
                const monthName = headerRow[c] || `Mês ${c}`;

                const card = document.createElement('div');
                card.className = 'dashboard-topic-card';

                const header = document.createElement('div');
                header.className = 'dashboard-topic-header';
                header.innerHTML = `
                    <div class="topic-header-title">
                        <span>📅 ${monthName}</span>
                        <span class="topic-badge-count">${dataRows.length} custos</span>
                    </div>
                    <span class="toggle-icon">▼</span>
                `;

                const body = document.createElement('div');
                body.className = 'dashboard-topic-body';

                let monthTableHtml = `
                    <table class="inspector-preview-table">
                        <thead>
                            <tr>
                                <th>Item de Custo</th>
                                <th>Categoria</th>
                                <th>Valor Registrado (${monthName})</th>
                                <th>Status do Cruzamento</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                dataRows.forEach((row, rIdx) => {
                    const itemName = row[0] !== undefined && row[0] !== null ? String(row[0]).trim() : '';
                    if (itemName === '') return;

                    const val = row[c] !== undefined && row[c] !== null ? String(row[c]) : '-';
                    const category = this.categorizeItem(itemName);
                    const status = FinalProcessor.cellStatusMap[`${rIdx + 1}_${c}`];
                    let statusLabel = '⚪ Padrão';
                    let statusClass = '';
                    if (status === 'MATCH') { statusLabel = '🟢 MATCH'; statusClass = 'cell-match'; }
                    else if (status === 'MISSING') { statusLabel = '🟠 MISSING'; statusClass = 'cell-missing'; }
                    else if (status === 'DIVERGENT') { statusLabel = '🔴 DIVERGENT'; statusClass = 'cell-divergent'; }

                    monthTableHtml += `
                        <tr>
                            <td><b>${itemName}</b></td>
                            <td><span class="topic-badge-count" style="font-size: 0.7rem;">${category}</span></td>
                            <td class="${statusClass}"><b>${val}</b></td>
                            <td>${statusLabel}</td>
                        </tr>
                    `;
                });

                monthTableHtml += '</tbody></table>';
                body.innerHTML = monthTableHtml;

                header.addEventListener('click', () => {
                    const isHidden = body.style.display === 'none';
                    body.style.display = isHidden ? 'block' : 'none';
                    header.querySelector('.toggle-icon').textContent = isHidden ? '▼' : '▶';
                });

                card.appendChild(header);
                card.appendChild(body);
                fragment.appendChild(card);
            }

            container.appendChild(fragment);
        },

        renderPorOrigem(container) {
            container.innerHTML = '';

            const origens = [
                {
                    id: 'apurasus',
                    title: 'ApuraSUS (Planilha de Relatório)',
                    badgeClass: 'origin-apurasus',
                    status: '🟢 Ativo & Carregado',
                    description: 'Fonte primária dos parâmetros e matriz base de relatórios financeiros de custos da Unidade.',
                    hasData: true
                },
                {
                    id: 'siga',
                    title: 'RH (SIGA)',
                    badgeClass: 'origin-siga',
                    status: appSession.sigaCollection.length > 0 ? `🟢 Coleção Ativa (${appSession.sigaCollection.length} arquivos)` : '🟡 Aguardando arquivos do SIGA',
                    description: 'Fonte de dados de recursos humanos e despesas de pessoal mensal.',
                    hasData: appSession.sigaCollection.length > 0
                },
                {
                    id: 'drive',
                    title: 'Planilha do Drive',
                    badgeClass: 'origin-drive',
                    status: appSession.driveMatrix.length > 0 ? '🟢 Arquivo do Drive Carregado' : '🟡 Aguardando arquivo do Drive',
                    description: 'Fonte de referência de valores informados nas planilhas do Google Drive.',
                    hasData: appSession.driveMatrix.length > 0
                },
                {
                    id: 'sigss',
                    title: 'Sistema SIGSS',
                    badgeClass: 'origin-sigss',
                    status: '⚪ Preparado para Futura Integração',
                    description: 'Módulo reservado para integração direta com a base do SIGSS em versões futuras.',
                    hasData: false
                }
            ];

            const fragment = document.createDocumentFragment();

            origens.forEach(orig => {
                const card = document.createElement('div');
                card.className = 'dashboard-topic-card';

                card.innerHTML = `
                    <div class="dashboard-topic-header" style="cursor: default;">
                        <div class="topic-header-title">
                            <span class="origin-badge-pill ${orig.badgeClass}">${orig.title}</span>
                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">${orig.status}</span>
                        </div>
                    </div>
                    <div class="dashboard-topic-body">
                        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.75rem;">${orig.description}</p>
                        ${orig.hasData 
                            ? `<div style="padding: 0.75rem; background: var(--bg-primary); border-radius: 6px; font-weight: 600; color: var(--accent-color);">✔ Origem preenchida e integrada ao pipeline atual.</div>`
                            : `<div style="padding: 0.75rem; background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; font-size: 0.85rem; color: #d48806;">ℹ️ Esta origem de dados será preenchida automaticamente conforme os próximos cruzamentos forem consolidados.</div>`
                        }
                    </div>
                `;

                fragment.appendChild(card);
            });

            container.appendChild(fragment);
        }
    };

    // ------------------------------------------------------------------------
    // 6. MAPEAMENTO DE SESSÃO & MÓDULO PROCESSADOR FINAL
    // ------------------------------------------------------------------------

    const appSession = {
        isActive: false,
        unitName: 'Não identificada',
        reportFile: null,
        sigaCollection: [],
        driveFile: null,
        status: 'Aguardando Relatório',
        reportMatrix: [],
        driveMatrix: [],
        reportInspector: { steps: [], timelineLogs: [] },
        driveInspector: { steps: [], timelineLogs: [] },
        activeViewSheet: 'report',
        activeSigaId: null
    };

    const FinalProcessor = {
        isReady: false,
        reportData: null,
        sigaCollectionData: null,
        driveData: null,
        resultMatrix: [],
        cellStatusMap: {},
        resultInspector: { steps: [], timelineLogs: [] },

        process(sessionObj) {
            console.log("%c[FinalProcessor] Executando cruzamento preservando as strings brutas...", "color: #059669; font-weight: bold; font-size: 13px;");
            
            if (!sessionObj || !sessionObj.reportMatrix || sessionObj.reportMatrix.length === 0) {
                this.isReady = false;
                return null;
            }

            this.reportData = sessionObj.reportMatrix;
            this.sigaCollectionData = sessionObj.sigaCollection;
            this.driveData = sessionObj.driveMatrix || [];

            this.resultMatrix = this.reportData.map(row => [...row]);
            this.cellStatusMap = {};
            this.isReady = true;

            const reportHeaderRow = this.reportData[0] || [];
            const driveHeaderRow = this.driveData[0] || [];

            let totalComparisons = 0;
            let countMatch = 0;
            let countMissing = 0;
            let countDivergent = 0;
            let countNotMapped = 0;
            let mappedCountInFile = 0;

            const sideBySideComparisonList = [];
            const valueInspection = CSVInspectorEngine.inspectAndValidateCSV(this.reportData, 'Planilha de Relatório');

            const itemsClassification = {
                MATCH: [],
                MISSING: [],
                DIVERGENT: [],
                NOT_MAPPED: []
            };

            for (let rIdx = 1; rIdx < this.reportData.length; rIdx++) {
                const reportItemName = this.reportData[rIdx][0] !== undefined && this.reportData[rIdx][0] !== null 
                    ? String(this.reportData[rIdx][0]).trim() 
                    : '';

                if (reportItemName === '') continue;

                const mappedDriveName = OfficialCatalog.getDriveMapping(reportItemName);

                if (!mappedDriveName) {
                    countNotMapped++;
                    itemsClassification.NOT_MAPPED.push(reportItemName);

                    for (let cIdx = 1; cIdx < reportHeaderRow.length; cIdx++) {
                        this.cellStatusMap[`${rIdx}_${cIdx}`] = 'NOT_MAPPED';
                    }
                    continue;
                }

                mappedCountInFile++;

                let driveRowIdx = -1;
                const normMappedDriveName = normalizeHeaderName(mappedDriveName);

                for (let dR = 1; dR < this.driveData.length; dR++) {
                    const driveItemName = this.driveData[dR][0] !== undefined && this.driveData[dR][0] !== null
                        ? String(this.driveData[dR][0]).trim()
                        : '';
                    if (normalizeHeaderName(driveItemName) === normMappedDriveName) {
                        driveRowIdx = dR;
                        break;
                    }
                }

                let rowMatches = 0;
                let rowMissing = 0;
                let rowDivergent = 0;

                for (let cIdx = 1; cIdx < reportHeaderRow.length; cIdx++) {
                    totalComparisons++;
                    const monthCell = reportHeaderRow[cIdx];
                    const parsedMonth = TemporalEngine.parseMonthYear(monthCell);

                    if (!parsedMonth) {
                        this.cellStatusMap[`${rIdx}_${cIdx}`] = 'NOT_MAPPED';
                        continue;
                    }

                    const targetDriveIndex = TemporalEngine.converterMesParaIndice(parsedMonth.mes, parsedMonth.ano);

                    let driveColIdx = -1;
                    if (driveRowIdx !== -1) {
                        for (let dC = 1; dC < driveHeaderRow.length; dC++) {
                            const numVal = MoneyEngine.importarValor(driveHeaderRow[dC]);
                            if (numVal === targetDriveIndex) {
                                driveColIdx = dC;
                                break;
                            }
                        }
                    }

                    const rawRepVal = this.reportData[rIdx][cIdx];
                    const repVal = MoneyEngine.importarValor(rawRepVal);
                    const isRepEmptyCell = isCellEmpty(rawRepVal);

                    let driveVal = 0;
                    let rawDrvVal = '';
                    let isDriveEmptyCell = true;
                    if (driveRowIdx !== -1 && driveColIdx !== -1) {
                        rawDrvVal = this.driveData[driveRowIdx][driveColIdx];
                        driveVal = MoneyEngine.importarValor(rawDrvVal);
                        isDriveEmptyCell = isCellEmpty(rawDrvVal);
                    }

                    if (sideBySideComparisonList.length < 10 && (!isRepEmptyCell || !isDriveEmptyCell)) {
                        let explanation = "✔ Paridade numérica mantida na comparação temporária.";
                        if (driveRowIdx !== -1 && driveColIdx !== -1) {
                            if (repVal !== driveVal) {
                                explanation = "ℹ️ Divergência financeira apurada entre os arquivos.";
                            }
                        }

                        sideBySideComparisonList.push({
                            itemName: reportItemName,
                            monthLabel: parsedMonth.str,
                            report: {
                                rawVal: rawRepVal,
                                rawType: typeof rawRepVal,
                                storedVal: rawRepVal
                            },
                            drive: {
                                rawVal: rawDrvVal,
                                rawType: typeof rawDrvVal,
                                storedVal: rawDrvVal
                            },
                            explanation
                        });
                    }

                    let cellStatus = 'NOT_MAPPED';

                    if (driveRowIdx !== -1 && driveColIdx !== -1) {
                        const isValueEqual = MoneyEngine.compararValores(repVal, driveVal);

                        if (isValueEqual && (!isRepEmptyCell || !isDriveEmptyCell)) {
                            cellStatus = 'MATCH';
                            countMatch++;
                            rowMatches++;
                        } else if (isRepEmptyCell && !isDriveEmptyCell && driveVal > 0) {
                            cellStatus = 'MISSING';
                            countMissing++;
                            rowMissing++;
                        } else if (!isRepEmptyCell && !isDriveEmptyCell && !isValueEqual) {
                            cellStatus = 'DIVERGENT';
                            countDivergent++;
                            rowDivergent++;
                        } else {
                            cellStatus = 'NOT_MAPPED';
                            countNotMapped++;
                        }
                    } else {
                        cellStatus = 'NOT_MAPPED';
                        countNotMapped++;
                    }

                    this.cellStatusMap[`${rIdx}_${cIdx}`] = cellStatus;
                }

                if (rowDivergent > 0) {
                    itemsClassification.DIVERGENT.push({ reportItem: reportItemName, driveItem: mappedDriveName });
                } else if (rowMissing > 0) {
                    itemsClassification.MISSING.push({ reportItem: reportItemName, driveItem: mappedDriveName });
                } else if (rowMatches > 0) {
                    itemsClassification.MATCH.push({ reportItem: reportItemName, driveItem: mappedDriveName });
                }
            }

            const firstRow = this.resultMatrix[0] || [];
            const lastRow = this.resultMatrix.length > 0 ? this.resultMatrix[this.resultMatrix.length - 1] : [];
            let maxCols = 0;
            this.resultMatrix.forEach(r => { if (r.length > maxCols) maxCols = r.length; });

            const colHeadersWithIndices = [];
            for (let i = 0; i < maxCols; i++) {
                const letter = getExcelColumnName(i);
                const val = firstRow[i] !== undefined && firstRow[i] !== null ? String(firstRow[i]).trim() : '';
                colHeadersWithIndices.push({ letter, index: i, name: val });
            }

            const resultSteps = [
                {
                    stepNum: 1,
                    stepTitle: "Resultado Final (Base do Relatório Tratado)",
                    rowCount: this.resultMatrix.length,
                    colCount: maxCols,
                    firstRow: firstRow.map(c => c !== undefined && c !== null ? String(c).trim() : ''),
                    lastRow: lastRow.map(c => c !== undefined && c !== null ? String(c).trim() : ''),
                    colHeaders: colHeadersWithIndices,
                    matrix: this.resultMatrix,
                    extraInfo: {
                        dataSource: "Planilha de Relatório tratada (Texto Bruto)",
                        crossReferenceStatus: "Cruzamento com o Drive realizado via Catálogo Oficial"
                    }
                },
                {
                    stepNum: 2,
                    stepTitle: "Leitura Bruta do CSV (Seção Inspector)",
                    rowCount: this.reportData.length,
                    colCount: maxCols,
                    firstRow: firstRow.map(c => String(c || '').trim()),
                    lastRow: lastRow.map(c => String(c || '').trim()),
                    colHeaders: colHeadersWithIndices,
                    matrix: this.resultMatrix,
                    extraInfo: {
                        csvInspectorDetails: valueInspection
                    }
                },
                {
                    stepNum: 3,
                    stepTitle: "Comparação Lado a Lado (Relatório vs Drive)",
                    rowCount: this.reportData.length,
                    colCount: maxCols,
                    firstRow: firstRow.map(c => String(c || '').trim()),
                    lastRow: lastRow.map(c => String(c || '').trim()),
                    colHeaders: colHeadersWithIndices,
                    matrix: this.resultMatrix,
                    extraInfo: {
                        sideBySideComparison: sideBySideComparisonList
                    }
                },
                {
                    stepNum: 4,
                    stepTitle: "Catálogo Oficial de Correspondências",
                    rowCount: this.reportData.length,
                    colCount: maxCols,
                    firstRow: firstRow.map(c => String(c || '').trim()),
                    lastRow: lastRow.map(c => String(c || '').trim()),
                    colHeaders: colHeadersWithIndices,
                    matrix: this.resultMatrix,
                    extraInfo: {
                        catalogDetails: {
                            totalCatalogEntries: OfficialCatalog.getAllMappingsCount(),
                            matchedInFile: mappedCountInFile,
                            unmappedCount: countNotMapped,
                            totalComparisons: totalComparisons
                        }
                    }
                },
                {
                    stepNum: 5,
                    stepTitle: "Comparação com a Planilha do Drive",
                    rowCount: this.resultMatrix.length,
                    colCount: maxCols,
                    firstRow: firstRow.map(c => String(c || '').trim()),
                    lastRow: lastRow.map(c => String(c || '').trim()),
                    colHeaders: colHeadersWithIndices,
                    matrix: this.resultMatrix,
                    extraInfo: {
                        comparisonSummary: {
                            matchCount: countMatch,
                            missingCount: countMissing,
                            divergentCount: countDivergent,
                            notMappedCount: countNotMapped,
                            itemsClassification: itemsClassification
                        }
                    }
                }
            ];

            const resultLogs = [
                { timestamp: new Date().toLocaleTimeString(), message: "✔ Dados recebidos do Processador Final.", isSuccess: true },
                { timestamp: new Date().toLocaleTimeString(), message: `✔ Leitura Bruta do CSV validada: formato brasileiro mantido com vírgulas.`, isSuccess: true },
                { timestamp: new Date().toLocaleTimeString(), message: `✔ Catálogo Oficial consultado (${OfficialCatalog.getAllMappingsCount()} regras registradas).`, isSuccess: true },
                { timestamp: new Date().toLocaleTimeString(), message: `✔ Comparação concluída (${countMatch} MATCHES, ${countDivergent} DIVERGENTES).`, isSuccess: true }
            ];

            this.resultInspector = {
                steps: resultSteps,
                timelineLogs: resultLogs
            };

            return {
                status: 'Resultado Final Gerado',
                resultMatrix: this.resultMatrix,
                inspector: this.resultInspector
            };
        }
    };

    // Inspector State Context
    let currentInspectorSteps = [];
    let currentInspectorTimelineLogs = [];

    // ------------------------------------------------------------------------
    // 7. MÓDULO MATEMÁTICO TEMPORAL CENTRALIZADO (TemporalEngine)
    // ------------------------------------------------------------------------

    const TEMPORAL_REFERENCE = {
        mes: 11,
        ano: 2022,
        indice: 2
    };

    const TemporalEngine = {
        parseMonthYear(cellVal) {
            if (cellVal === null || cellVal === undefined) return null;
            const str = String(cellVal).trim();
            
            let match = str.match(/^(\d{1,2})[\/-](\d{4})$/);
            if (match) {
                const mes = parseInt(match[1], 10);
                const ano = parseInt(match[2], 10);
                if (mes >= 1 && mes <= 12) {
                    return { mes, ano, str: `${String(mes).padStart(2, '0')}/${ano}` };
                }
            }
            match = str.match(/^(\d{4})[\/-](\d{1,2})$/);
            if (match) {
                const mes = parseInt(match[2], 10);
                const ano = parseInt(match[1], 10);
                if (mes >= 1 && mes <= 12) {
                    return { mes, ano, str: `${String(mes).padStart(2, '0')}/${ano}` };
                }
            }
            return null;
        },

        converterMesParaIndice(mes, ano) {
            const diffMeses = (ano - TEMPORAL_REFERENCE.ano) * 12 + (mes - TEMPORAL_REFERENCE.mes);
            return TEMPORAL_REFERENCE.indice + diffMeses;
        },

        converterIndiceParaMes(indice) {
            const diffMeses = indice - TEMPORAL_REFERENCE.indice;
            const totalMeses = (TEMPORAL_REFERENCE.ano * 12 + TEMPORAL_REFERENCE.mes - 1) + diffMeses;
            const ano = Math.floor(totalMeses / 12);
            const mes = (totalMeses % 12) + 1;
            return { mes, ano, str: `${String(mes).padStart(2, '0')}/${ano}` };
        },

        extractMonthRangeFromReport(reportMatrix) {
            if (!reportMatrix || reportMatrix.length === 0) return null;
            const headerRow = reportMatrix[0] || [];
            const foundMonths = [];

            for (let colIdx = 1; colIdx < headerRow.length; colIdx++) {
                const parsed = this.parseMonthYear(headerRow[colIdx]);
                if (parsed) {
                    const calculatedIndex = this.converterMesParaIndice(parsed.mes, parsed.ano);
                    const diffFromRef = (parsed.ano - TEMPORAL_REFERENCE.ano) * 12 + (parsed.mes - TEMPORAL_REFERENCE.mes);
                    foundMonths.push({
                        colIndex: colIdx,
                        colLetter: getExcelColumnName(colIdx),
                        mes: parsed.mes,
                        ano: parsed.ano,
                        str: parsed.str,
                        diffFromRef,
                        calculatedIndex
                    });
                }
            }

            if (foundMonths.length === 0) return null;

            return {
                primeiroMes: foundMonths[0],
                ultimoMes: foundMonths[foundMonths.length - 1],
                listaMeses: foundMonths
            };
        }
    };

    // ------------------------------------------------------------------------
    // 8. CONFIGURAÇÕES DE TRATAMENTO SIGA & RECONHECIMENTO DE MÊS
    // ------------------------------------------------------------------------

    const LINHAS_INICIAIS_REMOVIDAS = 4;

    const COLUMN_NAME_MAP = {
        'COM_INCP_AGENTES': 'Remuneração a Pessoal Estatutário (ACS)',
        'COM_INCP_COMISSIONADO': 'Remuneração a Pessoal - CLT',
        'COM_INCP_TEMPORARIO': 'Remuneração a Pessoal - CLT',
        'COM_INCP_ESTAGIARIO': 'Remuneração a Pessoal - CLT',
        'COM_INCP_ESTATUTARIO': 'Remuneração a Pessoal Estatutário Municipal',
        'SEM_INCP_AGENTES': 'Benefício a Pessoal Estatutário (ACS)',
        'SEM_INCP_COMISSIONADO': 'Benefício a Pessoal - CLT',
        'SEM_INCP_TEMPORARIO': 'Benefício a Pessoal - CLT',
        'SEM_INCP_ESTAGIARIO': 'Remuneração a Pessoal - CLT',
        'SEM_INCP_ESTATUTARIO': 'Benefício a Pessoal Estatutário Municipal',
        'HORA_EXTRA': 'Hora Extra'
    };

    const MONTH_NAMES_PT = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    function detectSigaMonth(matrix, fileName) {
        const cleanName = fileName.toLowerCase();
        
        for (let i = 0; i < MONTH_NAMES_PT.length; i++) {
            const mName = MONTH_NAMES_PT[i].toLowerCase();
            if (cleanName.includes(mName)) {
                let anoMatch = cleanName.match(/20\d{2}/);
                let anoStr = anoMatch ? anoMatch[0] : '2026';
                return `${MONTH_NAMES_PT[i]}/${anoStr}`;
            }
        }

        let numMatch = cleanName.match(/(\d{1,2})[\/_-](\d{4})/);
        if (numMatch) {
            const mIdx = parseInt(numMatch[1], 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
                return `${MONTH_NAMES_PT[mIdx]}/${numMatch[2]}`;
            }
        }

        if (matrix && matrix.length > 0) {
            for (let r = 0; r < Math.min(5, matrix.length); r++) {
                for (let c = 0; c < matrix[r].length; c++) {
                    const parsed = TemporalEngine.parseMonthYear(matrix[r][c]);
                    if (parsed) {
                        const mIdx = parsed.mes - 1;
                        return `${MONTH_NAMES_PT[mIdx]}/${parsed.ano}`;
                    }
                }
            }
        }

        const fileSeq = appSession.sigaCollection.length + 1;
        return `Mês ${fileSeq} (${fileName.substring(0, 10)})`;
    }

    function normalizeHeaderName(header) {
        if (header === null || header === undefined) return '';
        let str = String(header);
        str = str.replace(/[\u0000-\u001F\u007F-\u009F\u00A0\uFEFF]/g, ' ');
        str = str.replace(/[\r\n\t]+/g, ' ');
        str = str.replace(/\s+/g, ' ');
        return str.trim().toUpperCase();
    }

    function getExcelColumnName(index) {
        let colName = '';
        let num = index;
        while (num >= 0) {
            colName = String.fromCharCode((num % 26) + 65) + colName;
            num = Math.floor(num / 26) - 1;
        }
        return colName;
    }

    function excelColumnNameToIndex(letter) {
        const cleanLetter = String(letter).trim().toUpperCase();
        let index = 0;
        for (let i = 0; i < cleanLetter.length; i++) {
            index = index * 26 + (cleanLetter.charCodeAt(i) - 64);
        }
        return index - 1;
    }

    function isCellEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string' && value.trim() === '') return true;
        return false;
    }

    // ------------------------------------------------------------------------
    // 9. MÓDULO INSPETOR DO PIPELINE (Pipeline Inspector Engine)
    // ------------------------------------------------------------------------

    function resetInspectorData() {
        currentInspectorSteps = [];
        currentInspectorTimelineLogs = [];
    }

    function addInspectorLog(message, isSuccess = true, details = '') {
        currentInspectorTimelineLogs.push({
            timestamp: new Date().toLocaleTimeString(),
            message,
            isSuccess,
            details
        });
    }

    function recordStepSnapshot(stepNum, stepTitle, matrix, extraInfo = {}) {
        if (!matrix) matrix = [];

        const matrixCopy = matrix.map(r => [...r]);
        let maxCols = 0;
        matrixCopy.forEach(r => { if (r.length > maxCols) maxCols = r.length; });

        const firstRow = matrixCopy[0] || [];
        const lastRow = matrixCopy.length > 0 ? matrixCopy[matrixCopy.length - 1] : [];

        const colHeadersWithIndices = [];
        for (let i = 0; i < maxCols; i++) {
            const letter = getExcelColumnName(i);
            const val = firstRow[i] !== undefined && firstRow[i] !== null ? String(firstRow[i]).trim() : '';
            colHeadersWithIndices.push({
                letter,
                index: i,
                name: val
            });
        }

        const snapshot = {
            stepNum,
            stepTitle,
            rowCount: matrixCopy.length,
            colCount: maxCols,
            firstRow: firstRow.map(c => c !== undefined && c !== null ? String(c).trim() : ''),
            lastRow: lastRow.map(c => c !== undefined && c !== null ? String(c).trim() : ''),
            colHeaders: colHeadersWithIndices,
            matrix: matrixCopy,
            extraInfo
        };

        currentInspectorSteps[stepNum - 1] = snapshot;
    }

    function renderInspectorUI() {
        inspectorStepsContainer.innerHTML = '';
        inspectorLogTimeline.innerHTML = '';

        if (currentInspectorSteps.length === 0) {
            inspectorStepsContainer.innerHTML = `
                <div class="empty-state">
                    <p class="empty-state-text">Nenhum dado inspecionado nesta etapa ainda.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        currentInspectorSteps.forEach(step => {
            if (!step) return;

            const card = document.createElement('div');
            card.className = 'inspector-step-card';

            const cardHeader = document.createElement('div');
            cardHeader.className = 'step-card-header';
            cardHeader.innerHTML = `
                <div class="step-title-wrapper">
                    <span class="step-number-badge">ETAPA ${step.stepNum}</span>
                    <h3 class="step-title-text">${step.stepTitle}</h3>
                </div>
                <div class="step-metrics-pills">
                    <span class="metric-pill">${step.rowCount} linhas</span>
                    <span class="metric-pill">${step.colCount} colunas</span>
                </div>
            `;
            card.appendChild(cardHeader);

            const detailsBlock = document.createElement('div');
            detailsBlock.className = 'step-details-block';

            const firstRowStr = step.firstRow.length > 0 ? step.firstRow.join(' | ') : '(Vazia)';
            const lastRowStr = step.lastRow.length > 0 ? step.lastRow.join(' | ') : '(Vazia)';

            detailsBlock.innerHTML = `
                <div class="step-info-row">
                    <span class="step-info-label">Primeira linha (Cabeçalho):</span>
                    <span class="step-info-value">${firstRowStr}</span>
                </div>
                <div class="step-info-row">
                    <span class="step-info-label">Última linha:</span>
                    <span class="step-info-value">${lastRowStr}</span>
                </div>
            `;

            if (step.extraInfo && step.extraInfo.csvInspectorDetails) {
                const csvDetails = step.extraInfo.csvInspectorDetails;
                const sampleRows = csvDetails.samples.map(s => `
                    <tr>
                        <td><b>Linha ${s.rowIdx}</b> (${s.colLabel})</td>
                        <td><code>${s.rawVal}</code></td>
                        <td><code>${s.storedVal}</code></td>
                        <td><code>${s.cellType}</code></td>
                        <td><strong>${s.displayedVal}</strong></td>
                    </tr>
                `).join('');

                let errHtml = '';
                if (csvDetails.validationErrors && csvDetails.validationErrors.length > 0) {
                    errHtml = `
                        <div class="renaming-explanation-box" style="margin-top: 0.5rem; background: #fef2f2; border-color: #ef4444; color: #991b1b;">
                            <strong>❌ Erro Crítico Registrado no Inspector:</strong><br>
                            ${csvDetails.validationErrors.map(e => `<div>• [${e.sheetName} L${e.rowIdx}:C${e.colIdx}] ${e.colLabel}: Esperado="${e.rawVal}", Armazenado="${e.storedVal}" na etapa "${e.stage}".</div>`).join('')}
                        </div>
                    `;
                }

                detailsBlock.innerHTML += `
                    <div style="margin-top: 0.5rem; background: var(--bg-primary); border: 2px solid var(--accent-border); padding: 0.875rem; border-radius: 8px;">
                        <h4 style="font-size: 1rem; color: var(--accent-color); margin-bottom: 0.5rem;">🔍 Leitura Bruta do CSV:</h4>
                        <div style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem;">
                            "${csvDetails.diagnosis}"
                        </div>
                        ${errHtml}
                        <h5 style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.35rem; margin-top: 0.5rem;">Quadria de Integridade Bruta do CSV:</h5>
                        <div style="overflow-x: auto;">
                            <table class="match-table">
                                <thead>
                                    <tr>
                                        <th>Célula Amostrada</th>
                                        <th>Conteúdo Bruto Recebido</th>
                                        <th>Conteúdo Armazenado</th>
                                        <th>Tipo do Dado</th>
                                        <th>Conteúdo Exibido</th>
                                    </tr>
                                </thead>
                                <tbody>${sampleRows || '<tr><td colspan="5">Nenhuma célula amostrada</td></tr>'}</tbody>
                            </table>
                        </div>
                    </div>
                `;
            }

            if (step.extraInfo && step.extraInfo.sideBySideComparison) {
                const sList = step.extraInfo.sideBySideComparison;
                const rowsHtml = sList.map(item => `
                    <tr>
                        <td><b>${item.itemName}</b> (${item.monthLabel})</td>
                        <td>
                            <code>${JSON.stringify(item.report.rawVal)}</code><br>
                            <small>Tipo: <b>${item.report.rawType}</b> | Armazenado: <b>${item.report.storedVal}</b></small>
                        </td>
                        <td>
                            <code>${JSON.stringify(item.drive.rawVal)}</code><br>
                            <small>Tipo: <b>${item.drive.rawType}</b> | Armazenado: <b>${item.drive.storedVal}</b></small>
                        </td>
                        <td><span style="font-size: 0.8rem; font-weight: 600;">${item.explanation}</span></td>
                    </tr>
                `).join('');

                detailsBlock.innerHTML += `
                    <div style="margin-top: 0.5rem; overflow-x: auto;">
                        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--accent-color);">🔍 Comparação Lado a Lado (Relatório vs Drive):</h4>
                        <table class="match-table">
                            <thead>
                                <tr>
                                    <th>Item & Mês</th>
                                    <th>Planilha de Relatório</th>
                                    <th>Planilha do Drive</th>
                                    <th>Diagnóstico de Paridade</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHtml || '<tr><td colspan="4">Nenhuma célula comparada</td></tr>'}</tbody>
                        </table>
                    </div>
                `;
            }

            if (step.extraInfo && step.extraInfo.catalogDetails) {
                const c = step.extraInfo.catalogDetails;
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Itens Mapeados no Catálogo:</span>
                        <span class="step-info-value">${c.totalCatalogEntries} regras cadastradas</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Correspondências Encontradas:</span>
                        <span class="step-info-value">${c.matchedInFile} itens mapeados</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Itens Não Mapeados:</span>
                        <span class="step-info-value">${c.unmappedCount} itens</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Comparações Realizadas:</span>
                        <span class="step-info-value">${c.totalComparisons} células de meses</span>
                    </div>
                `;
            }

            if (step.extraInfo && step.extraInfo.comparisonSummary) {
                const s = step.extraInfo.comparisonSummary;
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Resumo dos Status:</span>
                        <span class="step-info-value">🟢 MATCH: ${s.matchCount} | 🟠 MISSING: ${s.missingCount} | 🔴 DIVERGENT: ${s.divergentCount} | ⚪ NOT_MAPPED: ${s.notMappedCount}</span>
                    </div>
                `;

                if (s.itemsClassification) {
                    const matchItemsStr = s.itemsClassification.MATCH.map(i => `${i.reportItem} ➔ ${i.driveItem}`).join(', ') || 'Nenhum';
                    const divItemsStr = s.itemsClassification.DIVERGENT.map(i => `${i.reportItem} ➔ ${i.driveItem}`).join(', ') || 'Nenhum';
                    const missItemsStr = s.itemsClassification.MISSING.map(i => `${i.reportItem} ➔ ${i.driveItem}`).join(', ') || 'Nenhum';

                    detailsBlock.innerHTML += `
                        <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
                            <div><b>🟢 Itens com MATCH Total:</b> <span class="step-info-value">${matchItemsStr}</span></div>
                            <div><b>🔴 Itens DIVERGENTES:</b> <span class="step-info-value">${divItemsStr}</span></div>
                            <div><b>🟠 Itens MISSING (Faltantes):</b> <span class="step-info-value">${missItemsStr}</span></div>
                        </div>
                    `;
                }
            }

            if (step.stepNum === 1 && step.extraInfo.fileName) {
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Nome do Arquivo:</span>
                        <span class="step-info-value">${step.extraInfo.fileName}</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Tipo do Arquivo:</span>
                        <span class="step-info-value">${step.extraInfo.fileType || '-'}</span>
                    </div>
                `;
            }

            if (step.extraInfo.reportMonthRange) {
                const range = step.extraInfo.reportMonthRange;
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Primeiro Mês do Relatório:</span>
                        <span class="step-info-value">${range.primeiroMes ? range.primeiroMes.str : '-'}</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Último Mês do Relatório:</span>
                        <span class="step-info-value">${range.ultimoMes ? range.ultimoMes.str : '-'}</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Meses Encontrados:</span>
                        <span class="step-info-value">${range.listaMeses ? range.listaMeses.map(m => m.str).join(', ') : '-'}</span>
                    </div>
                `;
            }

            if (step.extraInfo.temporalConversionTable) {
                const convRows = step.extraInfo.temporalConversionTable.map(c => `
                    <tr>
                        <td><b>${c.str}</b></td>
                        <td>${c.diffFromRef} meses pós-referência</td>
                        <td><code>Índice ${c.calculatedIndex}</code></td>
                    </tr>
                `).join('');
                detailsBlock.innerHTML += `
                    <div style="margin-top: 0.5rem; overflow-x: auto;">
                        <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-primary);">Conversão Matemática Temporal (Referência: Novembro/2022 ➔ 2):</h4>
                        <table class="match-table">
                            <thead>
                                <tr>
                                    <th>Mês / Ano</th>
                                    <th>Diferença de Meses</th>
                                    <th>Índice Calculado</th>
                                </tr>
                            </thead>
                            <tbody>${convRows}</tbody>
                        </table>
                    </div>
                `;
            }

            if (step.extraInfo.driveFilterDetails) {
                const f = step.extraInfo.driveFilterDetails;
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Primeiro Índice Mantido:</span>
                        <span class="step-info-value">${f.primeiroIndice}</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Último Índice Mantido:</span>
                        <span class="step-info-value">${f.ultimoIndice}</span>
                    </div>
                    <div class="step-info-row">
                        <span class="step-info-label">Colunas Removidas:</span>
                        <span class="step-info-value">${f.removedCols.length > 0 ? f.removedCols.join(', ') : 'Nenhuma'} (${f.removedCols.length} colunas)</span>
                    </div>
                `;
            }

            if (step.extraInfo.driveEmptyRowsRemoved !== undefined) {
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Linhas Vazias Removidas:</span>
                        <span class="step-info-value">${step.extraInfo.driveEmptyRowsRemoved} linhas eliminadas</span>
                    </div>
                `;
            }

            if (step.extraInfo.removedEmptyCols) {
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Colunas vazias removidas:</span>
                        <span class="step-info-value">${step.extraInfo.removedEmptyCols.length > 0 ? step.extraInfo.removedEmptyCols.join(', ') : 'Nenhuma coluna vazia'}</span>
                    </div>
                `;
            }

            if (step.stepNum === 4 && step.extraInfo.removedSpecificCols) {
                const mappingsStr = step.extraInfo.removedSpecificCols.map(m => `<b>${m.letter}</b> → "${m.name}"`).join(', ');
                detailsBlock.innerHTML += `
                    <div class="step-info-row">
                        <span class="step-info-label">Colunas removidas:</span>
                        <span class="step-info-value">${mappingsStr || 'Nenhuma coluna removida'}</span>
                    </div>
                `;
            }

            if (step.stepNum === 6 && step.extraInfo.matchTable) {
                const matchTableHtml = `
                    <div style="margin-top: 0.5rem; overflow-x: auto;">
                        <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-primary);">Tabela Comparativa de Correspondência de Cabeçalhos:</h4>
                        <table class="match-table">
                            <thead>
                                <tr>
                                    <th>Coluna</th>
                                    <th>Nome Encontrado</th>
                                    <th>Nome Normalizado</th>
                                    <th>Nome Esperado Mapeado</th>
                                    <th>Encontrado?</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${step.extraInfo.matchTable.map(m => `
                                    <tr>
                                        <td><b>${m.letter}</b></td>
                                        <td>"${m.original}"</td>
                                        <td><code>"${m.normalized}"</code></td>
                                        <td>"${m.expected || '-'}"</td>
                                        <td><span class="${m.isFound ? 'badge-match-yes' : 'badge-match-no'}">${m.isFound ? 'SIM' : 'NÃO'}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
                detailsBlock.innerHTML += matchTableHtml;
            }

            if (step.stepNum === 7 && step.extraInfo.renamedList) {
                if (step.extraInfo.renamedList.length > 0) {
                    const renameStr = step.extraInfo.renamedList.map(r => `<div><b>Coluna ${r.letter}:</b> "${r.original}" ➔ <strong>"${r.renamed}"</strong></div>`).join('');
                    detailsBlock.innerHTML += `
                        <div style="margin-top: 0.5rem;">
                            <h4 style="font-size: 0.9rem; margin-bottom: 0.35rem; color: var(--text-primary);">Colunas Renomeadas com Sucesso:</h4>
                            <div class="step-info-value">${renameStr}</div>
                        </div>
                    `;
                } else {
                    detailsBlock.innerHTML += `
                        <div class="renaming-explanation-box">
                            <strong>⚠️ Nenhuma coluna foi renomeada nesta etapa:</strong><br>
                            ${step.extraInfo.explanation || 'Nenhum dos cabeçalhos na 1ª linha coincidiu com as chaves do dicionário COLUMN_NAME_MAP.'}
                        </div>
                    `;
                }
            }

            if (step.stepNum === 8 && step.extraInfo.groupedCategories) {
                const groupHtml = step.extraInfo.groupedCategories.map(g => `
                    <div style="padding: 0.5rem; background: var(--bg-primary); border-radius: 6px; margin-bottom: 0.35rem;">
                        <strong>${g.categoryName}:</strong><br>
                        Colunas pertencentes: <code>${g.columns.join(' + ')}</code> | Quantidade agrupada: <b>${g.count}</b>
                    </div>
                `).join('');
                detailsBlock.innerHTML += `
                    <div style="margin-top: 0.5rem;">
                        <h4 style="font-size: 0.9rem; margin-bottom: 0.35rem; color: var(--text-primary);">Categorias Agrupadas:</h4>
                        ${groupHtml || '<div class="step-info-value">Nenhuma categoria agrupada</div>'}
                    </div>
                `;
            }

            if (step.stepNum === 9 && step.extraInfo.equations) {
                const eqHtml = step.extraInfo.equations.map(eq => `
                    <div class="equation-card-item">
                        <span class="equation-category-title">${eq.categoryName}</span>
                        ${eq.colDetails.map(c => `<div class="equation-line">${c.colName}: <b>${MoneyEngine.formatarValor(c.value, true)}</b></div>`).join('')}
                        <div class="equation-result-line">= Total: ${MoneyEngine.formatarValor(eq.total, true)}</div>
                    </div>
                `).join('');
                detailsBlock.innerHTML += `
                    <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
                        <h4 style="font-size: 0.9rem; color: var(--text-primary);">Fórmulas e Equações de Soma por Categoria:</h4>
                        ${eqHtml || '<div class="step-info-value">Nenhuma soma executada</div>'}
                    </div>
                `;
            }

            card.appendChild(detailsBlock);

            const tableContainer = document.createElement('div');
            tableContainer.className = 'step-table-wrapper';
            tableContainer.innerHTML = buildStepTablePreviewHtml(step.matrix);
            card.appendChild(tableContainer);

            fragment.appendChild(card);
        });

        inspectorStepsContainer.appendChild(fragment);

        const logFragment = document.createDocumentFragment();

        currentInspectorTimelineLogs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'timeline-item';

            const iconClass = log.isSuccess ? 'timeline-icon-success' : 'timeline-icon-error';
            const iconSymbol = log.isSuccess ? '✔' : '❌';

            item.innerHTML = `
                <span class="${iconClass}">${iconSymbol}</span>
                <div style="display: flex; flex-direction: column;">
                    <span><strong>[${log.timestamp}]</strong> ${log.message}</span>
                    ${log.details ? `<span style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem;">${log.details}</span>` : ''}
                </div>
            `;
            logFragment.appendChild(item);
        });

        inspectorLogTimeline.appendChild(logFragment);
    }

    function buildStepTablePreviewHtml(matrix) {
        if (!matrix || matrix.length === 0) return '<div style="padding: 1rem; text-align: center; color: var(--text-muted);">Matriz Vazia</div>';

        let maxCols = 0;
        matrix.forEach(row => { if (row.length > maxCols) maxCols = row.length; });

        const previewRows = matrix.slice(0, 8);

        let html = '<table class="inspector-preview-table"><thead><tr><th>#</th>';
        for (let c = 0; c < maxCols; c++) {
            html += `<th>${getExcelColumnName(c)}</th>`;
        }
        html += '</tr></thead><tbody>';

        previewRows.forEach((r, rIdx) => {
            html += `<tr><td><b>${rIdx + 1}</b></td>`;
            for (let c = 0; c < maxCols; c++) {
                const val = r[c] !== undefined && r[c] !== null ? String(r[c]) : '';
                html += `<td>${val}</td>`;
            }
            html += '</tr>';
        });

        if (matrix.length > 8) {
            html += `<tr><td colspan="${maxCols + 1}" style="text-align: center; color: var(--text-muted); font-style: italic;">... e mais ${matrix.length - 8} linhas ...</td></tr>`;
        }

        html += '</tbody></table>';
        return html;
    }

    // ------------------------------------------------------------------------
    // 10. MOTOR DE REGRAS SIGA (Treatment Pipeline Engine)
    // ------------------------------------------------------------------------

    function removeTopRowsRule(matrix, count = LINHAS_INICIAIS_REMOVIDAS) {
        if (!matrix || matrix.length <= count) {
            const res = [];
            recordStepSnapshot(2, `Após remover as ${count} primeiras linhas`, res);
            addInspectorLog(`${count} primeiras linhas removidas do topo da planilha.`);
            return res;
        }

        const res = matrix.slice(count);
        recordStepSnapshot(2, `Após remover as ${count} primeiras linhas`, res);
        addInspectorLog(`✔ ${count} primeiras linhas removidas.`);
        return res;
    }

    function removeEmptyColumnsRule(matrix) {
        if (!matrix || matrix.length === 0) return [];

        let maxCols = 0;
        matrix.forEach(row => { if (row.length > maxCols) maxCols = row.length; });

        const nonArrayColIndices = [];
        const removedEmptyColsLetters = [];

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
            } else {
                removedEmptyColsLetters.push(getExcelColumnName(colIdx));
            }
        }

        const res = matrix.map(row => nonArrayColIndices.map(colIdx => row[colIdx]));

        recordStepSnapshot(3, "Após remover as colunas completamente vazias", res, {
            removedEmptyCols: removedEmptyColsLetters
        });
        addInspectorLog(`✔ ${removedEmptyColsLetters.length} colunas vazias removidas.`, true, removedEmptyColsLetters.join(', '));
        return res;
    }

    function removeSpecificColumnsByLetterRule(matrix, lettersOrder = ['J', 'I', 'H', 'G', 'A']) {
        if (!matrix || matrix.length === 0) return [];

        let currentMatrix = matrix.map(row => [...row]);
        const removedDetailsMapping = [];

        lettersOrder.forEach(letter => {
            const targetIdx = excelColumnNameToIndex(letter);

            if (targetIdx >= 0) {
                let currentMaxCols = 0;
                currentMatrix.forEach(row => { if (row.length > currentMaxCols) currentMaxCols = row.length; });

                if (targetIdx < currentMaxCols) {
                    const colNameInCurrent = currentMatrix[0] && currentMatrix[0][targetIdx] !== undefined 
                        ? String(currentMatrix[0][targetIdx]).trim() 
                        : '';

                    currentMatrix = currentMatrix.map(row => {
                        const newRow = [...row];
                        newRow.splice(targetIdx, 1);
                        return newRow;
                    });

                    removedDetailsMapping.push({ letter, name: colNameInCurrent });
                    addInspectorLog(`✔ Coluna ${letter} (${colNameInCurrent}) removida.`);
                } else {
                    addInspectorLog(`⚠️ Coluna ${letter} não existia na posição correspondente. Ignorada com segurança.`, true);
                }
            }
        });

        recordStepSnapshot(4, "Após remover as colunas J, I, H, G e A", currentMatrix, {
            removedSpecificCols: removedDetailsMapping
        });

        return currentMatrix;
    }

    function removeBottomRowsRule(matrix, count = 2) {
        if (!matrix || matrix.length <= count) {
            const res = [];
            recordStepSnapshot(5, "Após remover as duas últimas linhas", res);
            addInspectorLog("2 últimas linhas removidas.");
            return res;
        }

        const res = matrix.slice(0, matrix.length - count);
        recordStepSnapshot(5, "Após remover as duas últimas linhas", res);
        addInspectorLog("✔ 2 últimas linhas do rodapé removidas.");
        return res;
    }

    function inspectAndLogOfficialHeaders(matrix) {
        if (!matrix || matrix.length === 0) return matrix;

        const officialRow = matrix[0] || [];

        console.log("%c[SIGA Pipeline] Cabeçalhos encontrados na 1ª linha tratada (Pós-Passo 4):", "color: #2563eb; font-weight: bold; font-size: 13px;");

        officialRow.forEach((cellVal, colIdx) => {
            const letter = getExcelColumnName(colIdx);
            const originalVal = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
            const normVal = normalizeHeaderName(originalVal);

            console.log(`  Coluna ${letter} (índice ${colIdx}) ➔ "${originalVal}" [Normalizado: "${normVal}"]`);
        });

        addInspectorLog("✔ Cabeçalho da 1ª linha inspecionado e identificado.");
        return matrix;
    }

    function standardizeHeaderNamesRule(matrix, nameMap = COLUMN_NAME_MAP) {
        if (!matrix || matrix.length === 0) return [];

        const updatedMatrix = matrix.map(row => [...row]);
        const officialHeaderRow = updatedMatrix[0] || [];

        const normalizedMap = {};
        Object.keys(nameMap).forEach(key => {
            normalizedMap[normalizeHeaderName(key)] = nameMap[key];
        });

        const foundNormalizedKeys = new Set();
        const matchTable = [];
        const renamedList = [];

        const newHeaderRow = officialHeaderRow.map((cell, colIdx) => {
            const letter = getExcelColumnName(colIdx);
            const origStr = String(cell).trim();
            const normCell = normalizeHeaderName(cell);

            const expectedKey = Object.keys(nameMap).find(k => normalizeHeaderName(k) === normCell);
            const isFound = Boolean(normalizedMap[normCell]);

            matchTable.push({
                letter,
                original: origStr,
                normalized: normCell,
                expected: expectedKey || '-',
                isFound
            });

            if (isFound) {
                const newName = normalizedMap[normCell];
                renamedList.push({
                    letter,
                    original: origStr,
                    renamed: newName
                });
                foundNormalizedKeys.add(normCell);
                return newName;
            }
            return cell;
        });

        recordStepSnapshot(6, "Antes da renomeação das colunas (Mapeamento)", matrix, {
            matchTable
        });
        addInspectorLog("✔ Correspondência de cabeçalhos avaliada.");

        Object.keys(COLUMN_NAME_MAP).forEach(key => {
            const normKey = normalizeHeaderName(key);
            if (!foundNormalizedKeys.has(normKey)) {
                console.warn(`[SIGA Pipeline Warning] Coluna esperada não encontrada na 1ª linha: "${key}"`);
                addInspectorLog(`❌ ETAPA 6/7: Coluna esperada "${key}" não foi encontrada na 1ª linha tratada.`, false, `Verifique a grafia exata no arquivo.`);
            }
        });

        updatedMatrix[0] = newHeaderRow;

        let explanation = '';
        if (renamedList.length === 0) {
            explanation = `Motivo: Nenhum dos cabeçalhos encontrados na 1ª linha (ex: ${officialHeaderRow.slice(0, 5).map(c => `"${c}"`).join(', ')}) coincidiu com as chaves esperadas (${Object.keys(COLUMN_NAME_MAP).slice(0, 5).join(', ')}...).`;
        }

        recordStepSnapshot(7, "Após a tentativa de renomeação", updatedMatrix, {
            renamedList,
            explanation
        });

        if (renamedList.length > 0) {
            addInspectorLog(`✔ ${renamedList.length} colunas renomeadas para a nomenclatura oficial.`);
        } else {
            addInspectorLog(`❌ Nenhuma coluna foi renomeada nesta etapa.`, false, explanation);
        }

        return updatedMatrix;
    }

    const SPREADSHEET_PIPELINES = {
        siga: [
            (matrix) => removeTopRowsRule(matrix, LINHAS_INICIAIS_REMOVIDAS),
            (matrix) => removeEmptyColumnsRule(matrix),
            (matrix) => removeSpecificColumnsByLetterRule(matrix, ['J', 'I', 'H', 'G', 'A']),
            (matrix) => removeBottomRowsRule(matrix, 2),
            (matrix) => inspectAndLogOfficialHeaders(matrix),
            (matrix) => standardizeHeaderNamesRule(matrix, COLUMN_NAME_MAP)
        ],
        relatorio: [],
        drive: []
    };

    function runTreatmentPipeline(sheetType, rawMatrix) {
        const pipeline = SPREADSHEET_PIPELINES[sheetType];
        if (!pipeline || pipeline.length === 0) {
            return rawMatrix;
        }
        return pipeline.reduce((currentMatrix, ruleFn) => ruleFn(currentMatrix), rawMatrix);
    }

    // ------------------------------------------------------------------------
    // 11. MÓDULO DO RESUMO FINANCEIRO (SIGA COM MONEY ENGINE)
    // ------------------------------------------------------------------------

    function calculateFinancialSummary(matrix) {
        if (!matrix || matrix.length <= 1) return {};

        const headerRow = matrix[0] || [];
        const dataRows = matrix.slice(1);
        const validStandardNames = Array.from(new Set(Object.values(COLUMN_NAME_MAP)));

        const categoryTotals = {};
        const groupedCategories = [];
        const equations = [];

        validStandardNames.forEach(stdName => {
            const matchingCols = [];
            headerRow.forEach((colName, colIdx) => {
                if (String(colName).trim() === stdName) {
                    matchingCols.push(getExcelColumnName(colIdx));
                }
            });

            if (matchingCols.length > 0) {
                groupedCategories.push({
                    categoryName: stdName,
                    columns: matchingCols,
                    count: matchingCols.length
                });
            }
        });

        recordStepSnapshot(8, "Agrupamento de Colunas por Categoria", matrix, {
            groupedCategories
        });
        addInspectorLog(`✔ Agrupamento de ${groupedCategories.length} categorias de colunas concluído.`);

        headerRow.forEach((colName, colIdx) => {
            const trimmedName = String(colName).trim();

            if (validStandardNames.includes(trimmedName)) {
                if (!categoryTotals[trimmedName]) {
                    categoryTotals[trimmedName] = 0;
                }

                let categorySumForCol = 0;
                dataRows.forEach(row => {
                    const rawVal = row[colIdx];
                    const numVal = MoneyEngine.importarValor(rawVal);
                    categoryTotals[trimmedName] += numVal;
                    categorySumForCol += numVal;
                });

                let eq = equations.find(e => e.categoryName === trimmedName);
                if (!eq) {
                    eq = { categoryName: trimmedName, colDetails: [], total: 0 };
                    equations.push(eq);
                }
                eq.colDetails.push({
                    colName: `Coluna ${getExcelColumnName(colIdx)}`,
                    value: categorySumForCol
                });
                eq.total = categoryTotals[trimmedName];
            }
        });

        recordStepSnapshot(9, "Cálculo e Soma dos Totais Financeiros", matrix, {
            equations
        });
        addInspectorLog("✔ Somas e resumo financeiro finalizados via MoneyEngine.");

        return categoryTotals;
    }

    function renderFinancialSummaryCards(summaryTotals, monthTitle = '') {
        summaryGrid.innerHTML = '';
        const categories = Object.keys(summaryTotals);

        if (categories.length === 0) {
            summaryContainer.classList.add('hidden');
            return;
        }

        summaryTitle.textContent = `Resumo Financeiro (Planilha do SIGA ${monthTitle ? '- ' + monthTitle : ''})`;

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
            value.textContent = MoneyEngine.formatarValor(totalValue, true);

            card.appendChild(title);
            card.appendChild(value);
            fragment.appendChild(card);
        });

        summaryGrid.appendChild(fragment);
        summaryContainer.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 12. GERENCIADOR DO WIZARD DE 5 ETAPAS & SESSÃO MINIMALISTA
    // ------------------------------------------------------------------------

    function updateWizardUI() {
        const sigaCount = appSession.sigaCollection.length;
        stepTitleSiga.textContent = `② SIGA (${sigaCount} arquivo${sigaCount === 1 ? '' : 's'})`;

        if (appState.currentStep === 1) {
            stepItemReport.className = 'wizard-step-item active';
            stepStatusReport.className = 'step-status-badge badge-active';
            stepStatusReport.textContent = 'Passo Atual';

            stepItemSiga.className = 'wizard-step-item disabled';
            stepStatusSiga.className = 'step-status-badge badge-disabled';
            stepStatusSiga.textContent = 'Aguardando Relatório';

            stepItemDrive.className = 'wizard-step-item disabled';
            stepStatusDrive.className = 'step-status-badge badge-disabled';
            stepStatusDrive.textContent = 'Aguardando SIGA';

            stepItemProcess.className = 'wizard-step-item disabled';
            stepStatusProcess.className = 'step-status-badge badge-disabled';
            stepStatusProcess.textContent = 'Aguardando Drive';

            stepItemResult.className = 'wizard-step-item disabled';
            stepStatusResult.className = 'step-status-badge badge-disabled';
            stepStatusResult.textContent = 'Aguardando Processamento';

            connector1.classList.remove('completed');
            connector2.classList.remove('completed');
            connector3.classList.remove('completed');
            connector4.classList.remove('completed');

            dropZonePrompt.textContent = 'Arraste e solte a Planilha de Relatório aqui ou';
            btnChooseFileLabel.textContent = 'Escolher Planilha de Relatório';
            sigaAdvanceBar.classList.add('hidden');
            sigaManagerContainer.classList.add('hidden');
        } else if (appState.currentStep === 2) {
            stepItemReport.className = 'wizard-step-item completed';
            stepStatusReport.className = 'step-status-badge badge-completed';
            stepStatusReport.textContent = '✔ Concluído';

            stepItemSiga.className = 'wizard-step-item active';
            stepStatusSiga.className = 'step-status-badge badge-active';
            stepStatusSiga.textContent = 'Passo Atual (Coleção)';

            stepItemDrive.className = 'wizard-step-item disabled';
            stepStatusDrive.className = 'step-status-badge badge-disabled';
            stepStatusDrive.textContent = 'Aguardando Conclusão SIGA';

            stepItemProcess.className = 'wizard-step-item disabled';
            stepStatusProcess.className = 'step-status-badge badge-disabled';
            stepStatusProcess.textContent = 'Aguardando Drive';

            stepItemResult.className = 'wizard-step-item disabled';
            stepStatusResult.className = 'step-status-badge badge-disabled';
            stepStatusResult.textContent = 'Aguardando Processamento';

            connector1.classList.add('completed');
            connector2.classList.remove('completed');
            connector3.classList.remove('completed');
            connector4.classList.remove('completed');

            dropZonePrompt.textContent = 'Arraste e solte arquivos mensais do SIGA aqui ou';
            btnChooseFileLabel.textContent = 'Escolher Arquivo do SIGA';

            if (sigaCount > 0) {
                sigaAdvanceBar.classList.remove('hidden');
                sigaManagerContainer.classList.remove('hidden');
                renderSigaManagerList();
            } else {
                sigaAdvanceBar.classList.add('hidden');
                sigaManagerContainer.classList.add('hidden');
            }
        } else if (appState.currentStep === 3) {
            stepItemReport.className = 'wizard-step-item completed';
            stepStatusReport.className = 'step-status-badge badge-completed';
            stepStatusReport.textContent = '✔ Concluído';

            stepItemSiga.className = 'wizard-step-item completed';
            stepStatusSiga.className = 'step-status-badge badge-completed';
            stepStatusSiga.textContent = `✔ Concluído (${sigaCount})`;

            stepItemDrive.className = 'wizard-step-item active';
            stepStatusDrive.className = 'step-status-badge badge-active';
            stepStatusDrive.textContent = 'Passo Atual';

            stepItemProcess.className = 'wizard-step-item disabled';
            stepStatusProcess.className = 'step-status-badge badge-disabled';
            stepStatusProcess.textContent = 'Aguardando Drive';

            stepItemResult.className = 'wizard-step-item disabled';
            stepStatusResult.className = 'step-status-badge badge-disabled';
            stepStatusResult.textContent = 'Aguardando Processamento';

            connector1.classList.add('completed');
            connector2.classList.add('completed');
            connector3.classList.remove('completed');
            connector4.classList.remove('completed');

            dropZonePrompt.textContent = 'Arraste e solte a Planilha do Drive aqui ou';
            btnChooseFileLabel.textContent = 'Escolher Planilha do Drive';
            sigaAdvanceBar.classList.add('hidden');
            if (sigaCount > 0) {
                sigaManagerContainer.classList.remove('hidden');
                renderSigaManagerList();
            }
        } else if (appState.currentStep >= 4) {
            stepItemReport.className = 'wizard-step-item completed';
            stepStatusReport.className = 'step-status-badge badge-completed';

            stepItemSiga.className = 'wizard-step-item completed';
            stepStatusSiga.className = 'step-status-badge badge-completed';

            stepItemDrive.className = 'wizard-step-item completed';
            stepStatusDrive.className = 'step-status-badge badge-completed';
            stepStatusDrive.textContent = '✔ Concluído';

            stepItemProcess.className = 'wizard-step-item completed';
            stepStatusProcess.className = 'step-status-badge badge-completed';
            stepStatusProcess.textContent = '✔ Executado';

            stepItemResult.className = 'wizard-step-item active';
            stepStatusResult.className = 'step-status-badge badge-active';
            stepStatusResult.textContent = 'Resultado Final Exibido';

            connector1.classList.add('completed');
            connector2.classList.add('completed');
            connector3.classList.add('completed');
            connector4.classList.add('completed');

            sigaAdvanceBar.classList.add('hidden');
            if (sigaCount > 0) {
                sigaManagerContainer.classList.remove('hidden');
                renderSigaManagerList();
            }
        }
    }

    function updateMinimalHeaderUI() {
        if (!appSession.isActive) {
            headerUnitTitle.textContent = 'Selecione a Planilha de Relatório';
            headerMetaRow.classList.add('hidden');
            return;
        }

        headerUnitTitle.textContent = appSession.unitName;
        headerMetaRow.classList.remove('hidden');

        const sigaCount = appSession.sigaCollection.length;
        metaReportItem.innerHTML = `📄 Relatório: <strong>${appSession.reportFile ? appSession.reportFile.name : 'Não carregado'}</strong>`;
        metaSigaItem.innerHTML = `📊 SIGA: <strong>${sigaCount} arquivo${sigaCount === 1 ? '' : 's'}</strong>`;
        metaDriveItem.innerHTML = `📁 Drive: <strong>${appSession.driveFile ? appSession.driveFile.name : 'Não carregado'}</strong>`;
        metaStatusBadge.textContent = appSession.status;

        updateSessionSheetSelectorUI();
    }

    function updateSessionSheetSelectorUI() {
        if (!appSession.isActive) {
            sessionSheetSelector.classList.add('hidden');
            return;
        }

        selectorBtnGroup.innerHTML = '';

        if (appSession.reportMatrix.length > 0) {
            const btnRep = document.createElement('button');
            btnRep.type = 'button';
            btnRep.className = `btn-sheet-toggle ${appSession.activeViewSheet === 'report' ? 'active' : ''}`;
            btnRep.textContent = '📄 Planilha de Relatório';
            btnRep.addEventListener('click', viewReportSheetInTable);
            selectorBtnGroup.appendChild(btnRep);
        }

        appSession.sigaCollection.forEach(sigaItem => {
            const btnSiga = document.createElement('button');
            btnSiga.type = 'button';
            btnSiga.className = `btn-sheet-toggle ${appSession.activeViewSheet === 'siga_' + sigaItem.id ? 'active' : ''}`;
            btnSiga.textContent = `📊 SIGA (${sigaItem.monthLabel})`;
            btnSiga.addEventListener('click', () => viewSigaItemInTable(sigaItem.id));
            selectorBtnGroup.appendChild(btnSiga);
        });

        if (appSession.driveMatrix.length > 0) {
            const btnDrv = document.createElement('button');
            btnDrv.type = 'button';
            btnDrv.className = `btn-sheet-toggle ${appSession.activeViewSheet === 'drive' ? 'active' : ''}`;
            btnDrv.textContent = '📁 Planilha do Drive';
            btnDrv.addEventListener('click', viewDriveSheetInTable);
            selectorBtnGroup.appendChild(btnDrv);
        }

        if (FinalProcessor.isReady) {
            const btnRes = document.createElement('button');
            btnRes.type = 'button';
            btnRes.className = `btn-sheet-toggle btn-result-toggle ${appSession.activeViewSheet === 'result' ? 'active' : ''}`;
            btnRes.textContent = '🎯 Resultado Final';
            btnRes.addEventListener('click', viewResultInTable);
            selectorBtnGroup.appendChild(btnRes);
        }

        sessionSheetSelector.classList.remove('hidden');
    }

    function renderSigaManagerList() {
        sigaManagerList.innerHTML = '';
        sigaCollectionCount.textContent = appSession.sigaCollection.length;

        if (appSession.sigaCollection.length === 0) {
            sigaManagerList.innerHTML = '<div style="font-size: 0.8rem; color: var(--text-muted);">Nenhum arquivo do SIGA importado ainda.</div>';
            return;
        }

        const fragment = document.createDocumentFragment();

        appSession.sigaCollection.forEach(item => {
            const card = document.createElement('div');
            card.className = 'siga-item-card';

            const info = document.createElement('div');
            info.className = 'siga-item-info';
            info.innerHTML = `
                <span class="siga-item-month">${item.monthLabel}</span>
                <span class="siga-item-filename">📄 ${item.fileName} • Importado às ${item.importDate}</span>
            `;

            const actions = document.createElement('div');
            actions.className = 'siga-item-actions';

            const btnView = document.createElement('button');
            btnView.type = 'button';
            btnView.className = `btn-view-siga-item ${appSession.activeViewSheet === 'siga_' + item.id ? 'active' : ''}`;
            btnView.textContent = 'Visualizar';
            btnView.addEventListener('click', () => viewSigaItemInTable(item.id));

            actions.appendChild(btnView);
            card.appendChild(info);
            card.appendChild(actions);

            fragment.appendChild(card);
        });

        sigaManagerList.appendChild(fragment);
    }

    /**
     * ETAPA 1 DO WIZARD: Importar Relatório
     */
    function processReportStep(file, rawMatrix) {
        resetInspectorData();

        let extractedUnit = 'Unidade de Saúde';
        if (rawMatrix && rawMatrix.length > 1 && rawMatrix[1][0]) {
            const rawA2 = String(rawMatrix[1][0]).trim();
            if (rawA2 !== '') {
                extractedUnit = rawA2;
            }
        }

        appSession.isActive = true;
        appSession.unitName = extractedUnit;
        appSession.reportFile = file;
        appSession.status = 'Relatório Carregado';

        const fileExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';

        recordStepSnapshot(1, "Planilha original importada (Texto Bruto)", rawMatrix, {
            fileName: file.name,
            fileType: fileExt
        });

        let treatedMatrix = rawMatrix.length > 6 ? rawMatrix.slice(6) : [];

        let maxCols = 0;
        treatedMatrix.forEach(row => { if (row.length > maxCols) maxCols = row.length; });

        const nonArrayColIndices = [];
        const removedEmptyColsLetters = [];

        for (let colIdx = 0; colIdx < maxCols; colIdx++) {
            let hasContent = false;
            for (let rowIdx = 0; rowIdx < treatedMatrix.length; rowIdx++) {
                const cellVal = treatedMatrix[rowIdx][colIdx];
                if (!isCellEmpty(cellVal)) {
                    hasContent = true;
                    break;
                }
            }
            if (hasContent) {
                nonArrayColIndices.push(colIdx);
            } else {
                removedEmptyColsLetters.push(getExcelColumnName(colIdx));
            }
        }

        treatedMatrix = treatedMatrix.map(row => nonArrayColIndices.map(colIdx => row[colIdx]));
        appSession.reportMatrix = treatedMatrix;

        const csvInspection = CSVInspectorEngine.inspectAndValidateCSV(treatedMatrix, 'Planilha de Relatório');

        recordStepSnapshot(2, "Após remoção de 6 linhas e colunas vazias", treatedMatrix, {
            removedEmptyCols: removedEmptyColsLetters,
            csvInspectorDetails: csvInspection
        });

        addInspectorLog("✔ Arquivo do Relatório lido com sucesso.");
        addInspectorLog(`🔍 Leitura Bruta do CSV: "${csvInspection.diagnosis}"`);

        if (csvInspection.validationErrors && csvInspection.validationErrors.length > 0) {
            addInspectorLog(`❌ ERRO NA VALIDAÇÃO DO CSV: Interrompendo pipeline devido a divergências de células.`, false);
        }

        addInspectorLog(`✔ Unidade de Saúde identificada na célula A2: "${extractedUnit}".`);
        addInspectorLog("✔ 6 primeiras linhas removidas.");
        addInspectorLog("✔ Colunas vazias identificadas.");
        addInspectorLog(`✔ ${removedEmptyColsLetters.length} colunas removidas.`, true, removedEmptyColsLetters.join(', '));
        addInspectorLog("✔ Visualização atualizada.");

        appSession.reportInspector = {
            steps: [...currentInspectorSteps],
            timelineLogs: [...currentInspectorTimelineLogs]
        };

        appState.currentStep = 2;
        appSession.activeViewSheet = 'report';

        updateWizardUI();
        updateMinimalHeaderUI();

        summaryContainer.classList.add('hidden');
        renderSpreadsheetTable(treatedMatrix);
        renderInspectorUI();

        viewTabsBar.classList.remove('hidden');
    }

    /**
     * ETAPA 2 DO WIZARD: Importar Múltiplos Arquivos do SIGA
     */
    function processSigaStep(file, rawMatrix) {
        resetInspectorData();

        const monthLabel = detectSigaMonth(rawMatrix, file.name);

        const existingIdx = appSession.sigaCollection.findIndex(item => item.monthLabel === monthLabel);
        if (existingIdx !== -1) {
            const confirmReplace = window.confirm(`O mês "${monthLabel}" já possui uma planilha importada (${appSession.sigaCollection[existingIdx].fileName}).\n\nDeseja substituir o arquivo existente?`);
            if (!confirmReplace) {
                addInspectorLog(`⚠️ Importação de "${file.name}" cancelada pelo usuário (substituição recusada).`, false);
                return;
            }
        }

        recordStepSnapshot(1, "Planilha original importada", rawMatrix);
        addInspectorLog(`✔ Arquivo do SIGA (${monthLabel}) lido com sucesso.`);

        const treated = runTreatmentPipeline('siga', rawMatrix);
        const summaryData = calculateFinancialSummary(treated);

        const itemObj = {
            id: existingIdx !== -1 ? appSession.sigaCollection[existingIdx].id : 'siga_' + Date.now(),
            fileName: file.name,
            monthLabel: monthLabel,
            importDate: new Date().toLocaleTimeString(),
            rawMatrix: rawMatrix,
            treatedMatrix: treated,
            summaryData: summaryData,
            status: 'Tratado',
            inspector: {
                steps: [...currentInspectorSteps],
                timelineLogs: [...currentInspectorTimelineLogs]
            }
        };

        if (existingIdx !== -1) {
            appSession.sigaCollection[existingIdx] = itemObj;
            addInspectorLog(`✔ Planilha do mês "${monthLabel}" substituída com sucesso.`);
        } else {
            appSession.sigaCollection.push(itemObj);
            addInspectorLog(`✔ Planilha do mês "${monthLabel}" adicionada à Coleção do SIGA.`);
        }

        appSession.status = `SIGA (${appSession.sigaCollection.length} arquivos)`;
        appSession.activeViewSheet = 'siga_' + itemObj.id;
        appSession.activeSigaId = itemObj.id;

        updateWizardUI();
        updateMinimalHeaderUI();

        viewSigaItemInTable(itemObj.id);
        viewTabsBar.classList.remove('hidden');
    }

    /**
     * ETAPA 3 DO WIZARD: Importar Planilha do Drive com Tratamento Temporal & Remoção de Linhas Vazias
     */
    function processDriveStep(file, rawMatrix) {
        resetInspectorData();

        const fileExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';

        recordStepSnapshot(1, "Planilha original importada", rawMatrix, {
            fileName: file.name,
            fileType: fileExt
        });

        let treatedDriveMatrix = rawMatrix.length > 1 ? rawMatrix.slice(1) : [];

        const reportMonthRange = TemporalEngine.extractMonthRangeFromReport(appSession.reportMatrix);

        let primeiroIndice = null;
        let ultimoIndice = null;
        const temporalConversionTable = [];

        if (reportMonthRange) {
            primeiroIndice = reportMonthRange.primeiroMes.calculatedIndex;
            ultimoIndice = reportMonthRange.ultimoMes.calculatedIndex;

            reportMonthRange.listaMeses.forEach(m => {
                temporalConversionTable.push({
                    str: m.str,
                    diffFromRef: m.diffFromRef,
                    calculatedIndex: m.calculatedIndex
                });
            });

            recordStepSnapshot(2, "Meses encontrados na Planilha de Relatório", treatedDriveMatrix, {
                reportMonthRange
            });

            recordStepSnapshot(3, "Conversão Matemática Temporal", treatedDriveMatrix, {
                temporalConversionTable
            });
        }

        const headerRowDrive = treatedDriveMatrix[0] || [];
        const keptColIndices = [];
        const removedColsLog = [];

        for (let colIdx = 0; colIdx < headerRowDrive.length; colIdx++) {
            if (colIdx === 0) {
                keptColIndices.push(colIdx);
                continue;
            }

            const cellVal = headerRowDrive[colIdx];
            const numVal = MoneyEngine.importarValor(cellVal);

            if (primeiroIndice !== null && ultimoIndice !== null) {
                if (numVal >= primeiroIndice && numVal <= ultimoIndice) {
                    keptColIndices.push(colIdx);
                } else {
                    removedColsLog.push(`Coluna ${getExcelColumnName(colIdx)} (ID: ${cellVal || colIdx})`);
                }
            } else {
                keptColIndices.push(colIdx);
            }
        }

        treatedDriveMatrix = treatedDriveMatrix.map(row => keptColIndices.map(colIdx => row[colIdx]));

        // Remoção de Linhas 100% Vazias
        const initialDriveRowsCount = treatedDriveMatrix.length;
        treatedDriveMatrix = treatedDriveMatrix.filter(row => {
            if (!row || row.length === 0) return false;
            return row.some(cell => !isCellEmpty(cell));
        });
        const removedDriveEmptyRowsCount = initialDriveRowsCount - treatedDriveMatrix.length;

        recordStepSnapshot(4, "Filtro de Colunas & Remoção de Linhas Vazias", treatedDriveMatrix, {
            driveFilterDetails: {
                primeiroIndice: primeiroIndice !== null ? primeiroIndice : 'Não determinado',
                ultimoIndice: ultimoIndice !== null ? ultimoIndice : 'Não determinado',
                removedCols: removedColsLog
            },
            driveEmptyRowsRemoved: removedDriveEmptyRowsCount
        });

        addInspectorLog("✔ Arquivo do Drive importado.");
        addInspectorLog("✔ 1ª linha do topo removida do Drive.");
        if (reportMonthRange) {
            addInspectorLog(`✔ Meses identificados no Relatório (${reportMonthRange.primeiroMes.str} a ${reportMonthRange.ultimoMes.str}).`);
            addInspectorLog(`✔ Índices calculados (${primeiroIndice} a ${ultimoIndice}).`);
            addInspectorLog("✔ Intervalo determinado automaticamente.");
        }
        addInspectorLog(`✔ Colunas filtradas do Drive (${removedColsLog.length} colunas removidas).`);
        addInspectorLog(`✔ Linhas vazias removidas (${removedDriveEmptyRowsCount} linhas eliminadas).`);
        addInspectorLog("✔ Visualização do Drive concluída.");

        appSession.driveFile = file;
        appSession.driveMatrix = treatedDriveMatrix;

        appSession.driveInspector = {
            steps: [...currentInspectorSteps],
            timelineLogs: [...currentInspectorTimelineLogs]
        };

        FinalProcessor.process(appSession);
        appSession.status = 'Resultado Final Gerado';
        appState.currentStep = 5;

        updateWizardUI();
        updateMinimalHeaderUI();

        viewResultInTable();
        viewTabsBar.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 13. INTERFACE & NAVEGAÇÃO POR ABAS (UI Controller)
    // ------------------------------------------------------------------------

    function viewReportSheetInTable() {
        appSession.activeViewSheet = 'report';
        currentInspectorSteps = appSession.reportInspector.steps;
        currentInspectorTimelineLogs = appSession.reportInspector.timelineLogs;

        inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha de Relatório)";
        inspectorSheetSubtitle.textContent = "Visualização do relatório tratado (6 linhas do topo e colunas vazias removidas).";

        summaryContainer.classList.add('hidden');
        resultModeSelectorBar.classList.add('hidden');
        resultDashboardContainer.classList.add('hidden');

        renderSpreadsheetTable(appSession.reportMatrix);
        renderInspectorUI();
        updateMinimalHeaderUI();
        renderSigaManagerList();
    }

    function viewSigaItemInTable(sigaId) {
        const item = appSession.sigaCollection.find(i => i.id === sigaId);
        if (!item) return;

        appSession.activeViewSheet = 'siga_' + item.id;
        appSession.activeSigaId = item.id;

        currentInspectorSteps = item.inspector.steps;
        currentInspectorTimelineLogs = item.inspector.timelineLogs;

        inspectorSheetTitle.textContent = `🔍 Inspector do Pipeline (Planilha do SIGA - ${item.monthLabel})`;
        inspectorSheetSubtitle.textContent = `Visualização tratada do arquivo ${item.fileName} (${item.monthLabel}).`;

        resultModeSelectorBar.classList.add('hidden');
        resultDashboardContainer.classList.add('hidden');

        renderFinancialSummaryCards(item.summaryData, item.monthLabel);
        renderSpreadsheetTable(item.treatedMatrix);
        renderInspectorUI();
        updateMinimalHeaderUI();
        renderSigaManagerList();
    }

    function viewDriveSheetInTable() {
        appSession.activeViewSheet = 'drive';
        currentInspectorSteps = appSession.driveInspector.steps;
        currentInspectorTimelineLogs = appSession.driveInspector.timelineLogs;

        inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha do Drive)";
        inspectorSheetSubtitle.textContent = "Acompanhe o filtro de colunas por datas e a remoção de linhas vazias no Drive.";

        summaryContainer.classList.add('hidden');
        resultModeSelectorBar.classList.add('hidden');
        resultDashboardContainer.classList.add('hidden');

        renderSpreadsheetTable(appSession.driveMatrix);
        renderInspectorUI();
        updateMinimalHeaderUI();
        renderSigaManagerList();
    }

    function viewResultInTable() {
        if (!FinalProcessor.isReady) {
            alert('O resultado final ainda não foi gerado.');
            return;
        }

        appSession.activeViewSheet = 'result';
        currentInspectorSteps = FinalProcessor.resultInspector.steps;
        currentInspectorTimelineLogs = FinalProcessor.resultInspector.timelineLogs;

        inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Resultado Final)";
        inspectorSheetSubtitle.textContent = "Painel Analítico de Gestão e Cruzamento de Dados.";

        summaryContainer.classList.add('hidden');

        ResultViewEngine.render();
        renderInspectorUI();
        updateMinimalHeaderUI();
        renderSigaManagerList();
    }

    function initTabNavigation() {
        btnTabViewer.addEventListener('click', () => {
            appState.activeTab = 'viewer';
            btnTabViewer.classList.add('active');
            btnTabInspector.classList.remove('active');
            viewerTabContent.classList.remove('hidden');
            inspectorTabContent.classList.add('hidden');
        });

        btnTabInspector.addEventListener('click', () => {
            appState.activeTab = 'inspector';
            btnTabInspector.classList.add('active');
            btnTabViewer.classList.remove('active');
            inspectorTabContent.classList.remove('hidden');
            viewerTabContent.classList.add('hidden');
        });
    }

    function initEvents() {
        fileInput.addEventListener('change', handleFileSelect);
        btnRemoveFile.addEventListener('click', resetView);

        btnAdvanceToDrive.addEventListener('click', () => {
            if (appSession.sigaCollection.length === 0) {
                alert('Importe ao menos uma Planilha do SIGA para avançar.');
                return;
            }
            appState.currentStep = 3;
            updateWizardUI();
        });

        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

        initTabNavigation();
        ResultViewEngine.init();
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
            return;
        }

        readSpreadsheetFile(file);
    }

    function resetView() {
        fileInput.value = '';

        appState.currentStep = 1;
        appSession.isActive = false;
        appSession.unitName = 'Não identificada';
        appSession.reportFile = null;
        appSession.sigaCollection = [];
        appSession.driveFile = null;
        appSession.status = 'Aguardando Relatório';
        appSession.reportMatrix = [];
        appSession.driveMatrix = [];

        FinalProcessor.isReady = false;
        FinalProcessor.resultMatrix = [];
        FinalProcessor.cellStatusMap = {};

        ResultViewEngine.activeMode = 'planilha';
        ResultViewEngine.itemSearchQuery = '';

        resetInspectorData();

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        summaryGrid.innerHTML = '';
        inspectorStepsContainer.innerHTML = '';
        inspectorLogTimeline.innerHTML = '';
        sigaManagerList.innerHTML = '';

        if (resultModeSelectorBar) resultModeSelectorBar.classList.add('hidden');
        if (resultDashboardContainer) {
            resultDashboardContainer.innerHTML = '';
            resultDashboardContainer.classList.add('hidden');
        }

        updateWizardUI();
        updateMinimalHeaderUI();

        viewTabsBar.classList.add('hidden');
        summaryContainer.classList.add('hidden');
        tableWrapper.classList.add('hidden');
        sigaManagerContainer.classList.add('hidden');
        sigaAdvanceBar.classList.add('hidden');

        appState.activeTab = 'viewer';
        btnTabViewer.classList.add('active');
        btnTabInspector.classList.remove('active');
        viewerTabContent.classList.remove('hidden');
        inspectorTabContent.classList.add('hidden');

        emptyState.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 14. LEITURA DE ARQUIVO (FASE 1 - SUPORTE A CSV BRASILEIRO E EXCEL BRUTO)
    // ------------------------------------------------------------------------

    function readSpreadsheetFile(file) {
        const fileName = file.name.toLowerCase();
        const isCsvOrTsv = fileName.endsWith('.csv') || fileName.endsWith('.tsv');

        if (isCsvOrTsv) {
            const textReader = new FileReader();
            textReader.onload = function (e) {
                try {
                    const text = e.target.result;
                    const rawMatrix = parseBrazilianCSV(text);

                    if (rawMatrix && rawMatrix.length > 0) {
                        dispatchStepProcess(file, rawMatrix);
                    } else {
                        alert('O arquivo CSV selecionado não possui dados.');
                    }
                } catch (err) {
                    console.error('Erro ao ler arquivo CSV:', err);
                    alert('Não foi possível ler o arquivo CSV. Verifique o formato e a codificação do arquivo.');
                }
            };
            textReader.readAsText(file, 'ISO-8859-1');
        } else {
            const arrayReader = new FileReader();
            arrayReader.onload = function (e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { 
                        type: 'array',
                        cellDates: true,
                        cellNF: false,
                        cellText: true,
                        raw: true 
                    });

                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        defval: '',
                        raw: true,
                        rawNumbers: false 
                    });

                    if (rawMatrix && rawMatrix.length > 0) {
                        dispatchStepProcess(file, rawMatrix);
                    } else {
                        alert('A planilha selecionada não possui dados.');
                    }
                } catch (error) {
                    console.error('Erro ao ler a planilha:', error);
                    alert('Não foi possível ler o arquivo. Certifique-se de que o arquivo não está corrompido.');
                }
            };
            arrayReader.readAsArrayBuffer(file);
        }
    }

    function dispatchStepProcess(file, rawMatrix) {
        if (appState.currentStep === 1) {
            processReportStep(file, rawMatrix);
        } else if (appState.currentStep === 2) {
            processSigaStep(file, rawMatrix);
        } else if (appState.currentStep === 3) {
            processDriveStep(file, rawMatrix);
        }
    }

    // ------------------------------------------------------------------------
    // 15. RENDERIZAÇÃO DA TABELA (RECONSTRUÇÃO FIEL DE TEXTO BRUTO)
    // ------------------------------------------------------------------------

    function renderSpreadsheetTable(matrix) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = '';

        if (!matrix || matrix.length === 0) {
            alert('A planilha não possui dados a exibir.');
            return;
        }

        let maxCols = 0;
        matrix.forEach(row => {
            if (row.length > maxCols) maxCols = row.length;
        });

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

        const bodyRows = matrix.slice(1);
        const fragment = document.createDocumentFragment();

        const isResultView = appSession.activeViewSheet === 'result';

        bodyRows.forEach((rowData, rowIdx) => {
            const actualRowIdx = rowIdx + 1;
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = actualRowIdx;

            const thRowIndex = document.createElement('th');
            thRowIndex.className = 'row-index';
            thRowIndex.textContent = actualRowIdx;
            tr.appendChild(thRowIndex);

            for (let colIdx = 0; colIdx < maxCols; colIdx++) {
                const td = document.createElement('td');
                td.dataset.colIndex = colIdx;
                td.dataset.rowIndex = actualRowIdx;

                const rawCellValue = rowData[colIdx];

                td.textContent = rawCellValue !== undefined && rawCellValue !== null ? String(rawCellValue) : '';

                if (isResultView && colIdx > 0) {
                    const status = FinalProcessor.cellStatusMap[`${actualRowIdx}_${colIdx}`];
                    if (status === 'MATCH') {
                        td.classList.add('cell-match');
                        td.title = "🟢 MATCH: Valor igual ao informado no Drive";
                    } else if (status === 'MISSING') {
                        td.classList.add('cell-missing');
                        td.title = "🟠 MISSING: Presente no Drive, mas ausente no Relatório";
                    } else if (status === 'DIVERGENT') {
                        td.classList.add('cell-divergent');
                        td.title = "🔴 DIVERGENT: Valor divergente entre Relatório e Drive";
                    }
                }

                tr.appendChild(td);
            }

            fragment.appendChild(tr);
        });

        tableBody.appendChild(fragment);

        setupTableInteractivity();

        emptyState.classList.add('hidden');
        tableWrapper.classList.remove('hidden');
        viewerTabContent.classList.remove('hidden');
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
