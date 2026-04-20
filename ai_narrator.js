/**
 * SAC Custom Widget — AI Narrator
 * Invoca SAP AI Core (GPT-4o) para generar narrativas ejecutivas
 * sobre los datos del chart vinculado en el Story.
 *
 * Autor: SAP Presales LATAM
 * Versión: 1.0.0
 */

(function () {
  "use strict";

  // ── Estilos del widget ────────────────────────────────────────────────────
  const STYLES = `
    :host {
      display: block;
      font-family: '72', Arial, sans-serif;
      height: 100%;
      width: 100%;
      box-sizing: border-box;
    }
    .narrator-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      overflow: hidden;
    }
    .narrator-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #0070f2;
      color: #fff;
    }
    .narrator-header-icon {
      font-size: 18px;
    }
    .narrator-header-title {
      font-size: 13px;
      font-weight: 600;
      flex: 1;
    }
    .narrator-body {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .narrator-placeholder {
      color: #8c8c8c;
      font-size: 12px;
      text-align: center;
      margin: auto;
      line-height: 1.6;
    }
    .narrator-text {
      font-size: 13px;
      color: #1a1a1a;
      line-height: 1.7;
      display: none;
    }
    .narrator-text.visible {
      display: block;
    }
    .narrator-loading {
      display: none;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #0070f2;
      margin: auto;
    }
    .narrator-loading.visible {
      display: flex;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #cce0fb;
      border-top-color: #0070f2;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .narrator-error {
      font-size: 12px;
      color: #bb0000;
      background: #fff0f0;
      border-radius: 4px;
      padding: 8px;
      display: none;
    }
    .narrator-error.visible { display: block; }
    .narrator-footer {
      padding: 8px 14px;
      border-top: 1px solid #e5e5e5;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.15s;
    }
    .btn-primary {
      background: #0070f2;
      color: #fff;
    }
    .btn-primary:hover { background: #0057c2; }
    .btn-primary:disabled {
      background: #c5d8f7;
      cursor: not-allowed;
    }
    .btn-ghost {
      background: transparent;
      color: #0070f2;
      border: 1px solid #0070f2;
    }
    .btn-ghost:hover { background: #f0f7ff; }
    .data-preview {
      background: #f5f5f5;
      border-radius: 4px;
      padding: 8px;
      font-size: 11px;
      color: #555;
      font-family: monospace;
      max-height: 80px;
      overflow-y: auto;
      display: none;
    }
    .data-preview.visible { display: block; }
    .toggle-data {
      font-size: 11px;
      color: #0070f2;
      cursor: pointer;
      text-decoration: underline;
      background: none;
      border: none;
      padding: 0;
    }
  `;

  // ── Web Component ─────────────────────────────────────────────────────────
  class AINarrator extends HTMLElement {

    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: "open" });
      this._endpoint = this.getAttribute("narratorEndpoint") || "https://sac-ai-narrator.cfapps.us10.hana.ondemand.com";
      this._chartTitle = "Ventas LATAM";
      this._chartData = null;
      this._showData = false;
      this._render();
    }

    // ── SAC Widget API ──────────────────────────────────────────────────────
    connectedCallback() {
      this._render();
    }

    // Propiedad: narratorEndpoint
    get narratorEndpoint() { return this._endpoint; }
    set narratorEndpoint(val) {
      this._endpoint = val;
    }

    // Propiedad: chartTitle
    get chartTitle() { return this._chartTitle; }
    set chartTitle(val) {
      this._chartTitle = val;
      const titleEl = this._shadow.querySelector(".narrator-header-title");
      if (titleEl) titleEl.textContent = `✨ AI Narrator — ${val}`;
    }

    // Método público: analyze() — llamado desde Script del Story
    analyze(dataBinding) {
      if (dataBinding) {
        this._chartData = this._parseDataBinding(dataBinding);
      }
      this._runAnalysis();
    }

    // ── Render ──────────────────────────────────────────────────────────────
    _render() {
      this._shadow.innerHTML = `
        <style>${STYLES}</style>
        <div class="narrator-container">
          <div class="narrator-header">
            <span class="narrator-header-icon">✨</span>
            <span class="narrator-header-title">AI Narrator — ${this._chartTitle}</span>
          </div>
          <div class="narrator-body">
            <div class="narrator-placeholder">
              Presiona <strong>Analizar</strong> para generar<br>
              una narrativa ejecutiva del gráfico.
            </div>
            <div class="narrator-loading">
              <div class="spinner"></div>
              Consultando SAP AI Core...
            </div>
            <div class="narrator-text"></div>
            <div class="narrator-error"></div>
            <button class="toggle-data" style="display:none">▶ Ver datos enviados</button>
            <div class="data-preview"></div>
          </div>
          <div class="narrator-footer">
            <button class="btn btn-ghost" id="btn-clear" style="display:none">Limpiar</button>
            <button class="btn btn-primary" id="btn-analyze">Analizar gráfico</button>
          </div>
        </div>
      `;

      this._shadow.getElementById("btn-analyze").addEventListener("click", () => this._runAnalysis());
      this._shadow.getElementById("btn-clear").addEventListener("click", () => this._clear());
      this._shadow.querySelector(".toggle-data").addEventListener("click", () => this._toggleData());
    }

    // ── Análisis principal ──────────────────────────────────────────────────
    async _runAnalysis() {
      const btn = this._shadow.getElementById("btn-analyze");
      btn.disabled = true;

      this._showState("loading");

      // Si no hay datos vinculados, usa datos demo de ventas LATAM
      const chartData = this._chartData || this._getDemoData();

      try {
        const response = await fetch(`${this._endpoint}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chart_data: chartData })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        this._showNarration(result.narration, chartData);

        // Disparar evento SAC
        this.dispatchEvent(new CustomEvent("onNarrationReady", {
          detail: { narration: result.narration },
          bubbles: true
        }));

      } catch (err) {
        this._showError(`Error al conectar con AI Core: ${err.message}`);
      } finally {
        btn.disabled = false;
      }
    }

    // ── Parsear DataBinding de SAC ──────────────────────────────────────────
    _parseDataBinding(dataBinding) {
      // dataBinding viene del Widget API de SAC — adaptamos al formato del backend
      try {
        const data = dataBinding.data || [];
        const dimensions = dataBinding.dimensions || [];
        const measures = dataBinding.measures || [];

        const labels = data.map(row => row[dimensions[0]?.id] || "N/A");
        const series = measures.map(m => ({
          name: m.label || m.id,
          values: data.map(row => parseFloat(row[m.id]) || 0)
        }));

        return {
          title: this._chartTitle,
          labels,
          series,
          filters: dataBinding.filters || {}
        };
      } catch (e) {
        return this._getDemoData();
      }
    }

    // ── Datos demo ──────────────────────────────────────────────────────────
    _getDemoData() {
      return {
        title: "Ventas por País LATAM — Q1 2026",
        labels: ["Chile", "Argentina", "Perú", "Colombia", "México"],
        series: [
          {
            name: "Revenue (USD)",
            values: [1250000, 980000, 620000, 840000, 1750000]
          },
          {
            name: "Target (USD)",
            values: [1100000, 1050000, 700000, 800000, 1600000]
          }
        ],
        filters: { Period: "Q1 2026", Segment: "Corporate" }
      };
    }

    // ── Estados UI ───────────────────────────────────────────────────────────
    _showState(state) {
      const placeholder = this._shadow.querySelector(".narrator-placeholder");
      const loading     = this._shadow.querySelector(".narrator-loading");
      const text        = this._shadow.querySelector(".narrator-text");
      const error       = this._shadow.querySelector(".narrator-error");

      placeholder.style.display = state === "idle"     ? "block" : "none";
      loading.classList.toggle("visible", state === "loading");
      text.classList.toggle("visible",    state === "result");
      error.classList.toggle("visible",   state === "error");
    }

    _showNarration(narration, chartData) {
      this._showState("result");
      this._shadow.querySelector(".narrator-text").textContent = narration;

      // Mostrar botón limpiar y toggle de datos
      this._shadow.getElementById("btn-clear").style.display = "inline-block";
      const toggleBtn = this._shadow.querySelector(".toggle-data");
      toggleBtn.style.display = "inline-block";

      // Guardar datos para preview
      this._shadow.querySelector(".data-preview").textContent =
        JSON.stringify(chartData, null, 2);
    }

    _showError(msg) {
      this._showState("error");
      this._shadow.querySelector(".narrator-error").textContent = msg;
    }

    _clear() {
      this._showState("idle");
      this._shadow.querySelector(".narrator-text").textContent = "";
      this._shadow.querySelector(".narrator-error").textContent = "";
      this._shadow.querySelector(".data-preview").textContent = "";
      this._shadow.getElementById("btn-clear").style.display = "none";
      this._shadow.querySelector(".toggle-data").style.display = "none";
      this._showData = false;
    }

    _toggleData() {
      this._showData = !this._showData;
      const preview = this._shadow.querySelector(".data-preview");
      const btn = this._shadow.querySelector(".toggle-data");
      preview.classList.toggle("visible", this._showData);
      btn.textContent = this._showData ? "▼ Ocultar datos" : "▶ Ver datos enviados";
    }
  }

  // Registrar el Web Component
  customElements.define("com-sap-presales-ai-narrator", AINarrator);

})();
