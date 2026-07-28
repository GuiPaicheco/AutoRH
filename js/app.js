/**
 * ============================================================================
 * Importador de Planilhas - app.js (Módulo Temporal & Filtro do Drive)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) com arquitetura temporal
 * matemática centralizada baseada em datas.
 * 
 * Referência Temporal Centralizada:
 * Novembro / 2022 ➔ Índice 2
 * 
 * Módulos de Tratamento:
 * - 1. Planilha de Relatório (A2 Unidade, remoção de 6 linhas e colunas vazias)
 * - 2. Planilha do SIGA (Tratamento de 5 passos + resumo financeiro BRL)
 * - 3. Planilha do Drive (Remoção da 1ª linha e filtro matemático de colunas por datas)
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
    const stepItemDrive = document.getElementById('stepItemDrive');
    const stepItemProcess = document.getElementById('stepItemProcess');
    const stepItemResult = document.getElementById('stepItemResult');

    const stepStatusReport = document.getElementById('stepStatusReport');
    const stepStatusSiga = document.getElementById('stepStatusSiga');
    const stepStatusDrive = document.getElementById('stepStatusDrive');
    const connector1 = document.getElementById('connector1');
    const connector2 = document.getElementById('connector2');
    const connector3 = document.getElementById('connector3');

    // Sessão & Alternador de 3 Planilhas
    const sessionSheetSelector = document.getElementById('sessionSheetSelector');
    const btnViewReportSheet = document.getElementById('btnViewReportSheet');
    const btnViewSigaSheet = document.getElementById('btnViewSigaSheet');
    const btnViewDriveSheet = document.getElementById('btnViewDriveSheet');

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

    // Elementos do Resumo Financeiro
    const summaryContainer = document.getElementById('summaryContainer');
    const summaryGrid = document.getElementById('summaryGrid');

    // Estado Geral da Aplicação
    const appState = {
        currentStep: 1,
        activeTab: 'viewer'
    };

    // ------------------------------------------------------------------------
    // 1. MAPEAMENTO DE SESSÃO & MÓDULO PROCESSADOR FINAL
    // ------------------------------------------------------------------------

    const appSession = {
        isActive: false,
        unitName: 'Não identificada',
        reportFile: null,
        sigaFile: null,
        driveFile: null,
        status: 'Aguardando Relatório',
        reportMatrix: [],
        sigaMatrix: [],
        driveMatrix: [],
        reportInspector: { steps: [], timelineLogs: [] },
        sigaInspector: { steps: [], timelineLogs: [] },
        driveInspector: { steps: [], timelineLogs: [] },
        sigaSummaryData: {},
        activeViewSheet: 'report'
    };

    const FinalProcessor = {
        isReady: false,
        reportData: null,
        sigaData: null,
        driveData: null,

        process(sessionObj) {
            console.log("%c[FinalProcessor] Módulo preparado para cruzamento futuro das 3 fontes de dados.", "color: #059669; font-weight: bold; font-size: 13px;");
            if (!sessionObj || !sessionObj.reportMatrix.length || !sessionObj.sigaMatrix.length || !sessionObj.driveMatrix.length) {
                this.isReady = false;
                return null;
            }
            this.isReady = true;
            this.reportData = sessionObj.reportMatrix;
            this.sigaData = sessionObj.sigaMatrix;
            this.driveData = sessionObj.driveMatrix;
            return {
                status: 'Pronto para Processamento Conjunto',
                reportRows: this.reportData.length,
                sigaRows: this.sigaData.length,
                driveRows: this.driveData.length
            };
        }
    };

    // Inspector State Context
    let currentInspectorSteps = [];
    let currentInspectorTimelineLogs = [];

    // ------------------------------------------------------------------------
    // 2. MÓDULO MATEMÁTICO TEMPORAL CENTRALIZADO (TemporalEngine)
    // ------------------------------------------------------------------------

    /**
     * ESTRUTURA DE REFERÊNCIA TEMPORAL CENTRALIZADA.
     * Novembro de 2022 ➔ Índice 2
     */
    const TEMPORAL_REFERENCE = {
        mes: 11,
        ano: 2022,
        indice: 2
    };

    const TemporalEngine = {
        parseMonthYear(cellVal) {
            if (cellVal === null || cellVal === undefined) return null;
            const str = String(cellVal).trim();
            
            // Formato MM/YYYY ou M/YYYY
            let match = str.match(/^(\d{1,2})[\/-](\d{4})$/);
            if (match) {
                const mes = parseInt(match[1], 10);
                const ano = parseInt(match[2], 10);
                if (mes >= 1 && mes <= 12) {
                    return { mes, ano, str: `${String(mes).padStart(2, '0')}/${ano}` };
                }
            }
            // Formato YYYY-MM
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
    // 3. CONFIGURAÇÕES DE TRATAMENTO SIGA
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

    function parseNumericValue(val) {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return isNaN(val) ? 0 : val;

        let str = String(val).trim();
        if (str === '') return 0;

        if (str.includes(',') && str.includes('.')) {
            if (str.indexOf('.') < str.indexOf(',')) {
                str = str.replace(/\./g, '').replace(',', '.');
            } else {
                str = str.replace(/,/g, '');
            }
        } else if (str.includes(',')) {
            str = str.replace(',', '.');
        }

        str = str.replace(/[^\d.-]/g, '');

        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
    }

    function formatBRL(amount) {
        return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // ------------------------------------------------------------------------
    // 4. MÓDULO INSPETOR DO PIPELINE (Pipeline Inspector Engine)
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

            // EXIBIÇÃO ESPECÍFICA DO DRIVE: ETAPA 2 (Meses no Relatório)
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

            // EXIBIÇÃO ESPECÍFICA DO DRIVE: ETAPA 3 (Tabela de Conversão Temporal)
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

            // EXIBIÇÃO ESPECÍFICA DO DRIVE: ETAPA 4 (Filtro por Índices)
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
                        ${eq.colDetails.map(c => `<div class="equation-line">${c.colName}: <b>${formatBRL(c.value)}</b></div>`).join('')}
                        <div class="equation-result-line">= Total: ${formatBRL(eq.total)}</div>
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
    // 5. MOTOR DE REGRAS SIGA (Treatment Pipeline Engine)
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
    // 6. MÓDULO DO RESUMO FINANCEIRO (SIGA)
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
                    const numVal = parseNumericValue(rawVal);
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
        addInspectorLog("✔ Somas e resumo financeiro finalizados.");

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
    // 7. GERENCIADOR DO WIZARD DE 5 ETAPAS & SESSÃO MINIMALISTA
    // ------------------------------------------------------------------------

    function updateWizardUI() {
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

            connector1.classList.remove('completed');
            connector2.classList.remove('completed');
            connector3.classList.remove('completed');

            dropZonePrompt.textContent = 'Arraste e solte a Planilha de Relatório aqui ou';
            btnChooseFileLabel.textContent = 'Escolher Planilha de Relatório';
        } else if (appState.currentStep === 2) {
            stepItemReport.className = 'wizard-step-item completed';
            stepStatusReport.className = 'step-status-badge badge-completed';
            stepStatusReport.textContent = '✔ Concluído';

            stepItemSiga.className = 'wizard-step-item active';
            stepStatusSiga.className = 'step-status-badge badge-active';
            stepStatusSiga.textContent = 'Passo Atual';

            stepItemDrive.className = 'wizard-step-item disabled';
            stepStatusDrive.className = 'step-status-badge badge-disabled';
            stepStatusDrive.textContent = 'Aguardando SIGA';

            connector1.classList.add('completed');
            connector2.classList.remove('completed');

            dropZonePrompt.textContent = 'Arraste e solte a Planilha do SIGA aqui ou';
            btnChooseFileLabel.textContent = 'Escolher Planilha do SIGA';
        } else if (appState.currentStep === 3) {
            stepItemReport.className = 'wizard-step-item completed';
            stepStatusReport.className = 'step-status-badge badge-completed';
            stepStatusReport.textContent = '✔ Concluído';

            stepItemSiga.className = 'wizard-step-item completed';
            stepStatusSiga.className = 'step-status-badge badge-completed';
            stepStatusSiga.textContent = '✔ Concluído';

            stepItemDrive.className = 'wizard-step-item active';
            stepStatusDrive.className = 'step-status-badge badge-active';
            stepStatusDrive.textContent = 'Passo Atual';

            connector1.classList.add('completed');
            connector2.classList.add('completed');
            connector3.classList.remove('completed');

            dropZonePrompt.textContent = 'Arraste e solte a Planilha do Drive aqui ou';
            btnChooseFileLabel.textContent = 'Escolher Planilha do Drive';
        } else if (appState.currentStep >= 4) {
            stepItemReport.className = 'wizard-step-item completed';
            stepStatusReport.className = 'step-status-badge badge-completed';
            stepStatusReport.textContent = '✔ Concluído';

            stepItemSiga.className = 'wizard-step-item completed';
            stepStatusSiga.className = 'step-status-badge badge-completed';
            stepStatusSiga.textContent = '✔ Concluído';

            stepItemDrive.className = 'wizard-step-item completed';
            stepStatusDrive.className = 'step-status-badge badge-completed';
            stepStatusDrive.textContent = '✔ Concluído';

            connector1.classList.add('completed');
            connector2.classList.add('completed');
            connector3.classList.add('completed');

            stepItemProcess.className = 'wizard-step-item active';
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

        metaReportItem.innerHTML = `📄 Relatório: <strong>${appSession.reportFile ? appSession.reportFile.name : 'Não carregado'}</strong>`;
        metaSigaItem.innerHTML = `📊 SIGA: <strong>${appSession.sigaFile ? appSession.sigaFile.name : 'Não carregado'}</strong>`;
        metaDriveItem.innerHTML = `📁 Drive: <strong>${appSession.driveFile ? appSession.driveFile.name : 'Não carregado'}</strong>`;
        metaStatusBadge.textContent = appSession.status;

        if (appSession.reportMatrix.length > 0 || appSession.sigaMatrix.length > 0 || appSession.driveMatrix.length > 0) {
            sessionSheetSelector.classList.remove('hidden');
        } else {
            sessionSheetSelector.classList.add('hidden');
        }
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

        recordStepSnapshot(1, "Planilha original importada", rawMatrix, {
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

        recordStepSnapshot(2, "Após remoção de 6 linhas e colunas vazias", treatedMatrix, {
            removedEmptyCols: removedEmptyColsLetters
        });

        addInspectorLog("✔ Arquivo do Relatório importado.");
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
     * ETAPA 2 DO WIZARD: Importar SIGA
     */
    function processSigaStep(file, rawMatrix) {
        resetInspectorData();

        recordStepSnapshot(1, "Planilha original importada", rawMatrix);
        addInspectorLog("✔ Arquivo do SIGA lido e carregado com sucesso pelo SheetJS.");

        const treated = runTreatmentPipeline('siga', rawMatrix);
        appSession.sigaMatrix = treated;

        const summaryData = calculateFinancialSummary(treated);
        appSession.sigaSummaryData = summaryData;
        appSession.sigaFile = file;
        appSession.status = 'SIGA Carregado';

        appSession.sigaInspector = {
            steps: [...currentInspectorSteps],
            timelineLogs: [...currentInspectorTimelineLogs]
        };

        appState.currentStep = 3;
        appSession.activeViewSheet = 'siga';

        updateWizardUI();
        updateMinimalHeaderUI();

        btnViewReportSheet.classList.remove('active');
        btnViewDriveSheet.classList.remove('active');
        btnViewSigaSheet.classList.add('active');

        inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha do SIGA)";
        inspectorSheetSubtitle.textContent = "Acompanhe visualmente o estado exato da planilha do SIGA nas 9 etapas de tratamento.";

        renderFinancialSummaryCards(summaryData);
        renderSpreadsheetTable(treated);
        renderInspectorUI();

        viewTabsBar.classList.remove('hidden');
    }

    /**
     * ETAPA 3 DO WIZARD: Importar Planilha do Drive com Tratamento Temporal Matemático
     * Pipeline do Drive:
     * 1. Snapshot ETAPA 1: Planilha original importada
     * 2. Remover 1ª linha do topo (matrix.slice(1))
     * 3. Extrair intervalo de meses do Relatório via TemporalEngine (primeiroMes a ultimoMes)
     * 4. Converter datas em índices numéricos (Novembro/2022 -> 2)
     * 5. Filtrar colunas do Drive mantendo Coluna A + colunas compreendidas no intervalo de índices
     * 6. Atualizar tabela e o Inspector do Drive (4 etapas)
     */
    function processDriveStep(file, rawMatrix) {
        resetInspectorData();

        const fileExt = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')).toLowerCase() : '';

        // ETAPA 1: Original Importada
        recordStepSnapshot(1, "Planilha original importada", rawMatrix, {
            fileName: file.name,
            fileType: fileExt
        });

        // 1. Remover 1ª linha do topo da matriz do Drive
        let treatedDriveMatrix = rawMatrix.length > 1 ? rawMatrix.slice(1) : [];

        // 2. Extrair meses do Relatório via TemporalEngine
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

            // ETAPA 2 do Inspector do Drive: Meses encontrados no Relatório
            recordStepSnapshot(2, "Meses encontrados na Planilha de Relatório", treatedDriveMatrix, {
                reportMonthRange
            });

            // ETAPA 3 do Inspector do Drive: Conversão Matemática Temporal
            recordStepSnapshot(3, "Conversão Matemática Temporal", treatedDriveMatrix, {
                temporalConversionTable
            });
        }

        // 3. Filtrar colunas do Drive por intervalo [primeiroIndice, ultimoIndice]
        const headerRowDrive = treatedDriveMatrix[0] || [];
        const keptColIndices = [];
        const removedColsLog = [];

        for (let colIdx = 0; colIdx < headerRowDrive.length; colIdx++) {
            // Coluna A (índice 0) é sempre preservada para identificação
            if (colIdx === 0) {
                keptColIndices.push(colIdx);
                continue;
            }

            const cellVal = headerRowDrive[colIdx];
            const numVal = parseNumericValue(cellVal);

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

        // ETAPA 4 do Inspector do Drive: Filtro Final de Colunas
        recordStepSnapshot(4, "Filtro de Colunas por Intervalo de Índices", treatedDriveMatrix, {
            driveFilterDetails: {
                primeiroIndice: primeiroIndice !== null ? primeiroIndice : 'Não determinado',
                ultimoIndice: ultimoIndice !== null ? ultimoIndice : 'Não determinado',
                removedCols: removedColsLog
            }
        });

        // Logs do Inspector do Drive
        addInspectorLog("✔ Arquivo do Drive importado.");
        addInspectorLog("✔ 1ª linha do topo removida do Drive.");
        if (reportMonthRange) {
            addInspectorLog(`✔ Meses identificados no Relatório (${reportMonthRange.primeiroMes.str} a ${reportMonthRange.ultimoMes.str}).`);
            addInspectorLog(`✔ Índices calculados (${primeiroIndice} a ${ultimoIndice}).`);
            addInspectorLog("✔ Intervalo determinado automaticamente.");
        }
        addInspectorLog(`✔ Colunas filtradas do Drive (${removedColsLog.length} colunas removidas).`);
        addInspectorLog("✔ Visualização do Drive concluída.");

        appSession.driveFile = file;
        appSession.driveMatrix = treatedDriveMatrix;
        appSession.status = 'Pronto para Processamento';

        appSession.driveInspector = {
            steps: [...currentInspectorSteps],
            timelineLogs: [...currentInspectorTimelineLogs]
        };

        FinalProcessor.process(appSession);

        appState.currentStep = 4;
        appSession.activeViewSheet = 'drive';

        updateWizardUI();
        updateMinimalHeaderUI();

        btnViewReportSheet.classList.remove('active');
        btnViewSigaSheet.classList.remove('active');
        btnViewDriveSheet.classList.add('active');

        inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha do Drive)";
        inspectorSheetSubtitle.textContent = "Acompanhe o filtro matemático de colunas por intervalo de datas no Drive.";

        summaryContainer.classList.add('hidden');
        renderSpreadsheetTable(treatedDriveMatrix);
        renderInspectorUI();

        viewTabsBar.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 8. INTERFACE & NAVEGAÇÃO POR ABAS (UI Controller)
    // ------------------------------------------------------------------------

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

        btnViewReportSheet.addEventListener('click', () => {
            btnViewReportSheet.classList.add('active');
            btnViewSigaSheet.classList.remove('active');
            btnViewDriveSheet.classList.remove('active');
            appSession.activeViewSheet = 'report';

            currentInspectorSteps = appSession.reportInspector.steps;
            currentInspectorTimelineLogs = appSession.reportInspector.timelineLogs;

            inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha de Relatório)";
            inspectorSheetSubtitle.textContent = "Visualização do relatório tratado (6 linhas do topo e colunas vazias removidas).";

            summaryContainer.classList.add('hidden');
            renderSpreadsheetTable(appSession.reportMatrix);
            renderInspectorUI();
        });

        btnViewSigaSheet.addEventListener('click', () => {
            btnViewSigaSheet.classList.add('active');
            btnViewReportSheet.classList.remove('active');
            btnViewDriveSheet.classList.remove('active');
            appSession.activeViewSheet = 'siga';

            currentInspectorSteps = appSession.sigaInspector.steps;
            currentInspectorTimelineLogs = appSession.sigaInspector.timelineLogs;

            inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha do SIGA)";
            inspectorSheetSubtitle.textContent = "Acompanhe visualmente o estado exato da planilha do SIGA nas 9 etapas de tratamento.";

            renderFinancialSummaryCards(appSession.sigaSummaryData);
            renderSpreadsheetTable(appSession.sigaMatrix);
            renderInspectorUI();
        });

        btnViewDriveSheet.addEventListener('click', () => {
            btnViewDriveSheet.classList.add('active');
            btnViewReportSheet.classList.remove('active');
            btnViewSigaSheet.classList.remove('active');
            appSession.activeViewSheet = 'drive';

            currentInspectorSteps = appSession.driveInspector.steps;
            currentInspectorTimelineLogs = appSession.driveInspector.timelineLogs;

            inspectorSheetTitle.textContent = "🔍 Inspector do Pipeline (Planilha do Drive)";
            inspectorSheetSubtitle.textContent = "Acompanhe o filtro matemático de colunas por intervalo de datas no Drive.";

            summaryContainer.classList.add('hidden');
            renderSpreadsheetTable(appSession.driveMatrix);
            renderInspectorUI();
        });
    }

    function initEvents() {
        fileInput.addEventListener('change', handleFileSelect);
        btnRemoveFile.addEventListener('click', resetView);

        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

        initTabNavigation();
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
        appSession.sigaFile = null;
        appSession.driveFile = null;
        appSession.status = 'Aguardando Relatório';
        appSession.reportMatrix = [];
        appSession.sigaMatrix = [];
        appSession.driveMatrix = [];
        appSession.sigaSummaryData = {};

        resetInspectorData();

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        summaryGrid.innerHTML = '';
        inspectorStepsContainer.innerHTML = '';
        inspectorLogTimeline.innerHTML = '';

        updateWizardUI();
        updateMinimalHeaderUI();

        viewTabsBar.classList.add('hidden');
        summaryContainer.classList.add('hidden');
        tableWrapper.classList.add('hidden');

        appState.activeTab = 'viewer';
        btnTabViewer.classList.add('active');
        btnTabInspector.classList.remove('active');
        viewerTabContent.classList.remove('hidden');
        inspectorTabContent.classList.add('hidden');

        emptyState.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 9. LEITURA DE ARQUIVO (Spreadsheet Reader)
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
                    if (appState.currentStep === 1) {
                        processReportStep(file, rawMatrix);
                    } else if (appState.currentStep === 2) {
                        processSigaStep(file, rawMatrix);
                    } else if (appState.currentStep === 3) {
                        processDriveStep(file, rawMatrix);
                    }
                } else {
                    alert('A planilha selecionada não possui dados.');
                }
            } catch (error) {
                console.error('Erro ao ler a planilha:', error);
                alert('Não foi possível ler o arquivo. Certifique-se de que o arquivo não está corrompido.');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    // ------------------------------------------------------------------------
    // 10. RENDERIZAÇÃO DA TABELA (Table Renderer)
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
