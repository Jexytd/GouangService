// Whitelist Admin Dashboard Controller
let adminSecret = localStorage.getItem('ricoh_admin_secret') || '';

// DOM Elements
const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const secretInput = document.getElementById('admin-secret-input');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

const navItems = document.querySelectorAll('.nav-item');
const tabPanels = document.querySelectorAll('.tab-panel');
const pageTitle = document.getElementById('page-title');

const openGenModalBtn = document.getElementById('open-gen-modal-btn');
const genModal = document.getElementById('gen-modal');
const closeGenModal = document.getElementById('close-gen-modal');
const genKeyForm = document.getElementById('gen-key-form');
const genResult = document.getElementById('gen-result');
const genKeysList = document.getElementById('gen-keys-list');

const keysTableBody = document.getElementById('keys-table-body');
const keysSearchInput = document.getElementById('keys-search-input');
const keysStatusFilter = document.getElementById('keys-status-filter');
const keysTierFilter = document.getElementById('keys-tier-filter');

const globalKeyForm = document.getElementById('global-key-form');
const gkEnableSwitch = document.getElementById('gk-enable-switch');
const gkKeyInput = document.getElementById('gk-key-input');
const gkFeaturesInput = document.getElementById('gk-features-input');
const gkNoteInput = document.getElementById('gk-note-input');

const logsTableBody = document.getElementById('logs-table-body');

// Helper for authenticated API calls
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`
    };

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(endpoint, options);
    if (res.status === 401) {
        showLogin();
        throw new Error('Unauthorized');
    }
    return res.json();
}

function showLogin() {
    loginModal.classList.add('active');
}

function hideLogin() {
    loginModal.classList.remove('active');
}

// Authentication Check
async function initAuth() {
    if (!adminSecret) {
        showLogin();
        return;
    }

    try {
        const res = await apiCall('/api/v1/admin/auth/verify', 'POST');
        if (res.success) {
            hideLogin();
            loadOverview();
        } else {
            showLogin();
        }
    } catch {
        showLogin();
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    adminSecret = secretInput.value.trim();
    loginError.classList.add('hidden');

    try {
        const res = await apiCall('/api/v1/admin/auth/verify', 'POST');
        if (res.success) {
            localStorage.setItem('ricoh_admin_secret', adminSecret);
            hideLogin();
            loadOverview();
        } else {
            loginError.textContent = 'Invalid secret password.';
            loginError.classList.remove('hidden');
        }
    } catch {
        loginError.textContent = 'Invalid secret password.';
        loginError.classList.remove('hidden');
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('ricoh_admin_secret');
    adminSecret = '';
    showLogin();
});

// Tab Navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));

        item.classList.add('active');
        const tab = item.getAttribute('data-tab');
        document.getElementById(`tab-${tab}`).classList.add('active');

        const titles = {
            'overview': 'Dashboard Overview',
            'keys': 'License Keys Management',
            'global-key': 'Global Key Configuration',
            'logs': 'Verification Activity Logs'
        };
        pageTitle.textContent = titles[tab] || 'Dashboard';

        if (tab === 'overview') loadOverview();
        if (tab === 'keys') loadKeys();
        if (tab === 'global-key') loadGlobalKey();
        if (tab === 'logs') loadLogs();
    });
});

// 1. Overview Tab
async function loadOverview() {
    try {
        const res = await apiCall('/api/v1/admin/stats');
        if (res.success && res.stats) {
            document.getElementById('stat-total-keys').textContent = res.stats.totalKeys;
            document.getElementById('stat-active-keys').textContent = res.stats.activeKeys;
            document.getElementById('stat-claimed-keys').textContent = res.stats.claimedKeys;
            document.getElementById('stat-bindings').textContent = res.stats.totalBindings;

            const pill = document.getElementById('overview-global-pill');
            const codeBox = document.getElementById('overview-global-key-code');
            codeBox.textContent = res.stats.globalKeyName;

            if (res.stats.globalKeyEnabled) {
                pill.textContent = 'Global Key: Active';
                pill.style.color = '#34d399';
            } else {
                pill.textContent = 'Global Key: Disabled';
                pill.style.color = '#f87171';
            }
        }
    } catch (err) {
        console.error('Failed to load overview:', err);
    }
}

// 2. Keys Tab
async function loadKeys() {
    keysTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading keys...</td></tr>';
    const search = keysSearchInput.value.trim();
    const status = keysStatusFilter.value;
    const tier = keysTierFilter.value;

    const url = `/api/v1/admin/keys?search=${encodeURIComponent(search)}&status=${status}&tier=${tier}`;
    try {
        const res = await apiCall(url);
        if (!res.success || !res.keys.length) {
            keysTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No keys found.</td></tr>';
            return;
        }

        keysTableBody.innerHTML = res.keys.map(k => `
            <tr>
                <td><strong>${k.keyPrefix}</strong></td>
                <td><span class="badge ${k.tier}">${k.tier}</span></td>
                <td><span class="badge ${k.status}">${k.status}</span></td>
                <td>${k.discordId ? `<code>${k.discordId}</code>` : '<span style="color:var(--text-muted)">Unclaimed</span>'}</td>
                <td>${k.bindingsCount} / ${k.maxClients}</td>
                <td>${k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Lifetime'}</td>
                <td>
                    <button class="btn-action-ghost" onclick="resetKeyHwid('${k.id}')">Reset HWID</button>
                    ${k.status === 'active' ? `<button class="btn-danger-ghost" onclick="revokeKey('${k.id}')">Revoke</button>` : ''}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        keysTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Error loading keys.</td></tr>';
    }
}

