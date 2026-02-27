(() => {
    const API_HOSTS = "/api/host/";
    const API_HOST_TESTS = (id, limit = 20) => `/api/host/${id}/test?limit=${limit}`;
    const REFRESH_MS = 30000;

    const state = {
        hosts: [],
        loading: false,
        timer: null,
    };

    const elements = {
        hostCount: document.getElementById("host-count"),
        hostsTableBody: document.getElementById("hosts-table-body"),
        hostErrors: document.getElementById("host-errors"),
        lastRefresh: document.getElementById("last-refresh"),
        addHostForm: document.getElementById("add-host-form"),
        addFormMessage: document.getElementById("add-form-message"),
        editModal: document.getElementById("edit-modal"),
        editHostForm: document.getElementById("edit-host-form"),
        editFormMessage: document.getElementById("edit-form-message"),
        cancelEditBtn: document.getElementById("cancel-edit-btn"),
    };

    if (!elements.hostsTableBody || !elements.addHostForm || !elements.editHostForm) {
        return;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function getCookie(name) {
        const cookies = document.cookie ? document.cookie.split(";") : [];
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            if (trimmed.startsWith(`${name}=`)) {
                return decodeURIComponent(trimmed.slice(name.length + 1));
            }
        }
        return null;
    }

    function getCsrfToken() {
        const fromCookie = getCookie("csrftoken");
        if (fromCookie) {
            return fromCookie;
        }
        const input = document.querySelector("input[name='csrfmiddlewaretoken']");
        return input ? input.value : "";
    }

    function flattenErrors(payload) {
        if (!payload) {
            return "Request failed.";
        }
        if (typeof payload === "string") {
            return payload;
        }
        if (Array.isArray(payload)) {
            return payload.join(" ");
        }
        if (typeof payload === "object") {
            return Object.entries(payload)
                .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(" ") : errors}`)
                .join(" ");
        }
        return "Request failed.";
    }

    async function requestJson(url, options = {}) {
        const method = options.method || "GET";
        const headers = {
            Accept: "application/json",
            ...(options.headers || {}),
        };

        const fetchOptions = {
            method,
            headers,
            credentials: "same-origin",
        };

        if (options.data !== undefined) {
            headers["Content-Type"] = "application/json";
            fetchOptions.body = JSON.stringify(options.data);
        }

        if (method !== "GET" && method !== "HEAD") {
            headers["X-CSRFToken"] = getCsrfToken();
        }

        const response = await fetch(url, fetchOptions);
        let payload = null;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            payload = await response.json();
        }

        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}`);
            err.status = response.status;
            err.payload = payload;
            throw err;
        }

        return payload;
    }

    function formatDate(value) {
        if (!value) {
            return "-";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return "-";
        }
        return date.toLocaleString();
    }

    function formatRtt(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return "-";
        }
        return `${Number(value).toFixed(2)} ms`;
    }

    function hostStatusBadge(isAlive) {
        if (isAlive === true) {
            return '<span class="badge badge-up">Alive</span>';
        }
        if (isAlive === false) {
            return '<span class="badge badge-down">Down</span>';
        }
        return '<span class="badge badge-unknown">Unknown</span>';
    }

    function traceModeLabel(traceMode) {
        if (traceMode === "always") {
            return "Every poll";
        }
        return "On ping fail";
    }

    function setAlert(element, message) {
        if (!element) {
            return;
        }
        if (!message) {
            element.textContent = "";
            element.classList.add("hidden");
            return;
        }
        element.textContent = message;
        element.classList.remove("hidden");
    }

    function setFormMessage(element, message, type = "") {
        if (!element) {
            return;
        }
        element.textContent = message || "";
        element.classList.remove("error", "success");
        if (type) {
            element.classList.add(type);
        }
    }

    function buildSparkline(tests) {
        const width = 120;
        const height = 36;
        const padding = 3;
        const ordered = [...tests].reverse();
        const values = ordered
            .map((test) => Number(test.avg_rtt))
            .filter((value) => Number.isFinite(value));

        if (values.length < 2) {
            return '<span class="sparkline-empty">No data</span>';
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const step = values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1);
        const points = values.map((value, index) => {
            const x = padding + step * index;
            const y = padding + ((max - value) / range) * (height - padding * 2);
            return `${x.toFixed(2)},${y.toFixed(2)}`;
        });

        return `
            <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
                <polyline class="sparkline-path" fill="none" points="${points.join(" ")}"></polyline>
            </svg>
        `;
    }

    async function renderSparklines(hosts) {
        await Promise.allSettled(
            hosts.map(async (host) => {
                const slot = document.getElementById(`sparkline-host-${host.id}`);
                if (!slot) {
                    return;
                }

                try {
                    const tests = await requestJson(API_HOST_TESTS(host.id));
                    if (!Array.isArray(tests) || !tests.length) {
                        slot.innerHTML = '<span class="sparkline-empty">No data</span>';
                        return;
                    }
                    slot.innerHTML = buildSparkline(tests);
                } catch (error) {
                    slot.innerHTML = '<span class="sparkline-empty">Error</span>';
                }
            })
        );
    }

    function renderHosts() {
        const rows = [...state.hosts].sort((a, b) => {
            const left = String(a.hostname || "").toLowerCase();
            const right = String(b.hostname || "").toLowerCase();
            return left.localeCompare(right);
        });

        elements.hostCount.textContent = `${rows.length} host${rows.length === 1 ? "" : "s"}`;

        if (!rows.length) {
            elements.hostsTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="placeholder-row">No hosts found. Add a host to begin monitoring.</td>
                </tr>
            `;
            return [];
        }

        const html = rows.map((host) => {
            const activeLabel = host.active ? "Yes" : "No";
            return `
                <tr>
                    <td><a class="table-link" href="/host/${host.id}/">${escapeHtml(host.hostname)}</a></td>
                    <td>${escapeHtml(host.ip_address)}</td>
                    <td>${hostStatusBadge(host.is_alive)}</td>
                    <td>${escapeHtml(formatRtt(host.avg_rtt))}</td>
                    <td><div class="sparkline-slot" id="sparkline-host-${host.id}"><span class="sparkline-empty">Loading...</span></div></td>
                    <td>${escapeHtml(activeLabel)}</td>
                    <td>${escapeHtml(traceModeLabel(host.trace_mode))}</td>
                    <td>${escapeHtml(formatDate(host.created))}</td>
                    <td>
                        <div class="action-buttons">
                            <a class="mini-link" href="/host/${host.id}/">Open</a>
                            <button type="button" data-action="edit" data-host-id="${host.id}">Edit</button>
                            <button type="button" class="danger-btn" data-action="delete" data-host-id="${host.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        elements.hostsTableBody.innerHTML = html;
        return rows;
    }

    function closeEditModal() {
        elements.editModal.classList.add("hidden");
        setFormMessage(elements.editFormMessage, "");
    }

    function openEditModal(hostId) {
        const host = state.hosts.find((item) => Number(item.id) === Number(hostId));
        if (!host) {
            return;
        }

        elements.editHostForm.elements.id.value = host.id;
        elements.editHostForm.elements.hostname.value = host.hostname;
        elements.editHostForm.elements.ip_address.value = host.ip_address;
        elements.editHostForm.elements.active.checked = Boolean(host.active);
        elements.editHostForm.elements.trace_mode.value = host.trace_mode || "on_fail";
        elements.editModal.classList.remove("hidden");
    }

    function updateRefreshLabel() {
        if (elements.lastRefresh) {
            elements.lastRefresh.textContent = new Date().toLocaleTimeString();
        }
    }

    async function refreshHosts() {
        if (state.loading) {
            return;
        }
        state.loading = true;

        try {
            const hosts = await requestJson(API_HOSTS);
            state.hosts = Array.isArray(hosts) ? hosts : [];
            setAlert(elements.hostErrors, "");
            const renderedRows = renderHosts();
            await renderSparklines(renderedRows);
            updateRefreshLabel();
        } catch (error) {
            setAlert(elements.hostErrors, flattenErrors(error.payload));
        } finally {
            state.loading = false;
        }
    }

    async function onAddHost(event) {
        event.preventDefault();
        setFormMessage(elements.addFormMessage, "");

        const form = event.currentTarget;
        const payload = {
            hostname: form.elements.hostname.value.trim(),
            ip_address: form.elements.ip_address.value.trim(),
            active: form.elements.active.checked,
            trace_mode: form.elements.trace_mode.value,
        };

        try {
            await requestJson(API_HOSTS, {
                method: "POST",
                data: payload,
            });
            form.reset();
            form.elements.active.checked = true;
            form.elements.trace_mode.value = "on_fail";
            setFormMessage(elements.addFormMessage, "Host added.", "success");
            await refreshHosts();
        } catch (error) {
            setFormMessage(elements.addFormMessage, flattenErrors(error.payload), "error");
        }
    }

    async function onEditHost(event) {
        event.preventDefault();
        setFormMessage(elements.editFormMessage, "");

        const form = event.currentTarget;
        const hostId = form.elements.id.value;
        const payload = {
            hostname: form.elements.hostname.value.trim(),
            ip_address: form.elements.ip_address.value.trim(),
            active: form.elements.active.checked,
            trace_mode: form.elements.trace_mode.value,
        };

        try {
            await requestJson(`/api/host/${hostId}`, {
                method: "PUT",
                data: payload,
            });
            closeEditModal();
            await refreshHosts();
        } catch (error) {
            setFormMessage(elements.editFormMessage, flattenErrors(error.payload), "error");
        }
    }

    async function onHostTableAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const hostId = button.getAttribute("data-host-id");
        const action = button.getAttribute("data-action");

        if (action === "edit") {
            openEditModal(hostId);
            return;
        }

        if (action === "delete") {
            const host = state.hosts.find((item) => Number(item.id) === Number(hostId));
            const hostName = host?.hostname || `#${hostId}`;
            const confirmed = window.confirm(`Delete host ${hostName}?`);
            if (!confirmed) {
                return;
            }

            try {
                await requestJson(`/api/host/${hostId}`, { method: "DELETE" });
                await refreshHosts();
            } catch (error) {
                setAlert(elements.hostErrors, flattenErrors(error.payload));
            }
        }
    }

    function bindEvents() {
        elements.addHostForm.addEventListener("submit", onAddHost);
        elements.editHostForm.addEventListener("submit", onEditHost);
        elements.hostsTableBody.addEventListener("click", onHostTableAction);
        elements.cancelEditBtn.addEventListener("click", closeEditModal);

        elements.editModal.addEventListener("click", (event) => {
            const closeTarget = event.target.closest("[data-close-modal='true']");
            if (closeTarget) {
                closeEditModal();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !elements.editModal.classList.contains("hidden")) {
                closeEditModal();
            }
        });
    }

    async function init() {
        bindEvents();
        await refreshHosts();
        state.timer = window.setInterval(refreshHosts, REFRESH_MS);
    }

    void init();
})();
