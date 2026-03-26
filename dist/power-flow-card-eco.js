(() => {
  const CARD_TYPE = "power-flow-card-eco";

  const DEFAULT_CONFIG = {
    title: "Power Flow Eco",
    clickable_entities: true,
    animation_quality: "auto",
    battery_charging_positive: true,
    watt_threshold: 1000,
    w_decimals: 0,
    kw_decimals: 1,
    min_flow_show_watt: 10,
  };

  const QUALITY_PRESETS = {
    high: {
      animated: true,
      flowDuration: 1.2,
      cardShadow: true,
      lineOpacity: 0.92,
      minFlowShowWatt: 5,
    },
    medium: {
      animated: true,
      flowDuration: 2.0,
      cardShadow: false,
      lineOpacity: 0.88,
      minFlowShowWatt: 8,
    },
    low: {
      animated: true,
      flowDuration: 3.2,
      cardShadow: false,
      lineOpacity: 0.82,
      minFlowShowWatt: 12,
    },
    ultra_low: {
      animated: false,
      flowDuration: 0,
      cardShadow: false,
      lineOpacity: 0.72,
      minFlowShowWatt: 20,
    },
    off: {
      animated: false,
      flowDuration: 0,
      cardShadow: false,
      lineOpacity: 0.75,
      minFlowShowWatt: 15,
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toNumber(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const normalized = String(value).replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function hasEntity(hass, entityId) {
    return Boolean(hass && entityId && hass.states && hass.states[entityId]);
  }

  function readPower(hass, entityId) {
    if (!hasEntity(hass, entityId)) return 0;
    const stateObj = hass.states[entityId];
    const state = toNumber(stateObj.state);
    const unit = String(stateObj.attributes?.unit_of_measurement || "W").toLowerCase();
    if (unit === "kw") return state * 1000;
    if (unit === "mw") return state * 1000000;
    return state;
  }

  function formatPower(valueW, config) {
    const abs = Math.abs(valueW);
    if (abs >= config.watt_threshold) {
      return `${(valueW / 1000).toFixed(config.kw_decimals)} kW`;
    }
    return `${valueW.toFixed(config.w_decimals)} W`;
  }

  function asEntityId(value) {
    return typeof value === "string" ? value : undefined;
  }

  function asEntityObject(value) {
    return value && typeof value === "object" ? value : undefined;
  }

  function detectAutoQuality() {
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return "off";
    }

    if (typeof navigator === "undefined") return "high";

    const ua = String(navigator.userAgent || "").toLowerCase();
    const isAndroid = ua.includes("android");
    const cores = Number(navigator.hardwareConcurrency || 8);
    const memory = Number((navigator).deviceMemory || 4);

    if (isAndroid && (cores <= 2 || memory <= 2)) return "ultra_low";
    if (isAndroid && (cores <= 4 || memory <= 3)) return "low";
    if (cores <= 2) return "ultra_low";
    if (cores <= 4) return "medium";
    return "high";
  }

  function resolveQuality(config) {
    const q = String(config.animation_quality || "auto").toLowerCase();
    if (q === "auto") return detectAutoQuality();
    if (q === "high" || q === "medium" || q === "low" || q === "ultra_low" || q === "off") return q;
    return "auto";
  }

  class PowerFlowCardEco extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = undefined;
      this._hass = undefined;
      this._paused = false;
      this._inViewport = true;
      this._docVisible = true;
      this._lastRenderKey = "";

      this._onVisibility = () => {
        this._docVisible = document.visibilityState === "visible";
        this._syncAnimationState();
      };

      this._onTap = (ev) => {
        if (!this._config || this._config.clickable_entities === false) return;
        const target = ev.target;
        if (!target || typeof target.closest !== "function") return;
        const node = target.closest("[data-entity]");
        if (!node) return;
        const entityId = node.getAttribute("data-entity");
        if (!entityId) return;
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            bubbles: true,
            composed: true,
            detail: { entityId },
          })
        );
      };

      this._onKeyDown = (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        this._onTap(ev);
      };
    }

    connectedCallback() {
      this._docVisible = document.visibilityState === "visible";
      document.addEventListener("visibilitychange", this._onVisibility);

      if (typeof IntersectionObserver !== "undefined") {
        this._observer = new IntersectionObserver(
          (entries) => {
            this._inViewport = entries[0] ? entries[0].isIntersecting : true;
            this._syncAnimationState();
          },
          { threshold: 0.01 }
        );
        this._observer.observe(this);
      }

      if (this.shadowRoot) {
        this.shadowRoot.addEventListener("click", this._onTap);
        this.shadowRoot.addEventListener("keydown", this._onKeyDown);
      }

      this._render();
    }

    disconnectedCallback() {
      document.removeEventListener("visibilitychange", this._onVisibility);
      if (this.shadowRoot) {
        this.shadowRoot.removeEventListener("click", this._onTap);
        this.shadowRoot.removeEventListener("keydown", this._onKeyDown);
      }
      if (this._observer) {
        this._observer.disconnect();
        this._observer = undefined;
      }
    }

    setConfig(config) {
      if (!config || typeof config !== "object") {
        throw new Error("Invalid configuration");
      }
      if (!config.entities || typeof config.entities !== "object") {
        throw new Error("The card requires an entities object");
      }

      const hasAnyCore = Boolean(config.entities.grid || config.entities.solar || config.entities.battery);
      if (!hasAnyCore) {
        throw new Error("At least one of entities.grid, entities.solar or entities.battery is required");
      }

      this._config = {
        ...DEFAULT_CONFIG,
        ...config,
        entities: {
          ...config.entities,
        },
      };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    getCardSize() {
      return 3;
    }

    static getStubConfig() {
      return {
        type: `custom:${CARD_TYPE}`,
        title: "Power Flow Eco",
        animation_quality: "auto",
        entities: {
          solar: "sensor.solar_power",
          grid: "sensor.grid_power",
          battery: "sensor.battery_power",
          battery_soc: "sensor.battery_soc",
          home: "sensor.home_power",
        },
      };
    }

    _syncAnimationState() {
      const nextPaused = !this._docVisible || !this._inViewport;
      if (nextPaused === this._paused) return;
      this._paused = nextPaused;

      if (!this.shadowRoot) return;
      this.shadowRoot.host.style.setProperty("--eco-flow-play-state", this._paused ? "paused" : "running");
    }

    _readBatteryPowers() {
      const batteryCfg = this._config.entities.battery;
      if (!batteryCfg) {
        return { charge: 0, discharge: 0, mainEntity: undefined };
      }

      const batteryObj = asEntityObject(batteryCfg);
      if (batteryObj) {
        const chargeId = asEntityId(batteryObj.charge || batteryObj.consumption);
        const dischargeId = asEntityId(batteryObj.discharge || batteryObj.production);
        return {
          charge: Math.max(0, readPower(this._hass, chargeId)),
          discharge: Math.max(0, readPower(this._hass, dischargeId)),
          mainEntity: dischargeId || chargeId,
        };
      }

      const batteryEntity = asEntityId(batteryCfg);
      const raw = readPower(this._hass, batteryEntity);
      const chargingPositive = this._config.battery_charging_positive !== false;
      const charge = chargingPositive ? Math.max(0, raw) : Math.max(0, -raw);
      const discharge = chargingPositive ? Math.max(0, -raw) : Math.max(0, raw);
      return {
        charge,
        discharge,
        mainEntity: batteryEntity,
      };
    }

    _computeState() {
      const entities = this._config.entities;

      const solarEntity = asEntityId(entities.solar);
      const gridEntity = asEntityId(entities.grid);
      const homeEntity = asEntityId(entities.home);
      const batterySocEntity = asEntityId(entities.battery_soc);

      const solar = Math.max(0, readPower(this._hass, solarEntity));
      const gridRaw = readPower(this._hass, gridEntity);
      const gridImport = Math.max(0, gridRaw);
      const gridExport = Math.max(0, -gridRaw);
      const battery = this._readBatteryPowers();

      let homeDemand = Math.max(0, readPower(this._hass, homeEntity));
      if (!homeEntity) {
        homeDemand = Math.max(0, solar + battery.discharge + gridImport - battery.charge - gridExport);
      }

      let solarToHome = Math.min(solar, homeDemand);
      let homeRemaining = Math.max(0, homeDemand - solarToHome);

      let batteryToHome = Math.min(battery.discharge, homeRemaining);
      homeRemaining = Math.max(0, homeRemaining - batteryToHome);
      let gridToHome = homeRemaining;

      let solarExcess = Math.max(0, solar - solarToHome);
      let solarToBattery = Math.min(solarExcess, battery.charge);
      solarExcess = Math.max(0, solarExcess - solarToBattery);

      let gridToBattery = Math.max(0, battery.charge - solarToBattery);

      let solarToGrid = solarExcess;
      let batteryToGrid = Math.max(0, battery.discharge - batteryToHome);

      const computedImport = gridToHome + gridToBattery;
      if (gridImport > 0) {
        if (computedImport > 0) {
          const factor = clamp(gridImport / computedImport, 0, 10);
          gridToHome *= factor;
          gridToBattery *= factor;
        } else {
          gridToHome = gridImport;
        }
      }

      const computedExport = solarToGrid + batteryToGrid;
      if (gridExport > 0) {
        if (computedExport > 0) {
          const factor = clamp(gridExport / computedExport, 0, 10);
          solarToGrid *= factor;
          batteryToGrid *= factor;
        } else {
          solarToGrid = gridExport;
        }
      }

      return {
        nodes: {
          solar: {
            entity: solarEntity,
            label: "Solar",
            valueW: solar,
          },
          grid: {
            entity: gridEntity,
            label: "Grid",
            valueW: gridImport - gridExport,
          },
          home: {
            entity: homeEntity,
            label: "Home",
            valueW: homeDemand,
          },
          battery: {
            entity: battery.mainEntity,
            label: "Battery",
            valueW: battery.discharge - battery.charge,
            soc: batterySocEntity ? toNumber(this._hass.states[batterySocEntity]?.state) : undefined,
          },
        },
        flows: {
          solarHome: solarToHome,
          solarGrid: solarToGrid,
          solarBattery: solarToBattery,
          gridHome: gridToHome,
          batteryHome: batteryToHome,
          gridBattery: gridToBattery,
          batteryGrid: batteryToGrid,
        },
      };
    }

    _pathClass(valueW, preset, direction, colorClass, threshold) {
      if (valueW < threshold) return `flow-path ${colorClass} is-off`;
      if (!preset.animated) return `flow-path ${colorClass} is-on`;
      return `flow-path ${colorClass} is-on is-animated ${direction === "reverse" ? "is-reverse" : ""}`;
    }

    _render() {
      if (!this._config || !this._hass || !this.shadowRoot) return;

      const quality = resolveQuality(this._config);
      const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.high;
      const state = this._computeState();
      const threshold = Math.max(this._config.min_flow_show_watt, preset.minFlowShowWatt);

      const renderKey = JSON.stringify({
        quality,
        threshold,
        paused: this._paused,
        nodes: state.nodes,
        flows: state.flows,
      });
      if (renderKey === this._lastRenderKey) return;
      this._lastRenderKey = renderKey;

      const clickable = this._config.clickable_entities !== false;

      const batteryExtra =
        typeof state.nodes.battery.soc === "number" && Number.isFinite(state.nodes.battery.soc)
          ? `<div class="node-sub">${state.nodes.battery.soc.toFixed(0)}%</div>`
          : "";

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            --eco-bg: var(--card-background-color, #1f1f1f);
            --eco-text: var(--primary-text-color, #f5f5f5);
            --eco-muted: var(--secondary-text-color, #a0a0a0);
            --eco-grid: var(--energy-grid-consumption-color, #3f8fc2);
            --eco-grid-return: var(--energy-grid-return-color, #2fb67b);
            --eco-solar: var(--energy-solar-color, #ff9800);
            --eco-battery: var(--energy-battery-out-color, #f06292);
            --eco-battery-charge: var(--energy-battery-in-color, #8e5ad7);
            --eco-home: var(--energy-grid-consumption-color, #4ea8de);
            --eco-flow-play-state: running;
          }

          ha-card {
            background: var(--eco-bg);
            color: var(--eco-text);
            border-radius: 16px;
            overflow: hidden;
            ${preset.cardShadow ? "box-shadow: 0 10px 24px rgba(0,0,0,0.22);" : "box-shadow: none;"}
          }

          .wrap {
            padding: 14px 12px 12px;
          }

          .title {
            font-size: 14px;
            line-height: 1.2;
            color: var(--eco-muted);
            margin: 0 0 8px 2px;
          }

          .scene {
            position: relative;
            width: 100%;
            aspect-ratio: 30 / 22;
            max-height: 380px;
          }

          svg {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
          }

          .flow-path {
            fill: none;
            stroke-width: 3.4;
            stroke-linecap: round;
            opacity: ${preset.lineOpacity};
          }

          .flow-path.is-off {
            opacity: 0.12;
            stroke-dasharray: none;
          }

          .flow-path.is-on {
            opacity: 0.96;
          }

          .flow-path.is-animated {
            stroke-dasharray: 8 12;
            animation-name: eco-flow-dash;
            animation-duration: ${preset.flowDuration}s;
            animation-timing-function: linear;
            animation-iteration-count: infinite;
            animation-play-state: var(--eco-flow-play-state);
          }

          .flow-path.is-reverse {
            animation-direction: reverse;
          }

          .c-solar { stroke: var(--eco-solar); }
          .c-grid { stroke: var(--eco-grid); }
          .c-grid-return { stroke: var(--eco-grid-return); }
          .c-battery { stroke: var(--eco-battery); }
          .c-battery-charge { stroke: var(--eco-battery-charge); }

          .nodes {
            position: absolute;
            inset: 0;
          }

          .node {
            position: absolute;
            width: 88px;
            height: 88px;
            border-radius: 50%;
            border: 2px solid currentColor;
            background: rgba(0, 0, 0, 0.12);
            color: var(--eco-text);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            gap: 2px;
            transform: translate(-50%, -50%);
            padding: 8px;
            box-sizing: border-box;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }

          .node[data-clickable="true"] {
            cursor: pointer;
          }

          .node-label {
            font-size: 12px;
            line-height: 1;
            color: var(--eco-muted);
          }

          .node-value {
            font-size: 13px;
            line-height: 1.05;
            font-weight: 600;
          }

          .node-sub {
            font-size: 11px;
            line-height: 1;
            color: var(--eco-muted);
          }

          .node.solar { left: 50%; top: 16%; color: var(--eco-solar); }
          .node.grid { left: 13%; top: 50%; color: var(--eco-grid); }
          .node.home { left: 87%; top: 50%; color: var(--eco-home); }
          .node.battery { left: 50%; top: 84%; color: var(--eco-battery); }

          @media (max-width: 430px) {
            .node {
              width: 76px;
              height: 76px;
              padding: 6px;
            }
            .node-value { font-size: 12px; }
            .node-label { font-size: 11px; }
          }

          @keyframes eco-flow-dash {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -80; }
          }

          @media (prefers-reduced-motion: reduce) {
            .flow-path.is-animated {
              animation: none;
              stroke-dasharray: none;
            }
          }
        </style>

        <ha-card>
          <div class="wrap">
            ${this._config.title ? `<div class="title">${this._config.title}</div>` : ""}
            <div class="scene">
              <svg viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <path d="M150 35 C195 35 230 65 260 110" class="${this._pathClass(state.flows.solarHome, preset, "forward", "c-solar", threshold)}" />
                <path d="M150 35 C105 35 70 65 40 110" class="${this._pathClass(state.flows.solarGrid, preset, "forward", "c-grid-return", threshold)}" />
                <path d="M150 35 L150 185" class="${this._pathClass(state.flows.solarBattery, preset, "forward", "c-battery-charge", threshold)}" />
                <path d="M40 110 L260 110" class="${this._pathClass(state.flows.gridHome, preset, "forward", "c-grid", threshold)}" />
                <path d="M150 185 C195 185 230 155 260 110" class="${this._pathClass(state.flows.batteryHome, preset, "forward", "c-battery", threshold)}" />
                <path d="M150 185 C105 185 70 155 40 110" class="${this._pathClass(state.flows.gridBattery, preset, "reverse", "c-battery-charge", threshold)}" />
                <path d="M150 185 C105 185 70 155 40 110" class="${this._pathClass(state.flows.batteryGrid, preset, "forward", "c-battery", threshold)}" />
              </svg>

              <div class="nodes">
                <div
                  class="node solar"
                  data-entity="${state.nodes.solar.entity || ""}"
                  data-clickable="${clickable && state.nodes.solar.entity ? "true" : "false"}"
                  tabindex="${clickable && state.nodes.solar.entity ? "0" : "-1"}"
                >
                  <div class="node-label">${state.nodes.solar.label}</div>
                  <div class="node-value">${formatPower(state.nodes.solar.valueW, this._config)}</div>
                </div>

                <div
                  class="node grid"
                  data-entity="${state.nodes.grid.entity || ""}"
                  data-clickable="${clickable && state.nodes.grid.entity ? "true" : "false"}"
                  tabindex="${clickable && state.nodes.grid.entity ? "0" : "-1"}"
                >
                  <div class="node-label">${state.nodes.grid.label}</div>
                  <div class="node-value">${formatPower(state.nodes.grid.valueW, this._config)}</div>
                </div>

                <div
                  class="node home"
                  data-entity="${state.nodes.home.entity || ""}"
                  data-clickable="${clickable && state.nodes.home.entity ? "true" : "false"}"
                  tabindex="${clickable && state.nodes.home.entity ? "0" : "-1"}"
                >
                  <div class="node-label">${state.nodes.home.label}</div>
                  <div class="node-value">${formatPower(state.nodes.home.valueW, this._config)}</div>
                </div>

                <div
                  class="node battery"
                  data-entity="${state.nodes.battery.entity || ""}"
                  data-clickable="${clickable && state.nodes.battery.entity ? "true" : "false"}"
                  tabindex="${clickable && state.nodes.battery.entity ? "0" : "-1"}"
                >
                  <div class="node-label">${state.nodes.battery.label}</div>
                  <div class="node-value">${formatPower(state.nodes.battery.valueW, this._config)}</div>
                  ${batteryExtra}
                </div>
              </div>
            </div>
          </div>
        </ha-card>
      `;

      this._syncAnimationState();
    }
  }

  if (!customElements.get(CARD_TYPE)) {
    customElements.define(CARD_TYPE, PowerFlowCardEco);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.some((entry) => entry.type === CARD_TYPE)) {
    window.customCards.push({
      type: CARD_TYPE,
      name: "Power Flow Card Eco",
      description: "Lightweight power flow card optimized for low-end Android tablets",
      preview: true,
      documentationURL: "https://github.com/itsh-neumeier/lovelace-power-flow-card-eco",
    });
  }
})();
