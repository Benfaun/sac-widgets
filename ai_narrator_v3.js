/**
 * SAC Custom Widget — AI Narrator v2
 * Data binding dinámico + Chat interface
 * Autor: SAP Presales LATAM
 */

(function () {
  "use strict";

  const ENDPOINT = "https://sac-ai-narrator.cfapps.us10.hana.ondemand.com";

  const ACCOUNT_LABELS = {
    PL010: "Revenue", PL020: "Cost of Goods Sold", PL110: "Gross Profit",
    PL120: "Operating Expenses", PL510: "Net Income", NF010: "Non-Financial KPI"
  };

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
      this._history = []; // historial de chat
      this._loading = false;
    }

    connectedCallback() {
      this._render();
    }

    // ── Propiedades SAC (agnósticas — no hardcodeamos nada del modelo) ──────
    get narratorEndpoint() { return ENDPOINT; }
    set narratorEndpoint(val) { /* ignorado */ }
    get chartTitle() { return "AI Narrator"; }
    set chartTitle(val) { /* ignorado */ }

    // ── Data Binding — SAC llama esto cuando hay datos vinculados ─────────
    onCustomWidgetAfterUpdate(changedProperties) {
      // Se llama cuando el data binding cambia en SAC
    }

    // Método público para recibir data binding desde Script SAC
    setData(dataBinding) {
      if (!dataBinding) return;
      this._boundData = this._parseBinding(dataBinding);
      this._updateDataSummary();
    }

    // Método público para trigger de análisis desde Script SAC  
    analyze(dataBinding) {
      if (dataBinding) this._boundData = this._parseBinding(dataBinding);
      this._sendMessage(null, "auto");
    }

    // ── Render ────────────────────────────────────────────────────────────
    _render() {
      this._shadow.innerHTML = `
        <style>${STYLES}</style>
        <div class="container">
          <div class="header">
            <span style="font-size:16px">✨</span>
            <span class="header-title">AI Narrator</span>
            <span class="header-badge">P&L Assistant</span>
          </div>
          <div class="data-summary" id="data-summary" style="display:none">
            <div class="data-summary-title">📊 Datos vinculados</div>
            <div id="data-summary-text"></div>
          </div>
          <div class="chat-area" id="chat-area">
            <div class="msg-placeholder" id="placeholder">
              Vincula un chart al widget o presiona<br>
              <strong>Analizar</strong> para usar datos demo.<br><br>
              También puedes hacer preguntas<br>sobre los datos en el chat.
            </div>
          </div>
          <div class="footer">
            <div class="input-row">
              <textarea class="chat-input" id="chat-input" 
                placeholder="Pregunta sobre los datos... ej: ¿Cuál es la tendencia de revenue?"
                rows="1"></textarea>
              <button class="btn btn-send" id="btn-send">➤</button>
            </div>
            <div class="btn-row">
              <button class="btn btn-ghost" id="btn-clear">Limpiar</button>
              <button class="btn btn-primary" id="btn-analyze">✨ Analizar</button>
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

    // ── Parsear DataBinding dinámicamente ─────────────────────────────────
    _parseBinding(db) {
      try {
        const data      = db.data || [];
        const dimensions = db.dimensions || [];
        const measures   = db.measures || [];

        if (data.length === 0) return null;

        // Construir resumen agrupado por primera dimensión
        const dimId   = dimensions[0]?.id;
        const dimLabel = dimensions[0]?.label || dimId;
        const measId  = measures[0]?.id;
        const measLabel = measures[0]?.label || measId;

        // Agrupar valores por dimensión
        const groups = {};
        data.forEach(row => {
          const key = row[dimId] || "N/A";
          const val = parseFloat(row[measId]) || 0;
          groups[key] = (groups[key] || 0) + val;
        });

        const labels = Object.keys(groups);
        const values = Object.values(groups);

        // Metadata adicional de dimensiones disponibles
        const allDims = dimensions.map(d => d.label || d.id).join(", ");
        const allMeas = measures.map(m => m.label || m.id).join(", ");

        return {
          title: `Análisis del modelo`,
          labels,
          series: [{ name: measLabel, values }],
          filters: db.filters || {},
          metadata: {
            dimensions: allDims,
            measures: allMeas,
            totalRows: data.length,
            rawData: data.slice(0, 50) // primeras 50 filas para contexto
          }
        };
      } catch(e) {
        console.error("Error parsing binding:", e);
        return null;
      }
    }

    _getDemoData() {
      return {
        title: "P&L Demo — AR/SUNNY 2020",
        labels: ["Revenue (PL010)", "COGS (PL020)", "Gross Profit (PL110)", "OpEx (PL120)", "Net Income (PL510)"],
        series: [{ name: "SIGNEDDATA", values: [-5948, -6037, 1074, 172, -1736] }],
        filters: { Entity: "AR", ProductLine: "SUNNY", Period: "202001" },
        metadata: {
          dimensions: "DATE, ACCOUNT, ENTITY, PRODLINE",
          measures: "SIGNEDDATA",
          totalRows: 5
        }
      };
    }

    _updateDataSummary() {
      if (!this._boundData) return;
      const summary = this._shadow.getElementById("data-summary");
      const text    = this._shadow.getElementById("data-summary-text");
      summary.style.display = "block";
      text.textContent = `${this._boundData.metadata?.totalRows || 0} filas • Dims: ${this._boundData.metadata?.dimensions} • Medidas: ${this._boundData.metadata?.measures}`;
    }

    // ── Chat ──────────────────────────────────────────────────────────────
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

      // Mostrar mensaje del usuario si es chat
      if (mode === "chat" && question) {
        this._addMessage("user", question);
      }

      // Mostrar loading
      const loadingId = this._addMessage("loading", "Consultando SAP AI Core...");

      // Construir prompt según modo
      const systemPrompt = `Eres un analista financiero experto en P&L (Estado de Resultados) de SAP Analytics Cloud.
Tienes acceso a datos reales del modelo con dimensiones: ${chartData.metadata?.dimensions || "no especificadas"}.
Las cuentas del P&L son: PL010=Revenue, PL020=COGS, PL110=Gross Profit, PL120=Operating Expenses, PL510=Net Income, NF010=Non-Financial.
Responde siempre en español, en tono ejecutivo y conciso.`;

      const dataContext = `Datos disponibles:
Título: ${chartData.title}
Filtros: ${JSON.stringify(chartData.filters)}
Resumen por dimensión:
${chartData.labels.map((l, i) => `  ${l}: ${chartData.series[0]?.values[i]}`).join("\n")}`;

      const userPrompt = mode === "auto"
        ? `${dataContext}\n\nGenera una narrativa ejecutiva en 3-4 oraciones. Incluye: tendencia principal, valores destacados y una recomendación accionable.`
        : `${dataContext}\n\nPregunta del usuario: ${question}\n\nResponde de forma concisa y basada en los datos.`;

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
        this._addMessage("assistant", `❌ Error: ${err.message}`);
      } finally {
        this._loading = false;
        this._setButtons(false);
      }
    }

    // ── UI helpers ────────────────────────────────────────────────────────
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
      chatArea.innerHTML = `<div class="msg-placeholder" id="placeholder">Vincula un chart al widget o presiona<br><strong>Analizar</strong> para usar datos demo.<br><br>También puedes hacer preguntas<br>sobre los datos en el chat.</div>`;
      this._history = [];
      const summary = this._shadow.getElementById("data-summary");
      if (summary) summary.style.display = "none";
    }

    _setButtons(disabled) {
      const btn = this._shadow.getElementById("btn-analyze");
      const send = this._shadow.getElementById("btn-send");
      if (btn) btn.disabled = disabled;
      if (send) send.disabled = disabled;
    }
  }

  customElements.define("com-sap-presales-ai-narrator", AINarrator);
})();
