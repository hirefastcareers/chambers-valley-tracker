"use client";

import { useEffect, useState } from "react";
import { ShimmerBlock } from "@/components/skeletons";

type WeatherState = {
  temperature: number;
  weatherCode: number;
  precipitationSum: number;
} | null;

const FALLBACK_COORDS = { latitude: 53.3811, longitude: -1.4701 };

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

async function getCoords() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return FALLBACK_COORDS;

  return new Promise<{ latitude: number; longitude: number }>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(FALLBACK_COORDS),
      { enableHighAccuracy: false, timeout: 6000 }
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
        const coords = await getCoords();
        const endpoint =
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}` +
          `&longitude=${coords.longitude}` +
          "&current=temperature_2m,weathercode,precipitation" +
          "&daily=precipitation_sum" +
          "&timezone=Europe/London&forecast_days=1";
        const res = await fetch(endpoint);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setWeather({
          temperature: Number(data?.current?.temperature_2m ?? 0),
          weatherCode: Number(data?.current?.weathercode ?? -1),
          precipitationSum: Number(data?.daily?.precipitation_sum?.[0] ?? 0),
        });
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

  if (loading) {
    return (
      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <ShimmerBlock className="h-5 w-44" />
      </div>
    );
  }

  if (!weather) return null;

  const weatherInfo = describeWeather(weather.weatherCode);
  const rainy = weather.precipitationSum > 1;
  const advice = rainy ? "Rain expected today" : "Good day for outdoor work";

  return (
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-[14px]">
        <div className="min-w-0 text-[var(--color-text)]">
          <span className="mr-1">{weatherInfo.emoji}</span>
          <span className="font-semibold">{Math.round(weather.temperature)}°C</span>
          <span className="mx-1 text-[var(--color-text-subtle)]">·</span>
          <span className="text-[var(--color-text-muted)]">{weatherInfo.label}</span>
        </div>
        <div className="shrink-0 text-[12px] text-[var(--color-text-subtle)]">{advice}</div>
      </div>
    </div>
  );
}
