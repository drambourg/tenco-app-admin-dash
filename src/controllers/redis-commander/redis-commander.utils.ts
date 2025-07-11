// src/controllers/redis-commander/redis-commander.utils.ts
// Remplacer complètement la fonction getRedisCommanderHTML par celle-ci :

function getRedisCommanderHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redis Commander</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            color: #333;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            position: relative;
        }

        .header h1 {
            font-size: 1.8rem;
            font-weight: 300;
            text-align: center;
        }

        .home-link {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: white;
            text-decoration: none;
            font-size: 1.5rem;
            transition: transform 0.3s ease;
        }

        .home-link:hover {
            transform: translateY(-50%) scale(1.2);
            color: #f0f0f0;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }

        .stat-card h3 {
            color: #666;
            font-size: 0.9rem;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
        }

        .stat-card .value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #333;
        }

        .controls {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }

        .controls-row {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .form-group label {
            font-size: 0.9rem;
            color: #666;
            font-weight: 500;
        }

        input, select, button, textarea {
            padding: 0.75rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 0.9rem;
        }

        input:focus, select:focus, textarea:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
        }

        button {
            background: #667eea;
            color: white;
            border: none;
            cursor: pointer;
            transition: background-color 0.2s;
            min-width: 100px;
        }

        button:hover {
            background: #5a6fd8;
        }

        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        .content-grid {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 2rem;
        }

        .sidebar {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .sidebar-header {
            background: #f8f9fa;
            padding: 1rem;
            border-bottom: 1px solid #e9ecef;
            font-weight: 600;
        }

        .key-list {
            max-height: 600px;
            overflow-y: auto;
        }

        .key-item {
            padding: 0.75rem;
            border-bottom: 1px solid #f0f0f0;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .key-item:hover {
            background-color: #f8f9fa;
        }

        .key-item.selected {
            background-color: #e3f2fd;
            border-left: 3px solid #667eea;
        }

        .key-name {
            font-weight: 500;
            margin-bottom: 0.25rem;
        }

        .key-meta {
            font-size: 0.8rem;
            color: #666;
        }

        .main-content {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }

        .content-header {
            background: #f8f9fa;
            padding: 1rem;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .content-body {
            padding: 1.5rem;
        }

        .value-display {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 1rem;
            font-family: 'Courier New', monospace;
            white-space: pre-wrap;
            overflow-x: auto;
            max-height: 500px;
            overflow-y: auto;
            margin-bottom: 1rem;
        }

        .value-editor {
            width: 100%;
            min-height: 200px;
            font-family: 'Courier New', monospace;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 1rem;
            margin-bottom: 1rem;
        }

        .editor-controls {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .edit-mode {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 1rem;
            margin-bottom: 1rem;
        }

        .type-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            background: #667eea;
            color: white;
            border-radius: 12px;
            font-size: 0.75rem;
            margin-right: 0.5rem;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: #666;
        }

        .error {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            color: #c53030;
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
        }

        .success {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            color: #2f855a;
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 1rem;
        }

        .empty-state {
            text-align: center;
            padding: 3rem;
            color: #666;
        }

        .empty-state h3 {
            margin-bottom: 1rem;
            color: #999;
        }

        .patterns-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .pattern-card {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-left: 3px solid #667eea;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .pattern-card:hover {
            transform: translateY(-2px);
        }

        .pattern-name {
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .pattern-count {
            color: #667eea;
            font-weight: 500;
        }

        .pattern-desc {
            font-size: 0.85rem;
            color: #666;
            margin-top: 0.25rem;
        }

        @media (max-width: 768px) {
            .content-grid {
                grid-template-columns: 1fr;
            }
            
            .controls-row {
                flex-direction: column;
                align-items: stretch;
            }
            
            .stats-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <a href="/" class="home-link" title="Retour à l'accueil">🏠</a>
        <h1>🗃️ Redis Commander</h1>
    </div>

    <div class="container">
        <!-- Statistics -->
        <div class="stats-grid" id="statsGrid">
            <div class="stat-card">
                <h3>Total Keys</h3>
                <div class="value" id="totalKeys">-</div>
            </div>
            <div class="stat-card">
                <h3>Hit Rate</h3>
                <div class="value" id="hitRate">-</div>
            </div>
            <div class="stat-card">
                <h3>Memory Used</h3>
                <div class="value" id="memoryUsed">-</div>
            </div>
            <div class="stat-card">
                <h3>Connected Clients</h3>
                <div class="value" id="connectedClients">-</div>
            </div>
            <div class="stat-card">
                <h3>Redis Version</h3>
                <div class="value" id="redisVersion">-</div>
            </div>
            <div class="stat-card">
                <h3>Uptime</h3>
                <div class="value" id="uptime">-</div>
            </div>
        </div>

        <!-- Controls -->
        <div class="controls">
            <div class="controls-row">
                <div class="form-group">
                    <label>Database</label>
                    <select id="databaseSelect">
                        <option value="0">DB 0</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Key Pattern</label>
                    <input type="text" id="patternInput" value="*" placeholder="e.g. user:*">
                </div>
                <div class="form-group">
                    <label>Limit</label>
                    <input type="number" id="limitInput" value="100" min="1" max="1000">
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button onclick="loadKeys()">🔍 Search</button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button onclick="refreshStats()">🔄 Refresh</button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button onclick="deleteByPattern()" style="background: #dc3545;">
                        🗑️ Delete Pattern
                    </button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button onclick="clearCurrentDatabase()" style="background: #dc3545;">
                        💥 Clear DB
                    </button>
                </div>
                <div class="form-group">
                    <label>&nbsp;</label>
                    <button onclick="clearAllDatabases()" style="background: #dc3545;">
                        ⚠️ Clear All
                    </button>
                </div>
            </div>
        </div>

        <!-- Key Patterns -->
        <div class="patterns-grid" id="patternsGrid"></div>

        <!-- Main Content -->
        <div class="content-grid">
            <!-- Sidebar -->
            <div class="sidebar">
                <div class="sidebar-header">
                    Keys (<span id="keyCount">0</span>)
                </div>
                <div class="key-list" id="keyList">
                    <div class="empty-state">
                        <h3>No keys found</h3>
                        <p>Try adjusting your search pattern</p>
                    </div>
                </div>
            </div>

            <!-- Main Content -->
            <div class="main-content">
                <div class="content-header">
                    <div>
                        <span id="selectedKeyName">Select a key to view its value</span>
                        <span id="selectedKeyType"></span>
                    </div>
                    <div>
                        <button id="editBtn" onclick="toggleEditMode()" style="background: #28a745; display: none;">
                            ✏️ Edit
                        </button>
                        <button id="deleteBtn" onclick="deleteCurrentKey()" style="background: #dc3545; display: none;">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
                <div class="content-body">
                    <div id="statusMessage" style="display: none;"></div>
                    <div id="keyValue" class="empty-state">
                        <h3>Welcome to Redis Commander</h3>
                        <p>Select a key from the sidebar to view its content</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const API_BASE = '/redis-commander';
        let currentKey = null;
        let currentDatabase = 0;
        let isEditMode = false;
        let currentKeyData = null;

        // Initialize the application
        async function init() {
            await refreshStats();
            await loadDatabases();
            await loadKeyPatterns();
            await loadKeys();
        }

        // Show status message
        function showMessage(message, type = 'success') {
            const messageDiv = document.getElementById('statusMessage');
            messageDiv.className = type;
            messageDiv.textContent = message;
            messageDiv.style.display = 'block';
            
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        }

        // Toggle edit mode
        function toggleEditMode() {
            if (!currentKey || !currentKeyData) return;
            
            isEditMode = !isEditMode;
            const editBtn = document.getElementById('editBtn');
            
            if (isEditMode) {
                showEditInterface();
                editBtn.textContent = '❌ Cancel';
                editBtn.style.background = '#dc3545';
            } else {
                showViewInterface();
                editBtn.textContent = '✏️ Edit';
                editBtn.style.background = '#28a745';
            }
        }

        // Show edit interface
        function showEditInterface() {
            const keyValue = document.getElementById('keyValue');
            
            let currentValue = currentKeyData.value;
            if (typeof currentValue === 'object') {
                currentValue = JSON.stringify(currentValue, null, 2);
            }
            
            keyValue.innerHTML = \`
                <div class="edit-mode">
                    <h4>✏️ Editing: \${currentKey}</h4>
                    <p>Modify the value below and click Save. JSON objects will be automatically parsed.</p>
                </div>
                <div class="editor-controls">
                    <button onclick="saveValue()" style="background: #28a745;">💾 Save</button>
                    <button onclick="toggleEditMode()" style="background: #6c757d;">❌ Cancel</button>
                </div>
                <textarea class="value-editor" id="valueEditor" placeholder="Enter new value...">\${currentValue}</textarea>
                <div style="margin-bottom: 1rem;">
                    <strong>Type:</strong> \${currentKeyData.type} | 
                    <strong>TTL:</strong> \${currentKeyData.ttl === -1 ? 'No expiry' : currentKeyData.ttl + ' seconds'} | 
                    <strong>Size:</strong> \${currentKeyData.size}
                </div>
            \`;
        }

        // Show view interface
        function showViewInterface() {
            if (currentKeyData) {
                displayKeyValue(currentKeyData);
            }
        }

        // Save edited value
        async function saveValue() {
            const editor = document.getElementById('valueEditor');
            let newValue = editor.value;
            
            if (!newValue && newValue !== '') {
                showMessage('Value cannot be empty', 'error');
                return;
            }
            
            // Try to parse as JSON if it looks like JSON
            try {
                if ((newValue.startsWith('{') && newValue.endsWith('}')) || 
                    (newValue.startsWith('[') && newValue.endsWith(']'))) {
                    // Test if it's valid JSON
                    JSON.parse(newValue);
                    // Keep as string for Redis, but validate it's proper JSON
                }
            } catch (e) {
                if (!confirm('The value doesn\\'t appear to be valid JSON. Save as plain text?')) {
                    return;
                }
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/key/\${encodeURIComponent(currentKey)}?database=\${currentDatabase}\`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ value: newValue })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showMessage('Value updated successfully!', 'success');
                    
                    // Refresh the key value
                    await selectKeyById(currentKey);
                    
                    // Exit edit mode
                    isEditMode = false;
                    const editBtn = document.getElementById('editBtn');
                    editBtn.textContent = '✏️ Edit';
                    editBtn.style.background = '#28a745';
                    
                    // Refresh key list to update size/type if changed
                    await loadKeys();
                } else {
                    showMessage(\`Error updating value: \${result.error}\`, 'error');
                }
            } catch (error) {
                showMessage(\`Error updating value: \${error.message}\`, 'error');
            }
        }

        // Select key by ID (for refresh after edit)
        async function selectKeyById(keyName) {
            currentKey = keyName;
            document.getElementById('selectedKeyName').textContent = keyName;
            document.getElementById('editBtn').style.display = 'block';
            document.getElementById('deleteBtn').style.display = 'block';
            
            // Load key value
            try {
                document.getElementById('keyValue').innerHTML = '<div class="loading">Loading value...</div>';
                
                const response = await fetch(\`\${API_BASE}/key/\${encodeURIComponent(keyName)}?database=\${currentDatabase}\`);
                const result = await response.json();
                
                if (result.success) {
                    currentKeyData = result.data;
                    displayKeyValue(result.data);
                } else {
                    document.getElementById('keyValue').innerHTML = \`<div class="error">Error: \${result.error}</div>\`;
                }
            } catch (error) {
                document.getElementById('keyValue').innerHTML = \`<div class="error">Error loading value: \${error.message}</div>\`;
            }
        }

        // Load Redis statistics
        async function refreshStats() {
            try {
                const response = await fetch(API_BASE + '/stats');
                const result = await response.json();
                
                if (result.success) {
                    const stats = result.data;
                    document.getElementById('totalKeys').textContent = stats.totalKeys.toLocaleString();
                    document.getElementById('hitRate').textContent = stats.hitRate.toFixed(1) + '%';
                    document.getElementById('memoryUsed').textContent = formatBytes(stats.totalMemory.used);
                    document.getElementById('connectedClients').textContent = stats.connectedClients;
                    document.getElementById('redisVersion').textContent = stats.version;
                    document.getElementById('uptime').textContent = formatUptime(stats.uptime);
                }
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        // Load available databases
        async function loadDatabases() {
            try {
                const response = await fetch(API_BASE + '/databases');
                const result = await response.json();
                
                if (result.success) {
                    const select = document.getElementById('databaseSelect');
                    select.innerHTML = '';
                    
                    result.data.forEach(db => {
                        const option = document.createElement('option');
                        option.value = db.db;
                        option.textContent = \`DB \${db.db} (\${db.keyCount} keys)\`;
                        select.appendChild(option);
                    });

                    select.addEventListener('change', (e) => {
                        currentDatabase = parseInt(e.target.value);
                        loadKeys();
                        loadKeyPatterns();
                    });
                }
            } catch (error) {
                console.error('Error loading databases:', error);
            }
        }

        // Load key patterns
        async function loadKeyPatterns() {
            try {
                const response = await fetch(\`\${API_BASE}/patterns?database=\${currentDatabase}\`);
                const result = await response.json();
                
                if (result.success) {
                    const grid = document.getElementById('patternsGrid');
                    grid.innerHTML = '';
                    
                    result.data.slice(0, 8).forEach(pattern => {
                        const card = document.createElement('div');
                        card.className = 'pattern-card';
                        card.onclick = () => {
                            document.getElementById('patternInput').value = pattern.pattern;
                            loadKeys();
                        };
                        
                        card.innerHTML = \`
                            <div class="pattern-name">\${pattern.pattern}</div>
                            <div class="pattern-count">\${pattern.count} keys</div>
                            <div class="pattern-desc">\${pattern.description}</div>
                        \`;
                        grid.appendChild(card);
                    });
                }
            } catch (error) {
                console.error('Error loading patterns:', error);
            }
        }

        // Load keys
        async function loadKeys() {
            const pattern = document.getElementById('patternInput').value || '*';
            const limit = document.getElementById('limitInput').value || 100;
            
            try {
                document.getElementById('keyList').innerHTML = '<div class="loading">Loading keys...</div>';
                
                const response = await fetch(\`\${API_BASE}/keys?database=\${currentDatabase}&pattern=\${encodeURIComponent(pattern)}&limit=\${limit}\`);
                const result = await response.json();
                
                if (result.success) {
                    displayKeys(result.data);
                } else {
                    document.getElementById('keyList').innerHTML = \`<div class="error">Error: \${result.error}</div>\`;
                }
            } catch (error) {
                document.getElementById('keyList').innerHTML = \`<div class="error">Error loading keys: \${error.message}</div>\`;
            }
        }

        // Display keys in sidebar
        function displayKeys(keys) {
            const keyList = document.getElementById('keyList');
            const keyCount = document.getElementById('keyCount');
            
            keyCount.textContent = keys.length;
            
            if (keys.length === 0) {
                keyList.innerHTML = \`
                    <div class="empty-state">
                        <h3>No keys found</h3>
                        <p>Try adjusting your search pattern</p>
                    </div>
                \`;
                return;
            }
            
            keyList.innerHTML = '';
            
            keys.forEach(key => {
                const keyItem = document.createElement('div');
                keyItem.className = 'key-item';
                keyItem.onclick = () => selectKey(key.key, keyItem);
                
                keyItem.innerHTML = \`
                    <div class="key-name">\${key.key}</div>
                    <div class="key-meta">
                        <span class="type-badge">\${key.type}</span>
                        Size: \${key.size} | TTL: \${key.ttl === -1 ? 'No expiry' : key.ttl + 's'}
                    </div>
                \`;
                
                keyList.appendChild(keyItem);
            });
        }

        // Select a key and load its value
        async function selectKey(keyName, element) {
            // Reset edit mode if active
            if (isEditMode) {
                isEditMode = false;
                const editBtn = document.getElementById('editBtn');
                editBtn.textContent = '✏️ Edit';
                editBtn.style.background = '#28a745';
            }
            
            // Update UI
            document.querySelectorAll('.key-item').forEach(item => item.classList.remove('selected'));
            element.classList.add('selected');
            
            currentKey = keyName;
            document.getElementById('selectedKeyName').textContent = keyName;
            document.getElementById('editBtn').style.display = 'block';
            document.getElementById('deleteBtn').style.display = 'block';
            
            // Load key value
            try {
                document.getElementById('keyValue').innerHTML = '<div class="loading">Loading value...</div>';
                
                const response = await fetch(\`\${API_BASE}/key/\${encodeURIComponent(keyName)}?database=\${currentDatabase}\`);
                const result = await response.json();
                
                if (result.success) {
                    currentKeyData = result.data;
                    displayKeyValue(result.data);
                } else {
                    document.getElementById('keyValue').innerHTML = \`<div class="error">Error: \${result.error}</div>\`;
                }
            } catch (error) {
                document.getElementById('keyValue').innerHTML = \`<div class="error">Error loading value: \${error.message}</div>\`;
            }
        }

        // Display key value
        function displayKeyValue(data) {
            const typeElement = document.getElementById('selectedKeyType');
            typeElement.innerHTML = \`<span class="type-badge">\${data.type}</span>\`;
            
            let formattedValue;
            
            try {
                // Format value based on type
                switch (data.type) {
                    case 'string':
                        formattedValue = typeof data.value === 'object' 
                            ? JSON.stringify(data.value, null, 2)
                            : data.value;
                        break;
                    case 'hash':
                    case 'set':
                    case 'zset':
                    case 'list':
                        formattedValue = JSON.stringify(data.value, null, 2);
                        break;
                    default:
                        formattedValue = String(data.value);
                }
            } catch (error) {
                formattedValue = String(data.value);
            }
            
            document.getElementById('keyValue').innerHTML = \`
                <div style="margin-bottom: 1rem;">
                    <strong>Type:</strong> \${data.type} | 
                    <strong>TTL:</strong> \${data.ttl === -1 ? 'No expiry' : data.ttl + ' seconds'} | 
                    <strong>Size:</strong> \${data.size}
                </div>
                <div class="value-display">\${formattedValue}</div>
            \`;
        }

        // Delete current key
        async function deleteCurrentKey() {
            if (!currentKey) return;
            
            if (!confirm(\`Are you sure you want to delete key: \${currentKey}?\`)) {
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/key/\${encodeURIComponent(currentKey)}?database=\${currentDatabase}\`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.success) {
                    showMessage('Key deleted successfully', 'success');
                    currentKey = null;
                    currentKeyData = null;
                    document.getElementById('selectedKeyName').textContent = 'Select a key to view its value';
                    document.getElementById('selectedKeyType').innerHTML = '';
                    document.getElementById('editBtn').style.display = 'none';
                    document.getElementById('deleteBtn').style.display = 'none';
                    document.getElementById('keyValue').innerHTML = \`
                        <div class="empty-state">
                            <h3>Key deleted</h3>
                            <p>Select another key to view its content</p>
                        </div>
                    \`;
                    await loadKeys(); // Refresh key list
                    await refreshStats(); // Refresh stats
                } else {
                    showMessage(\`Error deleting key: \${result.error}\`, 'error');
                }
            } catch (error) {
                showMessage(\`Error deleting key: \${error.message}\`, 'error');
            }
        }

        // Delete keys by pattern
        async function deleteByPattern() {
            const pattern = document.getElementById('patternInput').value || '*';
            
            if (!confirm(\`Are you sure you want to delete ALL keys matching pattern: \${pattern}?\\n\\nThis action cannot be undone!\`)) {
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/keys/pattern?database=\${currentDatabase}\`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ pattern })
                });
                const result = await response.json();
                
                if (result.success) {
                    showMessage(\`Successfully deleted \${result.data.deletedCount} keys\`, 'success');
                    await loadKeys();
                    await refreshStats();
                    await loadKeyPatterns();
                    // Clear selected key if it was deleted
                    currentKey = null;
                    currentKeyData = null;
                    document.getElementById('selectedKeyName').textContent = 'Select a key to view its value';
                    document.getElementById('selectedKeyType').innerHTML = '';
                    document.getElementById('editBtn').style.display = 'none';
                    document.getElementById('deleteBtn').style.display = 'none';
                    document.getElementById('keyValue').innerHTML = \`
                        <div class="empty-state">
                            <h3>Keys deleted</h3>
                            <p>Select a key to view its content</p>
                        </div>
                    \`;
                } else {
                    showMessage(\`Error deleting keys: \${result.error}\`, 'error');
                }
            } catch (error) {
                showMessage(\`Error deleting keys: \${error.message}\`, 'error');
            }
        }

        // Clear current database
        async function clearCurrentDatabase() {
            if (!confirm(\`Are you sure you want to CLEAR ALL KEYS in database \${currentDatabase}?\\n\\nThis action cannot be undone!\`)) {
                return;
            }
            
            if (!confirm(\`This will delete EVERYTHING in database \${currentDatabase}. Are you absolutely sure?\`)) {
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/database/clear?database=\${currentDatabase}\`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.success) {
                    showMessage(\`Database \${currentDatabase} cleared successfully\`, 'success');
                    await loadKeys();
                    await refreshStats();
                    await loadDatabases();
                    await loadKeyPatterns();
                    // Reset UI
                    currentKey = null;
                    currentKeyData = null;
                    document.getElementById('selectedKeyName').textContent = 'Select a key to view its value';
                    document.getElementById('selectedKeyType').innerHTML = '';
                    document.getElementById('editBtn').style.display = 'none';
                    document.getElementById('deleteBtn').style.display = 'none';
                    document.getElementById('keyValue').innerHTML = \`
                        <div class="empty-state">
                            <h3>Database cleared</h3>
                            <p>The database is now empty</p>
                        </div>
                    \`;
                } else {
                    showMessage(\`Error clearing database: \${result.error}\`, 'error');
                }
            } catch (error) {
                showMessage(\`Error clearing database: \${error.message}\`, 'error');
            }
        }

        // Clear all databases
        async function clearAllDatabases() {
            if (!confirm('Are you sure you want to CLEAR ALL DATABASES?\\n\\nThis will delete EVERYTHING in Redis!\\n\\nThis action cannot be undone!')) {
                return;
            }
            
            const confirmation = prompt('Type "DELETE ALL" to confirm:');
            if (confirmation !== 'DELETE ALL') {
                showMessage('Operation cancelled', 'error');
                return;
            }
            
            try {
                const response = await fetch(\`\${API_BASE}/databases/clear\`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                
                if (result.success) {
                    showMessage('All databases cleared successfully', 'success');
                    await loadKeys();
                    await refreshStats();
                    await loadDatabases();
                    await loadKeyPatterns();
                    // Reset UI
                    currentKey = null;
                    currentKeyData = null;
                    document.getElementById('selectedKeyName').textContent = 'Select a key to view its value';
                    document.getElementById('selectedKeyType').innerHTML = '';
                    document.getElementById('editBtn').style.display = 'none';
                    document.getElementById('deleteBtn').style.display = 'none';
                    document.getElementById('keyValue').innerHTML = \`
                        <div class="empty-state">
                            <h3>All databases cleared</h3>
                            <p>Redis is now completely empty</p>
                        </div>
                    \`;
                } else {
                    showMessage(\`Error clearing databases: \${result.error}\`, 'error');
                }
            } catch (error) {
                showMessage(\`Error clearing databases: \${error.message}\`, 'error');
            }
        }

        // Utility functions
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        function formatUptime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (days > 0) {
                return \`\${days}d \${hours}h \${minutes}m\`;
            } else if (hours > 0) {
                return \`\${hours}h \${minutes}m\`;
            } else {
                return \`\${minutes}m\`;
            }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', init);

        // Auto-refresh stats every 30 seconds
        setInterval(refreshStats, 30000);
    </script>
</body>
</html>`;
}

// eslint-disable-next-line import/prefer-default-export
export { getRedisCommanderHTML };
