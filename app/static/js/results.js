(() => {
    const API_TESTS = "/api/test/";
    const REFRESH_MS = 30000;

    const state = {
        tests: [],
        loading: false,
        timer: null,
    };

    const elements = {
        testsTableBody: document.getElementById("tests-table-body"),
        testErrors: document.getElementById("test-errors"),
        lastRefresh: document.getElementById("last-refresh"),
    };

    if (!elements.testsTableBody) {
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

    function formatPercent(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return "-";
        }
        return `${Number(value).toFixed(2)}%`;
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

    function renderTraceCell(test) {
        if (!test.trace_attempted) {
            return "-";
        }
        if (!test.trace_output) {
            return "Attempted";
        }
        return `
            <details class="trace-details">
                <summary>View</summary>
                <pre>${escapeHtml(test.trace_output)}</pre>
            </details>
        `;
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

    async function requestJson(url) {
        const response = await fetch(url, {
            method: "GET",
            headers: {Accept: "application/json"},
            credentials: "same-origin",
        });

        let payload = null;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            payload = await response.json();
        }

        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}`);
            err.payload = payload;
            throw err;
        }
        return payload;
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

    function updateRefreshLabel() {
        if (elements.lastRefresh) {
            elements.lastRefresh.textContent = new Date().toLocaleTimeString();
        }
    }

    function renderTests() {
        if (!state.tests.length) {
            elements.testsTableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="placeholder-row">No test results yet.</td>
                </tr>
            `;
            return;
        }

        const html = state.tests.map((test) => `
            <tr>
                <td>${escapeHtml(formatDate(test.timestamp))}</td>
                <td><a class="table-link" href="/host/${test.host}/">${escapeHtml(test.host_name || `Host #${test.host}`)}</a></td>
                <td>${escapeHtml(test.host_ip || "-")}</td>
                <td>${hostStatusBadge(test.is_alive)}</td>
                <td>${escapeHtml(formatRtt(test.avg_rtt))}</td>
                <td>${escapeHtml(formatRtt(test.min_rtt))}</td>
                <td>${escapeHtml(formatRtt(test.max_rtt))}</td>
                <td>${escapeHtml(formatPercent(test.packet_loss))}</td>
                <td>${escapeHtml(test.packets_sent ?? "-")}</td>
                <td>${escapeHtml(test.packets_received ?? "-")}</td>
                <td>${renderTraceCell(test)}</td>
            </tr>
        `).join("");

        elements.testsTableBody.innerHTML = html;
    }

    async function refreshTests() {
        if (state.loading) {
            return;
        }
        state.loading = true;

        try {
            const tests = await requestJson(API_TESTS);
            state.tests = Array.isArray(tests) ? tests : [];
            setAlert(elements.testErrors, "");
            renderTests();
            updateRefreshLabel();
        } catch (error) {
            setAlert(elements.testErrors, flattenErrors(error.payload));
        } finally {
            state.loading = false;
        }
    }

    async function init() {
        await refreshTests();
        state.timer = window.setInterval(refreshTests, REFRESH_MS);
    }

    void init();
})();