keysSearchInput.addEventListener('input', debounce(loadKeys, 300));
keysStatusFilter.addEventListener('change', loadKeys);
keysTierFilter.addEventListener('change', loadKeys);

window.resetKeyHwid = async function(id) {
    if (!confirm('Reset all device/HWID bindings for this key?')) return;
    try {
        const res = await apiCall(`/api/v1/admin/keys/${id}/reset`, 'POST');
        alert(res.message);
        loadKeys();
    } catch (e) {
        alert('Failed to reset HWID');
    }
};

window.revokeKey = async function(id) {
    if (!confirm('Are you sure you want to revoke this license key?')) return;
    try {
        await apiCall(`/api/v1/admin/keys/${id}/revoke`, 'POST');
        loadKeys();
    } catch (e) {
        alert('Failed to revoke key');
    }
};

// 3. Global Key Tab
async function loadGlobalKey() {
    try {
        const res = await apiCall('/api/v1/admin/global-key');
        if (res.success && res.globalKey) {
            const gk = res.globalKey;
            gkEnableSwitch.checked = gk.enabled;
            gkKeyInput.value = gk.key;
            gkFeaturesInput.value = (gk.features || []).join(', ');
            gkNoteInput.value = gk.note || '';
        }
    } catch (err) {
        console.error('Failed to load global key:', err);
    }
}

globalKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        enabled: gkEnableSwitch.checked,
        key: gkKeyInput.value.trim(),
        features: gkFeaturesInput.value.split(',').map(s => s.trim()).filter(Boolean),
        note: gkNoteInput.value.trim()
    };

    try {
        const res = await apiCall('/api/v1/admin/global-key', 'PUT', payload);
        if (res.success) {
            alert('Global Key settings updated successfully!');
            loadGlobalKey();
        }
    } catch {
        alert('Failed to save Global Key settings.');
    }
});

// 4. Logs Tab
async function loadLogs() {
    logsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Loading logs...</td></tr>';
    try {
        const res = await apiCall('/api/v1/admin/logs/verification');
        if (!res.success || !res.logs.length) {
            logsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No verification logs recorded.</td></tr>';
            return;
        }

        logsTableBody.innerHTML = res.logs.map(l => `
            <tr>
                <td>${new Date(l.createdAt).toLocaleTimeString()}</td>
                <td><code>${l.keyPrefix || 'UNKNOWN'}</code></td>
                <td><span class="badge ${l.success ? 'active' : 'revoked'}">${l.success ? 'Success' : 'Denied'}</span></td>
                <td>${l.reason}</td>
                <td><span class="badge ${l.tier}">${l.tier}</span></td>
                <td><code>${l.clientIdHash ? l.clientIdHash.substring(0, 12) + '...' : '-'}</code></td>
            </tr>
        `).join('');
    } catch {
        logsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">Error loading logs.</td></tr>';
    }
}

// Key Generator Modal
openGenModalBtn.addEventListener('click', () => {
    genModal.classList.add('active');
    genResult.classList.add('hidden');
});

closeGenModal.addEventListener('click', () => {
    genModal.classList.remove('active');
});

genKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        tier: document.getElementById('gen-tier').value,
        durationDays: parseInt(document.getElementById('gen-duration').value, 10),
        maxClients: parseInt(document.getElementById('gen-max-clients').value, 10),
        count: parseInt(document.getElementById('gen-qty').value, 10),
        note: document.getElementById('gen-note').value.trim()
    };

    try {
        const res = await apiCall('/api/v1/admin/keys', 'POST', payload);
        if (res.success && res.keys) {
            genKeysList.innerHTML = res.keys.map(k => `
                <div class="key-pill">
                    <span>${k.plainKey}</span>
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${k.plainKey}'); this.textContent='Copied!'">Copy</button>
                </div>
            `).join('');
            genResult.classList.remove('hidden');
            loadOverview();
        }
    } catch {
        alert('Failed to generate key.');
    }
});

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Start
initAuth();
