/**
 * SAC Custom Widget — AI Narrator v4
 * Data binding directo + Chat interface con multi-medida y multi-moneda
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
    .btn-suggest { background: #6b2fcc; color: #fff; }
    .btn-suggest:hover { background: #531fa3; }
    .btn-suggest:disabled { background: #c9b8e8; cursor: not-allowed; }
    .msg-suggestion { background: #f5f0ff; border: 1px solid #d3b8f5; color: #1a1a1a; align-self: flex-start; max-width: 95%; }
    .msg-divider { text-align: center; color: #aaa; font-size: 10px; margin: 4px 0; display: flex; align-items: center; gap: 6px; }
    .msg-divider::before, .msg-divider::after { content: ""; flex: 1; border-top: 1px solid #e5e5e5; }
  `;

  class AINarrator extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: "open" });
      this._boundData = null;
      this._history = [];
      this._loading = false;
      this._autoAnalyzeTimer = null;
      this._isFirstLoad = true;
    }

    connectedCallback() {
      this._render();
    }

    get narratorEndpoint() { return ENDPOINT; }
    set narratorEndpoint(val) {}

    // ── SAC Data Binding ──────────────────────────────────────────────────────
    onCustomWidgetAfterUpdate(changedProperties) {
      if ("dataBinding" in changedProperties) {
        const binding = changedProperties["dataBinding"];
        if (binding) {
          const parsed = this._parseBinding(binding);
          if (parsed) {
            const isUpdate = !!this._boundData;
            this._boundData = parsed;
            this._updateDataSummary();
            clearTimeout(this._autoAnalyzeTimer);
            this._autoAnalyzeTimer = setTimeout(() => {
              if (!this._loading) {
                if (isUpdate && !this._isFirstLoad) {
                  this._addDivider("Filtros actualizados \u2014 re-analizando");
                }
                this._isFirstLoad = false;
                this._sendMessage(null, "auto");
              }
            }, 600);
          }
        }
      }
    }

    setData(dataBinding) {
      if (!dataBinding) return;
      const parsed = this._parseBinding(dataBinding);
      if (parsed) { this._boundData = parsed; this._updateDataSummary(); }
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
              <button class="btn btn-suggest" id="btn-suggest">&#x1F4A1; Sugerir</button>
              <button class="btn btn-primary" id="btn-analyze">&#x2728; Analizar</button>
            </div>
          </div>
        </div>
      `;

      const input = this._shadow.getElementById("chat-input");
      this._shadow.getElementById("btn-send").addEventListener("click", () => this._sendFromInput());
      this._shadow.getElementById("btn-analyze").addEventListener("click", () => this._sendMessage(null, "auto"));
      this._shadow.getElementById("btn-suggest").addEventListener("click", () => this._sendMessage(null, "suggest"));
      this._shadow.getElementById("btn-clear").addEventListener("click", () => this._clearChat());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._sendFromInput(); }
      });
    }

    // ── Parsear DataBinding — detecta todas las medidas y dimensiones ─────────
    _parseBinding(db) {
      try {
        if (db.state && db.state !== "ok" && db.state !== "success") return null;

        const data = db.data || [];
        const rows = data.filter(r => !r.metadata);
        if (rows.length === 0) return null;

        const firstRow = rows[0];
        const dimKeys  = Object.keys(firstRow).filter(k => k.startsWith("dimensions_")).sort();
        const measKeys = Object.keys(firstRow).filter(k => k.startsWith("measures_")).sort();

        // Labels desde metadata de SAC
        const dimMeta  = db.metadata?.dimensions            || {};
        const measMeta = db.metadata?.mainStructureMembers  || {};

        const dimLabels  = dimKeys.map(k  => dimMeta[k]?.description  || dimMeta[k]?.id  || k);
        const measLabels = measKeys.map(k => measMeta[k]?.label       || measMeta[k]?.id || k);

        // Filas ricas: todas las dimensiones + todas las medidas con moneda
        const richRows = rows.map(row => {
          const dims = dimKeys.map((k, i) => ({
            label: dimLabels[i],
            value: row[k]?.label || row[k]?.id || "N/A"
          }));
          const measures = measKeys.map((k, i) => ({
            label:     measLabels[i],
            raw:       row[k]?.raw,
            formatted: row[k]?.formatted,
            unit:      (row[k]?.unit && row[k]?.unit !== "*") ? row[k]?.unit : null
          })).filter(m => m.raw !== undefined && m.raw !== null);
          return { dims, measures };
        });

        // Monedas presentes (para contexto del AI)
        const currencies = [...new Set(
          richRows.flatMap(r => r.measures.map(m => m.unit).filter(Boolean))
        )];

        const allDims = dimLabels.join(", ")  || "Dimension";
        const allMeas = measLabels.join(", ") || "Measure";

        // Serie principal (primera medida) para compatibilidad
        const groups = {};
        richRows.forEach(r => {
          const key = r.dims[0]?.value || "N/A";
          const val = r.measures[0]?.raw || 0;
          groups[key] = (groups[key] || 0) + val;
        });

        return {
          title: "Analisis del modelo",
          labels: Object.keys(groups),
          series: [{ name: measLabels[0] || "Measure", values: Object.values(groups) }],
          filters: db.filters || {},
          metadata: {
            dimensions: allDims,
            measures:   allMeas,
            currencies: currencies.length > 0 ? currencies.join(", ") : null,
            totalRows:  richRows.length,
            richRows,
            rawData:    rows.slice(0, 50)
          }
        };
      } catch(e) {
        console.error("AI Narrator: error parsing binding", e);
        return null;
      }
    }

    // ── Construir contexto de datos completo para el prompt ───────────────────
    _buildDataContext(chartData) {
      const m = chartData.metadata;
      const lines = [
        `Dimensiones: ${m.dimensions}`,
        `Medidas: ${m.measures}`
      ];

      if (m.currencies) {
        lines.push(`Monedas presentes: ${m.currencies} (considerar al comparar valores entre filas)`);
      }

      lines.push(`\nDatos detallados (${m.totalRows} filas):`);

      if (m.richRows && m.richRows.length > 0) {
        m.richRows.slice(0, 40).forEach(row => {
          const dimStr  = row.dims.map(d => `${d.label}=${d.value}`).join(" | ");
          const measStr = row.measures
            .map(me => `${me.label}: ${me.formatted || me.raw}${me.unit ? " " + me.unit : ""}`)
            .join(", ");
          lines.push(`  [${dimStr}] ${measStr}`);
        });
      } else {
        // Fallback al resumen simple
        chartData.labels.forEach((l, i) => {
          lines.push(`  ${l}: ${chartData.series[0]?.values[i]}`);
        });
      }

      if (chartData.filters && Object.keys(chartData.filters).length > 0) {
        lines.push(`\nFiltros activos: ${JSON.stringify(chartData.filters)}`);
      }

      return lines.join("\n");
    }

    _getDemoData() {
      return {
        title: "Demo",
        labels: ["Region A", "Region B", "Region C"],
        series: [{ name: "Revenue", values: [120000, 95000, 43000] }],
        filters: {},
        metadata: {
          dimensions: "Organization",
          measures: "Revenue",
          currencies: "USD",
          totalRows: 3,
          richRows: [
            { dims: [{label:"Organization", value:"Region A"}], measures: [{label:"Revenue", raw:120000, formatted:"120,000", unit:"USD"}] },
            { dims: [{label:"Organization", value:"Region B"}], measures: [{label:"Revenue", raw:95000,  formatted:"95,000",  unit:"USD"}] },
            { dims: [{label:"Organization", value:"Region C"}], measures: [{label:"Revenue", raw:43000,  formatted:"43,000",  unit:"USD"}] }
          ]
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
      let txt = `${m.totalRows} filas \u2022 Dims: ${m.dimensions} \u2022 Medidas: ${m.measures}`;
      if (m.currencies) txt += ` \u2022 Monedas: ${m.currencies}`;
      text.textContent = txt;
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

      const dataContext = this._buildDataContext(chartData);

      const currencyNote = chartData.metadata?.currencies
        ? `Los datos pueden estar en distintas monedas (${chartData.metadata.currencies}). No compares valores de monedas diferentes sin aclararlo.`
        : "";

      const systemPrompt = `Eres un analista de negocio experto en SAP Analytics Cloud.
Tienes acceso a datos reales del modelo con dimensiones: ${chartData.metadata?.dimensions || "no especificadas"} y medidas: ${chartData.metadata?.measures || "no especificadas"}.
${currencyNote}
Responde siempre en espanol, en tono ejecutivo y conciso.${usingDemo ? " AVISO: usando datos demo." : ""}`;

      // En modo chat incluir historial reciente para contexto
      const historyContext = mode === "chat" && this._history.length > 0
        ? `\nHistorial reciente:\n${this._history.slice(-4).map(h => `${h.role === "user" ? "Usuario" : "Asistente"}: ${h.content}`).join("\n")}\n`
        : "";

      const userPrompt = mode === "auto"
        ? `${dataContext}\n\nGenera una narrativa ejecutiva en 4-5 oraciones. Incluye: tendencias principales, valores destacados por dimension, comparacion entre medidas clave, y una recomendacion accionable. Si hay multiples monedas, mencionalo.`
        : mode === "suggest"
        ? `${dataContext}\n\nEres un consultor de SAP Analytics Cloud. Basandote en los datos disponibles (dimensiones: ${chartData.metadata?.dimensions}, medidas: ${chartData.metadata?.measures}), sugiere 3 visualizaciones especificas para este modelo.\n\nPara cada visualizacion indica:\n- Tipo de grafico SAC (Bar Chart, Line Chart, Waterfall, Pie/Donut, Bullet, Heat Map, etc.)\n- Titulo sugerido\n- Eje/Dimension: que dimension usar\n- Medida(s): que medidas mostrar\n- Filtros recomendados si aplica\n- Por que es util para el negocio\n\nFormato: lista numerada, concisa y especifica con los nombres exactos de dimensiones y medidas del modelo.`
        : `${dataContext}${historyContext}\n\nPregunta: ${question}\n\nResponde de forma concisa y precisa basandote en los datos. Incluye valores especificos cuando sea relevante.`;

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

        this._addMessage("assistant", result.narration, mode === "suggest");
        this._history.push({ role: "user",      content: mode === "auto" ? "[analisis automatico]" : question });
        this._history.push({ role: "assistant", content: result.narration });
        // Limitar historial a ultimas 10 interacciones
        if (this._history.length > 20) this._history = this._history.slice(-20);

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
    _addMessage(type, text, isSuggestion = false) {
      const placeholder = this._shadow.getElementById("placeholder");
      if (placeholder) placeholder.style.display = "none";

      const chatArea = this._shadow.getElementById("chat-area");
      const id = "msg-" + Date.now() + Math.random();
      const div = document.createElement("div");
      div.id = id;

      if (type === "loading") {
        div.className = "msg msg-loading";
        div.innerHTML = `<div class="spinner"></div><span>${text}</span>`;
      } else if (type === "user") {
        div.className = "msg msg-user";
        div.textContent = text;
      } else if (isSuggestion) {
        div.className = "msg msg-suggestion";
        const title = document.createElement("div");
        title.className = "suggestion-title";
        title.textContent = "&#x1F4A1; Sugerencias de visualizacion";
        title.innerHTML = "&#x1F4A1; Sugerencias de visualizaci\u00f3n";
        div.appendChild(title);
        const body = document.createElement("div");
        body.style.whiteSpace = "pre-wrap";
        body.textContent = text;
        div.appendChild(body);
      } else {
        div.className = "msg msg-assistant";
        div.textContent = text;
      }

      chatArea.appendChild(div);
      chatArea.scrollTop = chatArea.scrollHeight;
      return id;
    }

    _addDivider(text) {
      const chatArea = this._shadow.getElementById("chat-area");
      const div = document.createElement("div");
      div.className = "msg-divider";
      div.textContent = text;
      chatArea.appendChild(div);
      chatArea.scrollTop = chatArea.scrollHeight;
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
      const btn     = this._shadow.getElementById("btn-analyze");
      const suggest = this._shadow.getElementById("btn-suggest");
      const send    = this._shadow.getElementById("btn-send");
      if (btn)     btn.disabled     = disabled;
      if (suggest) suggest.disabled = disabled;
      if (send)    send.disabled    = disabled;
    }
  }

  customElements.define("com-sap-presales-ai-narrator", AINarrator);
})();
