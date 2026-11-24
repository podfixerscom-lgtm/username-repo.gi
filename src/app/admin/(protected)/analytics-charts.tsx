"use client";

import { useState } from "react";

type VolumePoint = { day: string; placed: number; shippedDelivered: number };
type HourlySeries = { today: number[]; yesterday: number[] };

export function OrderVolumeChart({ data }: { data: VolumePoint[] }) {
  const max = Math.max(1, ...data.flatMap((point) => [point.placed, point.shippedDelivered]));
  return (
    <section className="admin-panel" aria-labelledby="order-volume-title">
      <h2 id="order-volume-title">Order volume</h2>
      <p>Orders placed and shipped/delivered status changes by Dhaka date.</p>
      <ul className="analytics-legend" aria-label="Chart series">
        <li><span className="analytics-legend-swatch analytics-legend-placed" aria-hidden="true" />Placed</li>
        <li><span className="analytics-legend-swatch analytics-legend-shipped" aria-hidden="true" />Shipped / delivered</li>
      </ul>
      {data.length ? (
        <>
          <figure aria-labelledby="order-volume-title">
            <ol className="analytics-bar-chart" aria-hidden="true">
              {data.map((point) => (
                <li key={point.day}>
                  <div className="analytics-bar-pair">
                    <span className="analytics-bar analytics-bar-placed" style={{ height: `${point.placed / max * 100}%` }} />
                    <span className="analytics-bar analytics-bar-shipped" style={{ height: `${point.shippedDelivered / max * 100}%` }} />
                  </div>
                  <span>{point.day.slice(5)}</span>
                </li>
              ))}
            </ol>
            <figcaption className="admin-field-help">The table below contains the exact values for each day.</figcaption>
          </figure>
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Daily order volume data</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Placed</th><th scope="col">Shipped / delivered events</th></tr></thead>
              <tbody>
                {data.map((point) => (
                  <tr key={point.day}>
                    <th scope="row">{point.day}</th>
                    <td>{point.placed}</td>
                    <td>{point.shippedDelivered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : <p>No order volume data for this date range.</p>}
    </section>
  );
}

export function HourlyWebOrdersChart({ data }: { data: HourlySeries }) {
  const [view, setView] = useState<"COMBINED" | "TODAY" | "YESTERDAY">("COMBINED");
  const combined = data.today.map((count, hour) => count + data.yesterday[hour]);
  const current = view === "TODAY" ? data.today : view === "YESTERDAY" ? data.yesterday : combined;
  const max = Math.max(1, ...current);
  const label = view === "TODAY" ? "Today" : view === "YESTERDAY" ? "Yesterday" : "Combined";
  return (
    <section className="admin-panel" aria-labelledby="hourly-orders-title">
      <div className="admin-page-title-row">
        <div>
          <h2 id="hourly-orders-title">Hourly web orders</h2>
          <p>Web-source orders by hour in Bangladesh Standard Time (UTC+06:00).</p>
        </div>
        <div className="admin-actions" role="group" aria-label="Hourly chart date range">
          {(["COMBINED", "TODAY", "YESTERDAY"] as const).map((option) => (
            <button
              className={view === option ? "admin-button" : "admin-button admin-button-secondary"}
              type="button"
              key={option}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {option === "COMBINED" ? "Combined" : option === "TODAY" ? "Today" : "Yesterday"}
            </button>
          ))}
        </div>
      </div>
      <figure aria-labelledby="hourly-orders-title" aria-describedby="hourly-orders-caption">
        <ol className="analytics-hourly-chart" aria-hidden="true">
          {current.map((count, hour) => (
            <li key={hour}>
              <span className="analytics-hour-count">{count}</span>
              <span className={`analytics-hour-bar analytics-hour-bar-${view.toLowerCase()}`} style={{ height: `${count / max * 100}%` }} />
              <span>{String(hour).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
        <figcaption id="hourly-orders-caption" className="admin-field-help">
          Visualized dataset: {label}. The table below includes all three datasets.
        </figcaption>
      </figure>
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <caption>Hourly web orders: today, yesterday, and combined</caption>
          <thead><tr><th scope="col">Hour (Dhaka)</th><th scope="col">Today</th><th scope="col">Yesterday</th><th scope="col">Combined</th></tr></thead>
          <tbody>
            {data.today.map((todayCount, hour) => (
              <tr key={hour}>
                <th scope="row">{String(hour).padStart(2, "0")}:00</th>
                <td>{todayCount}</td>
                <td>{data.yesterday[hour]}</td>
                <td>{combined[hour]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
