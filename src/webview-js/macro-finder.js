const vscode = acquireVsCodeApi();

document.getElementById('refreshBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'refreshMacros' });
});

document.getElementById('macroTypeFilter').addEventListener('change', (e) => {
    vscode.postMessage({ type: 'filterChanged', filter: e.target.value });
});

function attachEventListeners() {
    document.querySelectorAll('.insert-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'insertMacro', macro: JSON.parse(btn.dataset.macro) });
        });
    });
    document.querySelectorAll('.go-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'goToMacro', macro: JSON.parse(btn.dataset.macro) });
        });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'deleteMacro', macro: JSON.parse(btn.dataset.macro) });
        });
    });
    document.querySelectorAll('.save-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({ type: 'saveMacro', macro: JSON.parse(btn.dataset.macro) });
        });
    });
}

function escapeForAttribute(obj) {
    return JSON.stringify(obj).replace(/"/g, '&quot;');
}

function checkCanConvertToSignature(macro) {
    const pathPatterns = [
        /\\\\includegraphics/,
        /\\\\input/,
        /\\\\include/,
        /PATH/i,
        /\\{[^}]*\\.(png|jpg|jpeg|pdf|eps|svg)[^}]*\\}/i,
        /\\{[^}]*\\\/[^}]*\\}/
    ];
    return pathPatterns.some(pattern => pattern.test(macro.definition));
}

function updateFilterOptions(allGroups) {
    const filter = document.getElementById('macroTypeFilter');
    const currentValue = filter.value;
    
    const options = [
        { value: 'all', text: `All types (${allGroups.reduce((sum, g) => sum + g.macros.length, 0)})` },
        { value: 'newcommand', text: `\\newcommand (${allGroups.find(g => g.type === 'newcommand')?.macros.length || 0})` },
        { value: 'newcommand*', text: `\\newcommand* (${allGroups.find(g => g.type === 'newcommand*')?.macros.length || 0})` },
        { value: 'renewcommand', text: `\\renewcommand (${allGroups.find(g => g.type === 'renewcommand')?.macros.length || 0})` },
        { value: 'renewcommand*', text: `\\renewcommand* (${allGroups.find(g => g.type === 'renewcommand*')?.macros.length || 0})` },
        { value: 'def', text: `\\def (${allGroups.find(g => g.type === 'def')?.macros.length || 0})` }
    ];
    
    const availableOptions = options.filter(opt => 
        opt.value === 'all' || 
        allGroups.some(g => g.type === opt.value && g.macros.length > 0)
    );
    
    filter.innerHTML = availableOptions.map(opt => 
        `<vscode-option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${opt.text}</vscode-option>`
    ).join('');
}

function renderMacroGroups(groups, allGroups) {
    const container = document.getElementById('macroGroups');
    
    if (allGroups) {
        updateFilterOptions(allGroups);
    }
    
    if (!groups || groups.length === 0) {
        container.innerHTML = '<div class="no-macros">No macros found for selected filter</div>';
        return;
    }
    
    container.innerHTML = groups.map(group =>
        `<div class="group-section">
            <div class="group-header">${group.icon} ${group.displayName} (${group.macros.length})</div>
            ${group.macros.map(m => {
                const fileName = m.location.file.split('/').pop() || '';
                const parametersText = m.parameters > 0 ? `<span class="parameters">${m.parameters} params</span>` : '';
                const usageExample = `\\${m.name}` + 
                    Array.from({ length: m.parameters }, (_, i) => `{arg${i + 1}}`).join('');
                const canConvert = checkCanConvertToSignature(m);
                const saveButton = canConvert ? 
                    `<vscode-button class="save-btn" data-macro="${escapeForAttribute(m)}">💾 Save Macro</vscode-button>` : '';
                return `<div class="macro-item">
                    <div class="macro-header">
                        <span class="macro-name">\\${m.name}</span>
                        ${parametersText}
                    </div>
                    <div class="macro-usage">Usage: ${usageExample}</div>
                    <div class="macro-definition">${m.definition}</div>
                    <div class="macro-location">📁 ${fileName}:${m.location.line}</div>
                    <div class="macro-actions">
                        <vscode-button class="insert-btn" appearance="primary" data-macro="${escapeForAttribute(m)}">➕ Insert</vscode-button>
                        <vscode-button class="go-btn" appearance="secondary" data-macro="${escapeForAttribute(m)}">📍 Go</vscode-button>
                        ${saveButton}
                        <vscode-button class="delete-btn" data-macro="${escapeForAttribute(m)}">🗑️ Delete</vscode-button>
                    </div>
                </div>`;
            }).join('')}
        </div>`
    ).join('');
    
    attachEventListeners();
}

window.addEventListener('message', event => {
    if (event.data.type === 'updateMacroGroups') {
        renderMacroGroups(event.data.groups, event.data.allGroups);
    }
});

vscode.postMessage({ type: 'refreshMacros' });
