/**
 * SAC Custom Widget — AI Narrator v4
 * Data binding directo + Chat interface
 * Modelo: Test_SAC_Assistant (Cuentas, Date, Productos, Organizacion, Version / Measure)
 */

(function () {
  "use strict";

  const ENDPOINT = "https://sac-ai-narrator.cfapps.us10.hana.ondemand.com";

  const STYLES = `
    :host { display: block; font-family: '72', Arial, sans-serif; height: 100%; width: 100%; box-sizing: border-box; }
    * { box-sizing: border-box; }
    .container { display: flex; flex-direction: column; height: 100%; background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
    .header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #0070f2; color: #fff; flex-shrink: 0; }
    .header-title { font-size: 13px; font-weight: 600; flex: 1; }
    .header-badge { font-size: 10px; background: rgba(255,255,255,0.25); padding: 2px 6px; border-radius: 10px; }
    .chat-area { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
    .msg { max-width: 90%; padding: 8px 12px; border-radius: 8px; font-size: 12px; line-height: 1.6; }
    .msg-assistant { background: #f0f7ff; color: #1a1a1a; align-self: flex-start; border: 1px solid #cce0fb; }
    .msg-user { background: #0070f2; color: #fff; align-self: flex-end; }
    .msg-loading { background: #f5f5f5; color: #8c8c8c; align-self: flex-start; display: flex; align-items: center; gap: 8px; }
    .msg-placeholder { color: #8c8c8c; font-size: 12px; text-align: center; margin: auto; line-height: 1.8; }
    .spinner { width: 14px; height: 14px; border: 2px solid #ccc; border-top-color: #0070f2; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .data-summary { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #7c5c00; flex-shrink: 0; margin: 0 12px; }
    .data-summary-title { font-weight: 600; margin-bottom: 4px; }
    .footer { flex-shrink: 0; border-top: 1px solid #e5e5e5; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
    .input-row { display: flex; gap: 6px; }
    .chat-input { flex: 1; border: 1px solid #d9d9d9; border-radius: 4px; padding: 6px 10px; font-size: 12px; font-family: inherit; resize: none; height: 34px; outline: none; }
    .chat-input:focus { border-color: #0070f2; }
    .btn-row { display: flex; gap: 6px; justify-content: flex-end; }
    .btn { padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s; white-space: nowrap; }
    .btn-primary { background: #0070f2; color: #fff; }
    .btn-primary:hover { background: #0057c2; }
    .btn-primary:disabled { background: #c5d8f7; cursor: not-allowed; }
    .btn-ghost { background: transparent; color: #0070f2; border: 1px solid #0070f2; }
    .btn-ghost:hover { background: #f0f7ff; }
    .btn-send { background: #0070f2; color: #fff; padding: 5px 10px; }
    .btn-send:hover { background: #0057c2; }
    .btn-send:disabled { background: #c5d8f7; cursor: not-allowed; }
  `;

  class AINarrator extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: "open" });
      this._boundData = null;
      this._history = [];
      this._loading = false;
    }

    connectedCallback() {
      this._render();
    }

    get narratorEndpoint() { return ENDPOINT; }
    set narratorEndpoint(val) {}

    // ── SAC Data Binding — se llama automaticamente cuando los datos cambian ──
    onCustomWidgetAfterUpdate(changedProperties) {
      if ("dataBinding" in changedProperties) {
        const binding = changedProperties["dataBinding"];
        console.log("AI Narrator afterUpdate state:", binding?.state);
        if (binding) {
          const parsed = this._parseBinding(binding);
          if (parsed) {
            this._boundData = parsed;
            this._updateDataSummary();
            if (!this._loading) this._sendMessage(null, "auto");
          }
        }
      }
    }

    // Metodo publico para trigger desde Script SAC
    setData(dataBinding) {
      if (!dataBinding) return;
      const parsed = this._parseBinding(dataBinding);
      if (parsed) {
        this._boundData = parsed;
        this._updateDataSummary();
      }
    }

    analyze(dataBinding) {
      if (dataBinding) this.setData(dataBinding);
      this._sendMessage(null, "auto");
    }

    // ── Render ────────────────────────────────────────────────────────────────
    _render() {
      this._shadow.innerHTML = `
        <style>${STYLES}</style>
        <div class="container">
          <div class="header">
            <span style="font-size:16px">&#x2728;</span>
            <span class="header-title">AI Narrator</span>
            <span class="header-badge">SAC Assistant</span>
          </div>
          <div class="data-summary" id="data-summary" style="display:none">
            <div class="data-summary-title">&#x1F4CA; Datos vinculados</div>
            <div id="data-summary-text"></div>
          </div>
          <div class="chat-area" id="chat-area">
            <div class="msg-placeholder" id="placeholder">
              Vincula dimensiones y medidas en el<br>
              panel Builder, luego presiona<br>
              <strong>Analizar</strong> para generar la narrativa.<br><br>
              Tambien puedes hacer preguntas<br>sobre los datos en el chat.
            </div>
          </div>
          <div class="footer">
            <div class="input-row">
              <textarea class="chat-input" id="chat-input"
                placeholder="Pregunta sobre los datos..."
                rows="1"></textarea>
              <button class="btn btn-send" id="btn-send">&#x27A4;</button>
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost" id="btn-clear">Limpiar</button>
              <button class="btn btn-primary" id="btn-analyze">&#x2728; Analizar</button>
            </div>
          </div>
        </div>
      `;

      const input = this._shadow.getElementById("chat-input");
      this._shadow.getElementById("btn-send").addEventListener("click", () => this._sendFromInput());
      this._shadow.getElementById("btn-analyze").addEventListener("click", () => this._sendMessage(null, "auto"));
      this._shadow.getElementById("btn-clear").addEventListener("click", () => this._clearChat());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._sendFromInput(); }
      });
    }

    // ── Parsear DataBinding de SAC ────────────────────────────────────────────
    _parseBinding(db) {
      try {
        console.log("AI Narrator binding:", JSON.stringify(db).slice(0, 800));

        if (db.state && db.state !== "ok" && db.state !== "success") return null;

        const data = db.data || [];
        const rows = data.filter(r => !r.metadata);
        if (rows.length === 0) return null;

        // Metadata real de SAC: metadata.dimensions y metadata.mainStructureMembers
        const dimMeta  = db.metadata?.dimensions           || {};
        const measMeta = db.metadata?.mainStructureMembers || {};

        const allDims   = Object.values(dimMeta).map(d => d.description || d.id).join(", ") || "Dimension";
        const allMeas   = Object.values(measMeta).map(m => m.label || m.id).join(", ")      || "Measure";
        const measLabel = Object.values(measMeta)[0]?.label || "Measure";

        // Cada fila: dimensions_0.label = valor dim, dimensions_0.measures_0.raw = valor medida
        const groups = {};
        rows.forEach(row => {
          const dim0 = row.dimensions_0;
          if (!dim0) return;
          const key = dim0.label || dim0.id || "N/A";
          const val = parseFloat(row.measures_0?.raw) || 0;
          groups[key] = (groups[key] || 0) + val;
        });

        const labels = Object.keys(groups);
        const values = Object.values(groups);

        return {
          title: "Analisis del modelo",
          labels,
          series: [{ name: measLabel, values }],
          filters: db.filters || {},
          metadata: {
            dimensions: allDims,
            measures:   allMeas,
            totalRows:  rows.length,
            rawData:    rows.slice(0, 50)
          }
        };
      } catch(e) {
        console.error("AI Narrator: error parsing binding", e);
        return null;
      }
    }

    _getDemoData() {
      return {
        title: "Demo — Test_SAC_Assistant",
        labels: ["Cuenta A", "Cuenta B", "Cuenta C", "Cuenta D"],
        series: [{ name: "Measure", values: [120000, 95000, 43000, 78000] }],
        filters: { Version: "Actual", Date: "2024" },
        metadata: {
          dimensions: "Cuentas, Organizacion, Productos, Date",
          measures: "Measure",
          totalRows: 4
        }
      };
    }

    _updateDataSummary() {
      if (!this._boundData) return;
      const summary = this._shadow.getElementById("data-summary");
      const text    = this._shadow.getElementById("data-summary-text");
      if (!summary || !text) return;
      summary.style.display = "block";
      const m = this._boundData.metadata;
      text.textContent = `${m.totalRows} filas \u2022 Dims: ${m.dimensions} \u2022 Medidas: ${m.measures}`;
    }

    // ── Chat ──────────────────────────────────────────────────────────────────
    _sendFromInput() {
      const input = this._shadow.getElementById("chat-input");
      const question = input.value.trim();
      if (!question || this._loading) return;
      input.value = "";
      this._sendMessage(question, "chat");
    }

    async _sendMessage(question, mode) {
      if (this._loading) return;
      this._loading = true;
      this._setButtons(true);

      const chartData = this._boundData || this._getDemoData();
      const usingDemo = !this._boundData;

      if (mode === "chat" && question) {
        this._addMessage("user", question);
      }

      const loadingId = this._addMessage("loading", "Consultando SAP AI Core...");

      const systemPrompt = `Eres un analista de negocio experto en SAP Analytics Cloud.
Tienes acceso a datos del modelo Test_SAC_Assistant con dimensiones: ${chartData.metadata?.dimensions || "no especificadas"}.
Responde siempre en espanol, en tono ejecutivo y conciso.${usingDemo ? " (Nota: usando datos demo)" : ""}`;

      const dataContext = `Datos disponibles:
Titulo: ${chartData.title}
Filtros: ${JSON.stringify(chartData.filters)}
Resumen por dimension (${chartData.labels.length} valores):
${chartData.labels.map((l, i) => `  ${l}: ${chartData.series[0]?.values[i]}`).join("\n")}`;

      const userPrompt = mode === "auto"
        ? `${dataContext}\n\nGenera una narrativa ejecutiva en 3-4 oraciones. Incluye: tendencia principal, valores destacados y una recomendacion accionable.`
        : `${dataContext}\n\nPregunta: ${question}\n\nResponde de forma concisa basandote en los datos.`;

      try {
        const resp = await fetch(`${ENDPOINT}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chart_data: chartData,
            custom_prompt: userPrompt,
            system_prompt: systemPrompt
          })
        });

        this._removeMessage(loadingId);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const result = await resp.json();

        this._addMessage("assistant", result.narration);
        this._history.push({ role: "user", content: userPrompt });
        this._history.push({ role: "assistant", content: result.narration });

        this.dispatchEvent(new CustomEvent("onNarrationReady", {
          detail: { narration: result.narration },
          bubbles: true
        }));

      } catch(err) {
        this._removeMessage(loadingId);
        this._addMessage("assistant", "Error: " + err.message);
      } finally {
        this._loading = false;
        this._setButtons(false);
      }
    }

    // ── UI helpers ────────────────────────────────────────────────────────────
    _addMessage(type, text) {
      const placeholder = this._shadow.getElementById("placeholder");
      if (placeholder) placeholder.style.display = "none";

      const chatArea = this._shadow.getElementById("chat-area");
      const id = "msg-" + Date.now() + Math.random();
      const div = document.createElement("div");
      div.id = id;
      div.className = type === "loading" ? "msg msg-loading"
                    : type === "user"    ? "msg msg-user"
                    : "msg msg-assistant";

      if (type === "loading") {
        div.innerHTML = `<div class="spinner"></div><span>${text}</span>`;
      } else {
        div.textContent = text;
      }

      chatArea.appendChild(div);
      chatArea.scrollTop = chatArea.scrollHeight;
      return id;
    }

    _removeMessage(id) {
      const el = this._shadow.getElementById(id);
      if (el) el.remove();
    }

    _clearChat() {
      const chatArea = this._shadow.getElementById("chat-area");
      chatArea.innerHTML = `<div class="msg-placeholder" id="placeholder">Vincula dimensiones y medidas en el<br>panel Builder, luego presiona<br><strong>Analizar</strong> para generar la narrativa.<br><br>Tambien puedes hacer preguntas<br>sobre los datos en el chat.</div>`;
      this._history = [];
      const summary = this._shadow.getElementById("data-summary");
      if (summary) summary.style.display = "none";
    }

    _setButtons(disabled) {
      const btn  = this._shadow.getElementById("btn-analyze");
      const send = this._shadow.getElementById("btn-send");
      if (btn)  btn.disabled  = disabled;
      if (send) send.disabled = disabled;
    }
  }

  customElements.define("com-sap-presales-ai-narrator", AINarrator);
})();
