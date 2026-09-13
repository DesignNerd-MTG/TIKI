"use client";

import { useEffect, useState } from "react";

type Weather = { current: number; high: number; low: number; precipitation: number; code: number };
type CachedStatus = { savedAt: number; location: string; weather: Weather | null };

const cacheKey = "tiki-dashboard-status-v1";
const cacheLifetime = 30 * 60 * 1000;

function weatherCondition(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storms";
  return "Current conditions";
}

function validWeather(value: unknown): value is Weather {
  if (!value || typeof value !== "object") return false;
  const weather = value as Record<string, unknown>;
  return ["current", "high", "low", "precipitation", "code"].every((key) => typeof weather[key] === "number" && Number.isFinite(weather[key]));
}

export function DashboardStatus() {
  const [now, setNow] = useState<Date | null>(null);
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(new Date()), 0);
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const controller = new AbortController();

    try {
      const cached = JSON.parse(window.sessionStorage.getItem(cacheKey) ?? "null") as CachedStatus | null;
      if (cached && Date.now() - cached.savedAt < cacheLifetime && typeof cached.location === "string") {
        const cachedUpdate = window.setTimeout(() => {
          setLocation(cached.location);
          setWeather(validWeather(cached.weather) ? cached.weather : null);
        }, 0);
        return () => { window.clearTimeout(initial); window.clearTimeout(cachedUpdate); window.clearInterval(timer); controller.abort(); };
      }
    } catch { /* A disabled or malformed session cache should not affect the dashboard. */ }

    void fetch("https://ipwho.is/", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then(async (data) => {
        if (!data || data.success === false) return;
        const place = [data.city, data.region].filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 2).join(", ");
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);
        let nextWeather: Weather | null = null;
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          const params = new URLSearchParams({
            latitude: String(latitude), longitude: String(longitude), temperature_unit: "fahrenheit", timezone: "auto", forecast_days: "1",
            current: "temperature_2m,weather_code", daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
          });
          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal, cache: "no-store" });
          const forecast = response.ok ? await response.json() : null;
          const candidate = { current: Number(forecast?.current?.temperature_2m), code: Number(forecast?.current?.weather_code), high: Number(forecast?.daily?.temperature_2m_max?.[0]), low: Number(forecast?.daily?.temperature_2m_min?.[0]), precipitation: Number(forecast?.daily?.precipitation_probability_max?.[0]) };
          if (validWeather(candidate)) nextWeather = candidate;
        }
        setLocation(place);
        setWeather(nextWeather);
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), location: place, weather: nextWeather } satisfies CachedStatus)); } catch { /* Best-effort cache. */ }
      })
      .catch(() => {});

    return () => { window.clearTimeout(initial); window.clearInterval(timer); controller.abort(); };
  }, []);

  if (!now) return <div className="dashboard-status" aria-label="Local status" />;
  return <div className="dashboard-status" aria-label="Local status">
    <time dateTime={now.toISOString()}>{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now)}</time>
    <span>{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now)}</span>
    {location && <span>{location}</span>}
    {weather && <span className="dashboard-status__weather" title={`${weatherCondition(weather.code)}. Today’s high ${Math.round(weather.high)}°, low ${Math.round(weather.low)}°.`}><strong>{Math.round(weather.current)}°</strong><span>{weatherCondition(weather.code)}</span><span>H {Math.round(weather.high)}° · L {Math.round(weather.low)}°{weather.precipitation >= 20 ? ` · ${Math.round(weather.precipitation)}% rain` : ""}</span></span>}
  </div>;
}
