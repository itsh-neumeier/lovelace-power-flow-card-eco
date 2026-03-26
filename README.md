# Power Flow Card Eco

A lightweight Home Assistant Lovelace power flow card designed for weak Android tablets.

The card is written from scratch and focuses on smooth rendering with low CPU usage.

## Highlights

- New codebase (no forked source code)
- HACS-ready repository structure
- Flow animation quality levels: `auto`, `high`, `medium`, `low`, `ultra_low`, `off`
- Auto mode detects low-end Android and applies a lighter animation profile
- Animations pause automatically when the card is off-screen or tab is hidden
- No heavy SVG `animateMotion` dots

## Installation (HACS)

1. HACS -> Frontend -> Custom repositories
2. Add repository URL:
   - `https://github.com/itsh-neumeier/lovelace-power-flow-card-eco`
3. Category: `Dashboard`
4. Install `Power Flow Card Eco`
5. Restart Home Assistant

## Resource

If not auto-added, add this dashboard resource:

```yaml
url: /hacsfiles/lovelace-power-flow-card-eco/dist/power-flow-card-eco.js
type: module
```

## Basic Usage

```yaml
type: custom:power-flow-card-eco
title: Energiefluss
animation_quality: auto
entities:
  solar: sensor.solar_power
  grid: sensor.grid_power
  battery: sensor.battery_power
  battery_soc: sensor.battery_soc
  home: sensor.home_power
```

## Battery Entity Options

Single signed sensor:

```yaml
entities:
  battery: sensor.battery_power
battery_charging_positive: true
```

Split charge/discharge sensors:

```yaml
entities:
  battery:
    charge: sensor.battery_charge_power
    discharge: sensor.battery_discharge_power
```

## Config Options

| Name | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | required | `custom:power-flow-card-eco` |
| `title` | `string` | `Power Flow Eco` | Card title |
| `clickable_entities` | `boolean` | `true` | Open entity details on tap |
| `animation_quality` | `string` | `auto` | `auto`, `high`, `medium`, `low`, `ultra_low`, `off` |
| `battery_charging_positive` | `boolean` | `true` | For signed battery sensor direction |
| `watt_threshold` | `number` | `1000` | Switch from W to kW display |
| `w_decimals` | `number` | `0` | Decimals for W |
| `kw_decimals` | `number` | `1` | Decimals for kW |
| `min_flow_show_watt` | `number` | `10` | Minimum flow to show as active line |
| `entities.solar` | `string` | optional | Solar power sensor |
| `entities.grid` | `string` | optional | Grid power sensor (`+` import, `-` export) |
| `entities.home` | `string` | optional | Home load sensor |
| `entities.battery` | `string/object` | optional | Battery power sensor or `{charge, discharge}` |
| `entities.battery_soc` | `string` | optional | Battery state of charge in `%` |

## Recommended for old tablets

```yaml
type: custom:power-flow-card-eco
animation_quality: low
min_flow_show_watt: 20
```

## Recommended for very old tablets

```yaml
type: custom:power-flow-card-eco
animation_quality: ultra_low
min_flow_show_watt: 25
```

## License

MIT
