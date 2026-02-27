(() => {
    const REFRESH_MS = 30000;
    const SPARKLINE_LIMIT = 20;

    const elements = {
        root: document.getElementById("host-detail-root"),
        hostTitle: document.getElementById("host-title"),
        hostSummary: document.getElementById("host-summary"),
        metricHostname: document.getElementById("metric-hostname"),
        metricIp: document.getElementById("metric-ip"),
        metricStatus: document.getElementById("metric-status"),
        metricRtt: document.getElementById("metric-rtt"),
        metricTraceMode: document.getElementById("metric-trace-mode"),
        hostSparkline: document.getElementById("host-sparkline"),
        hostTestsTableBody: document.getElementById("host-tests-table-body"),
        hostTestErrors: document.getElementById("host-test-errors"),
        lastRefresh: document.getElementById("last-refresh"),
    };

    if (!elements.root || !elements.hostTestsTableBody) {
        return;
    }

    const hostId = Number(elements.root.dataset.hostId);
    const API_HOST = `/api/host/${hostId}`;
    const API_HOST_TESTS = `/api/host/${hostId}/test`;

    const state = {
        loading: false,
        host: null,
        tests: [],
        timer: null,
    };

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

    function statusBadgeMarkup(isAlive) {
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

    function setAlert(message) {
        if (!message) {
            elements.hostTestErrors.textContent = "";
            elements.hostTestErrors.classList.add("hidden");
            return;
        }
        elements.hostTestErrors.textContent = message;
        elements.hostTestErrors.classList.remove("hidden");
    }

    function updateRefreshLabel() {
        if (elements.lastRefresh) {
            elements.lastRefresh.textContent = new Date().toLocaleTimeString();
        }
    }

    function buildDetailSparkline(tests) {
        const width = 720;
        const height = 160;
        const padding = 14;
        const ordered = [...tests].reverse().slice(-SPARKLINE_LIMIT);
        const values = ordered
            .map((test) => Number(test.avg_rtt))
            .filter((value) => Number.isFinite(value));

        if (values.length < 2) {
            return '<span class="sparkline-empty">Not enough data points for trend.</span>';
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const step = values.length === 1 ? 0 : (width - padding * 2) / (values.length - 1);
        const points = values.map((value, index) => {
            const x = padding + step * index;
            const y = padding + ((max - value) / range) * (height - padding * 2);
            return {x, y};
        });
        const pointString = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
        const latest = points[points.length - 1];

        return `
            <svg class="sparkline-large" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
                <polyline class="sparkline-large-path" fill="none" points="${pointString}"></polyline>
                <circle class="sparkline-large-point" cx="${latest.x.toFixed(2)}" cy="${latest.y.toFixed(2)}" r="4"></circle>
            </svg>
        `;
    }

    function renderHost() {
        if (!state.host) {
            elements.hostTitle.textContent = "Host Details";
            elements.hostSummary.textContent = "Host not found";
            return;
        }

        elements.hostTitle.textContent = state.host.hostname;
        elements.hostSummary.textContent = `${state.tests.length} test result${state.tests.length === 1 ? "" : "s"}`;
        elements.metricHostname.textContent = state.host.hostname || "-";
        elements.metricIp.textContent = state.host.ip_address || "-";
        elements.metricStatus.innerHTML = statusBadgeMarkup(state.host.is_alive);
        elements.metricRtt.textContent = formatRtt(state.host.avg_rtt);
        elements.metricTraceMode.textContent = traceModeLabel(state.host.trace_mode);
    }

    function renderHostTests() {
        if (!state.tests.length) {
            elements.hostTestsTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="placeholder-row">No tests available for this host yet.</td>
                </tr>
            `;
            elements.hostSparkline.innerHTML = '<span class="sparkline-empty">No trend data yet.</span>';
            return;
        }

        const html = state.tests.map((test) => `
            <tr>
                <td>${escapeHtml(formatDate(test.timestamp))}</td>
                <td>${statusBadgeMarkup(test.is_alive)}</td>
                <td>${escapeHtml(formatRtt(test.avg_rtt))}</td>
                <td>${escapeHtml(formatRtt(test.min_rtt))}</td>
                <td>${escapeHtml(formatRtt(test.max_rtt))}</td>
                <td>${escapeHtml(formatPercent(test.packet_loss))}</td>
                <td>${escapeHtml(test.packets_sent ?? "-")}</td>
                <td>${escapeHtml(test.packets_received ?? "-")}</td>
                <td>${renderTraceCell(test)}</td>
            </tr>
        `).join("");

        elements.hostTestsTableBody.innerHTML = html;
        elements.hostSparkline.innerHTML = buildDetailSparkline(state.tests);
    }

    async function refreshHostDetail() {
        if (state.loading) {
            return;
        }
        state.loading = true;

        try {
            const [hostResult, testsResult] = await Promise.allSettled([
                requestJson(API_HOST),
                requestJson(API_HOST_TESTS),
            ]);

            let errorMessage = "";
            if (hostResult.status === "fulfilled") {
                state.host = hostResult.value;
            } else {
                state.host = null;
                errorMessage = flattenErrors(hostResult.reason?.payload);
            }

            if (testsResult.status === "fulfilled") {
                state.tests = Array.isArray(testsResult.value) ? testsResult.value : [];
            } else {
                state.tests = [];
                const testError = flattenErrors(testsResult.reason?.payload);
                errorMessage = errorMessage ? `${errorMessage} ${testError}` : testError;
            }

            setAlert(errorMessage);
            renderHost();
            renderHostTests();
            if (hostResult.status === "fulfilled" || testsResult.status === "fulfilled") {
                updateRefreshLabel();
            }
        } finally {
            state.loading = false;
        }
    }

    async function init() {
        await refreshHostDetail();
        state.timer = window.setInterval(refreshHostDetail, REFRESH_MS);
    }

    void init();
})();
