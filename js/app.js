/**
 * ============================================================================
 * Importador de Planilhas - app.js (Teste de Hipótese: 4 Linhas Iniciais)
 * ----------------------------------------------------------------------------
 * Aplicação estática em JavaScript Puro (Vanilla JS) para leitura, escolha do
 * tipo de planilha, tratamento via pipeline e Inspetor do Pipeline (9 Etapas).
 * 
 * Arquitetura em Módulos:
 * 1. Mapeamento & Configurações (Central Config, Header Normalization & Number Utilities)
 * 2. Módulo Inspetor do Pipeline (Pipeline Inspector Engine - 9 Etapas)
 * 3. Módulo de Diagnóstico Rápido (Debug & Diagnostic Engine)
 * 4. Motor de Regras & Pipelines (Treatment Pipeline Engine)
 * 5. Módulo do Resumo Financeiro (Financial Summary Engine)
 * 6. Gerenciamento do Modal (Modal Controller)
 * 7. Interface & Navegação por Abas (UI & Tab Controller)
 * 8. Leitura de Arquivo (Spreadsheet Reader)
 * 9. Renderizador da Tabela & Inspector (Render Controller)
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

    // Abas de Navegação
    const viewTabsBar = document.getElementById('viewTabsBar');
    const btnTabViewer = document.getElementById('btnTabViewer');
    const btnTabInspector = document.getElementById('btnTabInspector');
    const viewerTabContent = document.getElementById('viewerTabContent');
    const inspectorTabContent = document.getElementById('inspectorTabContent');

    // Elementos do Inspector do Pipeline
    const inspectorStepsContainer = document.getElementById('inspectorStepsContainer');
    const inspectorLogTimeline = document.getElementById('inspectorLogTimeline');

    // Elementos do Resumo Financeiro
    const summaryContainer = document.getElementById('summaryContainer');
    const summaryGrid = document.getElementById('summaryGrid');

    // Elementos do Modo Debug Secundário
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
        isDebugMode: false,
        activeTab: 'viewer'
    };

    // Objeto do Inspetor do Pipeline (Inspector State - 9 Etapas)
    const inspectorData = {
        steps: [],
        timelineLogs: []
    };

    // Estado de Diagnóstico Secundário (Debug Context)
    const debugContext = {
        rawRowsCount: 0,
        rawColsCount: 0,
        officialPostStep4Headers: [],
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
    // 1. MAPEAMENTO & CONFIGURAÇÕES (Central Config & Utilities)
    // ------------------------------------------------------------------------

    /**
     * CONFIGURAÇÃO CENTRALIZADA: Quantidade de linhas iniciais a remover do topo.
     * Alterável para testes de hipóteses estruturais.
     */
    const LINHAS_INICIAIS_REMOVIDAS = 4;

    /**
     * Tabela Oficial de Padronização de Nomes das Colunas (Regra 5).
     */
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

    /**
     * Normaliza nomes de cabeçalhos eliminando variações de digitação, espaços extras,
     * caracteres invisíveis (\r, \n, \t, \u00A0), e convertendo para CAIXA ALTA.
     */
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
    // 2. MÓDULO INSPETOR DO PIPELINE (Pipeline Inspector Engine - 9 Etapas)
    // ------------------------------------------------------------------------

    function resetInspectorData() {
        inspectorData.steps = [];
        inspectorData.timelineLogs = [];
    }

    function addInspectorLog(message, isSuccess = true, details = '') {
        inspectorData.timelineLogs.push({
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

        inspectorData.steps[stepNum - 1] = snapshot;
    }

    function renderInspectorUI() {
        inspectorStepsContainer.innerHTML = '';
        inspectorLogTimeline.innerHTML = '';

        if (inspectorData.steps.length === 0) {
            inspectorStepsContainer.innerHTML = `
                <div class="empty-state">
                    <p class="empty-state-text">Nenhuma planilha foi processada no Inspector ainda.</p>
                </div>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();

        inspectorData.steps.forEach(step => {
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

            if (step.stepNum === 3 && step.extraInfo.removedEmptyCols) {
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

        inspectorData.timelineLogs.forEach(log => {
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
    // 3. MÓDULO DE DIAGNÓSTICO RÁPIDO (Debug & Diagnostic Engine)
    // ------------------------------------------------------------------------

    function resetDebugContext() {
        debugContext.rawRowsCount = 0;
        debugContext.rawColsCount = 0;
        debugContext.officialPostStep4Headers = [];
        debugContext.removedTopRowsCount = 0;
        debugContext.removedBottomRowsCount = 0;
        debugContext.removedEmptyColsCount = 0;
        debugContext.removedSpecificColsLog = [];
        debugContext.renamedColsLog = [];
        debugContext.groupedCategoriesLog = [];
        debugContext.missingExpectedCols = [];
        debugContext.categoryTotals = {};
    }

    function renderDebugPanel() {
        if (!appState.isDebugMode) {
            debugPanel.classList.add('hidden');
            return;
        }

        debugPanel.classList.remove('hidden');
        debugWarningsContainer.innerHTML = '';
        debugGrid.innerHTML = '';

        if (debugContext.missingExpectedCols.length > 0) {
            debugWarningsContainer.classList.remove('hidden');
            debugContext.missingExpectedCols.forEach(missingCol => {
                const warnCard = document.createElement('div');
                warnCard.className = 'debug-warning-card';
                warnCard.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span><strong>Aviso de Diagnóstico:</strong> Coluna esperada não encontrada na 1ª linha pós-limpeza: <code>${missingCol}</code></span>
                `;
                debugWarningsContainer.appendChild(warnCard);
            });
        } else {
            debugWarningsContainer.classList.add('hidden');
        }

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

        const cardHeaders = document.createElement('div');
        cardHeaders.className = 'debug-card';
        const normItems = debugContext.officialPostStep4Headers.map(item => {
            return `<div><strong>Coluna ${item.letter}:</strong> "${item.original}" ➔ <code>"${item.normalized}"</code></div>`;
        }).join('');
        cardHeaders.innerHTML = `
            <div class="debug-card-title">2. Cabeçalhos da 1ª Linha (Pós-Passo 4)</div>
            <div class="debug-log-box">${normItems || 'Nenhum cabeçalho identificado'}</div>
        `;

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

        const cardRenames = document.createElement('div');
        cardRenames.className = 'debug-card';
        const renameLogs = debugContext.renamedColsLog.map(item => `<div>• Coluna ${item.letter}: <code>"${item.original}"</code> ➔ <strong>${item.renamed}</strong></div>`).join('');
        cardRenames.innerHTML = `
            <div class="debug-card-title">4. Renomeação da 1ª Linha</div>
            <div class="debug-log-box">${renameLogs || 'Nenhuma coluna renomeada'}</div>
        `;

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
    // 4. MOTOR DE REGRAS & PIPELINES (Treatment Pipeline Engine)
    // ------------------------------------------------------------------------

    /**
     * ETAPA 2: Remover as `count` primeiras linhas (Configurável via LINHAS_INICIAIS_REMOVIDAS).
     */
    function removeTopRowsRule(matrix, count = LINHAS_INICIAIS_REMOVIDAS) {
        if (!matrix || matrix.length <= count) {
            debugContext.removedTopRowsCount = matrix ? matrix.length : 0;
            const res = [];
            recordStepSnapshot(2, `Após remover as ${count} primeiras linhas`, res);
            addInspectorLog(`${count} primeiras linhas removidas do topo da planilha.`);
            return res;
        }

        debugContext.removedTopRowsCount = count;
        const res = matrix.slice(count);

        recordStepSnapshot(2, `Após remover as ${count} primeiras linhas`, res);
        addInspectorLog(`✔ ${count} primeiras linhas removidas.`);
        return res;
    }

    // ETAPA 3: Remover colunas vazias
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

        debugContext.removedEmptyColsCount = removedEmptyColsLetters.length;
        const res = matrix.map(row => nonArrayColIndices.map(colIdx => row[colIdx]));

        recordStepSnapshot(3, "Após remover as colunas completamente vazias", res, {
            removedEmptyCols: removedEmptyColsLetters
        });
        addInspectorLog(`✔ ${removedEmptyColsLetters.length} colunas vazias removidas.`, true, removedEmptyColsLetters.join(', '));
        return res;
    }

    // ETAPA 4: Remover colunas J, I, H, G, A
    function removeSpecificColumnsByLetterRule(matrix, lettersOrder = ['J', 'I', 'H', 'G', 'A']) {
        if (!matrix || matrix.length === 0) return [];

        let currentMatrix = matrix.map(row => [...row]);
        debugContext.removedSpecificColsLog = [];
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

                    debugContext.removedSpecificColsLog.push(letter);
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

    // ETAPA 5: Remover 2 últimas linhas
    function removeBottomRowsRule(matrix, count = 2) {
        if (!matrix || matrix.length <= count) {
            debugContext.removedBottomRowsCount = matrix ? matrix.length : 0;
            const res = [];
            recordStepSnapshot(5, "Após remover as duas últimas linhas", res);
            addInspectorLog("2 últimas linhas removidas.");
            return res;
        }

        debugContext.removedBottomRowsCount = count;
        const res = matrix.slice(0, matrix.length - count);

        recordStepSnapshot(5, "Após remover as duas últimas linhas", res);
        addInspectorLog("✔ 2 últimas linhas do rodapé removidas.");
        return res;
    }

    function inspectAndLogOfficialHeaders(matrix) {
        if (!matrix || matrix.length === 0) return matrix;

        const officialRow = matrix[0] || [];
        debugContext.officialPostStep4Headers = [];

        console.log("%c[SIGA Pipeline] Cabeçalhos encontrados na 1ª linha tratada (Pós-Passo 4):", "color: #2563eb; font-weight: bold; font-size: 13px;");

        officialRow.forEach((cellVal, colIdx) => {
            const letter = getExcelColumnName(colIdx);
            const originalVal = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : '';
            const normVal = normalizeHeaderName(originalVal);

            console.log(`  Coluna ${letter} (índice ${colIdx}) ➔ "${originalVal}" [Normalizado: "${normVal}"]`);

            debugContext.officialPostStep4Headers.push({
                letter: letter,
                colIndex: colIdx,
                original: originalVal,
                normalized: normVal
            });
        });

        addInspectorLog("✔ Cabeçalho da 1ª linha inspecionado e identificado.");
        return matrix;
    }

    // ETAPA 6 & 7: Renomeação e Correspondência
    function standardizeHeaderNamesRule(matrix, nameMap = COLUMN_NAME_MAP) {
        if (!matrix || matrix.length === 0) return [];

        const updatedMatrix = matrix.map(row => [...row]);
        const officialHeaderRow = updatedMatrix[0] || [];

        debugContext.renamedColsLog = [];
        debugContext.missingExpectedCols = [];

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
                debugContext.renamedColsLog.push({
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
                debugContext.missingExpectedCols.push(key);
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

    /**
     * Sequência Oficial Estrita do Pipeline da Planilha do SIGA.
     * Utiliza LINHAS_INICIAIS_REMOVIDAS (4) para a Regra 1.
     */
    const SPREADSHEET_PIPELINES = {
        siga: [
            (matrix) => removeTopRowsRule(matrix, LINHAS_INICIAIS_REMOVIDAS),                // 1. ETAPA 2 (Remover 4 primeiras linhas)
            (matrix) => removeEmptyColumnsRule(matrix),                                       // 2. ETAPA 3
            (matrix) => removeSpecificColumnsByLetterRule(matrix, ['J', 'I', 'H', 'G', 'A']), // 3. ETAPA 4
            (matrix) => removeBottomRowsRule(matrix, 2),                                      // 4. ETAPA 5
            (matrix) => inspectAndLogOfficialHeaders(matrix),                                // Inspeção de Cabeçalho
            (matrix) => standardizeHeaderNamesRule(matrix, COLUMN_NAME_MAP)                   // 5. ETAPAS 6 & 7
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
    // 5. MÓDULO DO RESUMO FINANCEIRO (Financial Summary Engine)
    // ------------------------------------------------------------------------

    function calculateFinancialSummary(matrix) {
        if (!matrix || matrix.length <= 1) return {};

        const headerRow = matrix[0] || [];
        const dataRows = matrix.slice(1);
        const validStandardNames = Array.from(new Set(Object.values(COLUMN_NAME_MAP)));

        const categoryTotals = {};
        const groupedCategories = [];
        const equations = [];
        debugContext.groupedCategoriesLog = [];

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
                    debugContext.groupedCategoriesLog.push(trimmedName);
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
    // 6. GERENCIAMENTO DO MODAL DE SELEÇÃO (Modal Controller)
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

        recordStepSnapshot(1, "Planilha original importada", appState.rawMatrixData);
        addInspectorLog("✔ Arquivo lido e carregado com sucesso pelo SheetJS.");

        const treated = runTreatmentPipeline('siga', appState.rawMatrixData);
        appState.treatedMatrixData = treated;

        const summaryData = calculateFinancialSummary(treated);
        appState.summaryData = summaryData;

        renderFinancialSummaryCards(summaryData);
        renderSpreadsheetTable(treated);
        renderDebugPanel();
        renderInspectorUI();

        viewTabsBar.classList.remove('hidden');
    }

    // ------------------------------------------------------------------------
    // 7. INTERFACE & NAVEGAÇÃO POR ABAS (UI & Tab Controller)
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
    }

    function initEvents() {
        fileInput.addEventListener('change', handleFileSelect);
        btnRemoveFile.addEventListener('click', resetView);

        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);

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
        resetInspectorData();

        tableHead.innerHTML = '';
        tableBody.innerHTML = '';
        summaryGrid.innerHTML = '';
        inspectorStepsContainer.innerHTML = '';
        inspectorLogTimeline.innerHTML = '';

        viewTabsBar.classList.add('hidden');
        summaryContainer.classList.add('hidden');
        tableWrapper.classList.add('hidden');
        debugPanel.classList.add('hidden');

        appState.activeTab = 'viewer';
        btnTabViewer.classList.add('active');
        btnTabInspector.classList.remove('active');
        viewerTabContent.classList.remove('hidden');
        inspectorTabContent.classList.add('hidden');

        emptyState.classList.remove('hidden');
        closeTypeModal();
    }

    // ------------------------------------------------------------------------
    // 8. LEITURA DE ARQUIVO (Spreadsheet Reader)
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
                    resetInspectorData();

                    appState.rawMatrixData = rawMatrix;

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
    // 9. RENDERIZAÇÃO DA TABELA (Table Renderer)
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
