"use client";

import { useEffect, useState } from "react";
import { ShimmerBlock } from "@/components/skeletons";

type WeatherState = {
  temperature: number;
  weatherCode: number;
  /** mm in the current hour (Open-Meteo `current.precipitation`). */
  precipitationCurrent: number;
  /** Forecast total for local calendar day (mm). */
  precipitationDailySum: number;
  /** True if any forecast hour in the window has measurable rain/snow (mm). */
  hourlyHasPrecipitation: boolean;
} | null;

const FALLBACK_COORDS = { latitude: 53.3811, longitude: -1.4701 };
const COORDS_STORAGE_KEY = "patch-weather-coords";

function describeWeather(code: number) {
  if (code === 0) return { label: "Clear sky", emoji: "☀️" };
  if (code === 1 || code === 2) return { label: "Partly cloudy", emoji: "🌤️" };
  if (code === 3) return { label: "Overcast", emoji: "⛅" };
  if (code === 45 || code === 48) return { label: "Fog", emoji: "🌫️" };
  if ([51, 53, 55, 56, 57, 80, 81, 82].includes(code)) return { label: "Rain showers", emoji: "🌧️" };
  if ([61, 63, 65, 66, 67].includes(code)) return { label: "Rain", emoji: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", emoji: "🌨️" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", emoji: "🌩️" };
  return { label: "Variable conditions", emoji: "🌤️" };
}

function readCachedCoords(): { latitude: number; longitude: number } | null {
  try {
    const raw = localStorage.getItem(COORDS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { latitude?: unknown; longitude?: unknown };
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

function writeCachedCoords(coords: { latitude: number; longitude: number }) {
  try {
    localStorage.setItem(COORDS_STORAGE_KEY, JSON.stringify(coords));
  } catch {
    // ignore quota / private mode
  }
}

async function fetchWeather(coords: { latitude: number; longitude: number }): Promise<WeatherState> {
  const endpoint =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}` +
    `&longitude=${coords.longitude}` +
    "&current=temperature_2m,weathercode,precipitation" +
    "&hourly=precipitation" +
    "&daily=precipitation_sum" +
    "&timezone=Europe/London&forecast_days=1";
  const res = await fetch(endpoint);
  if (!res.ok) return null;
  const data = await res.json();
  const hourlyPrecip: number[] = Array.isArray(data?.hourly?.precipitation)
    ? data.hourly.precipitation.map((x: unknown) => Number(x))
    : [];
  const trace = 0.05;
  const hourlyHasPrecipitation = hourlyPrecip.some((p) => Number.isFinite(p) && p > trace);
  return {
    temperature: Number(data?.current?.temperature_2m ?? 0),
    weatherCode: Number(data?.current?.weathercode ?? -1),
    precipitationCurrent: Number(data?.current?.precipitation ?? 0),
    precipitationDailySum: Number(data?.daily?.precipitation_sum?.[0] ?? 0),
    hourlyHasPrecipitation,
  };
}

function requestGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 30 * 60 * 1000 }
    );
  });
}

export default function DashboardWeatherWidget() {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherState>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      setLoading(true);
      try {
        // Paint weather ASAP from cached/fallback coords — don't wait on geolocation.
        const initial = readCachedCoords() ?? FALLBACK_COORDS;
        const first = await fetchWeather(initial);
        if (cancelled) return;
        if (first) {
          setWeather(first);
          setLoading(false);
        }

        const precise = await requestGeolocation();
        if (cancelled || !precise) {
          if (!first && !cancelled) setLoading(false);
          return;
        }
        writeCachedCoords(precise);
        const movedFar =
          Math.abs(precise.latitude - initial.latitude) > 0.05 ||
          Math.abs(precise.longitude - initial.longitude) > 0.05;
        if (!movedFar && first) return;
        const second = await fetchWeather(precise);
        if (!cancelled && second) setWeather(second);
      } catch {
        // Silently fail and keep widget compact.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !weather) {
    return (
      <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
        <ShimmerBlock className="h-5 w-44" />
      </div>
    );
  }

  if (!weather) return null;

  const weatherInfo = describeWeather(weather.weatherCode);
  const code = weather.weatherCode;
  /** Rain/drizzle/thunderstorm band (WMO 51–99); overcast alone (e.g. 3) does not count as rain. */
  const rainCode = code >= 51 && code <= 99;
  const trace = 0.05;
  const precipNow = weather.precipitationCurrent > trace;
  const precipDayTotal = weather.precipitationDailySum > trace;
  const precipHourlyForecast = weather.hourlyHasPrecipitation;
  const rainExpected = precipNow || precipDayTotal || precipHourlyForecast || rainCode;
  const advice = rainExpected ? "Rain expected today" : "Good day for outdoor work";

  return (
    <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-[14px]">
        <div className="min-w-0 text-[var(--c-text)]">
          <span className="mr-1">{weatherInfo.emoji}</span>
          <span className="font-semibold">{Math.round(weather.temperature)}°C</span>
          <span className="mx-1 text-[var(--c-text-subtle)]">·</span>
          <span className="text-[var(--c-text-muted)]">{weatherInfo.label}</span>
        </div>
        <div className="shrink-0 text-[12px] text-[var(--c-text-muted)]">{advice}</div>
      </div>
    </div>
  );
}
