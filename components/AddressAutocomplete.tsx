"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: string) => void;
  /** True only after a Google Places suggestion is chosen (or existing saved address on edit). */
  verified: boolean;
  onVerifiedChange: (verified: boolean) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  /** Force showing the submit validation error from the parent form. */
  showSubmitError?: boolean;
};

type AddressPrediction = {
  description: string;
  place_id: string;
};

type GooglePlacesRuntime = {
  autocompleteService: {
    getPlacePredictions: (
      request: {
        input: string;
        types: string[];
        componentRestrictions: { country: string };
      },
      callback: (predictions: AddressPrediction[] | null, status: string) => void
    ) => void;
  };
  placesService: {
    getDetails: (
      request: { placeId: string; fields: string[] },
      callback: (place: { formatted_address?: string } | null, status: string) => void
    ) => void;
  };
};

const BLUR_ERROR = "Please select an address from the dropdown suggestions";
const SUBMIT_ERROR = "Please select a valid address";

let googleLoaderConfigured = false;

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  verified,
  onVerifiedChange,
  placeholder,
  className,
  disabled,
  required,
  name,
  id,
  showSubmitError = false,
}: AddressAutocompleteProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const hasApiKey = Boolean(apiKey);
  const [runtime, setRuntime] = useState<GooglePlacesRuntime | null>(null);
  const [predictions, setPredictions] = useState<AddressPrediction[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [blurError, setBlurError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  const selectingRef = useRef(false);

  const inputClass = useMemo(() => className ?? "sheet-field-input", [className]);
  const displayError =
    showSubmitError && !verified ? SUBMIT_ERROR : blurError && !verified ? blurError : null;

  useEffect(() => {
    if (!hasApiKey || !apiKey) return;

    let mounted = true;
    void (async () => {
      try {
        if (!googleLoaderConfigured) {
          setOptions({
            key: apiKey,
            v: "weekly",
            libraries: ["places"],
          });
          googleLoaderConfigured = true;
        }

        await importLibrary("places");
        if (!mounted) return;
        const googleObj = (window as unknown as { google?: typeof google }).google;
        if (!googleObj?.maps?.places?.AutocompleteService || !googleObj?.maps?.places?.PlacesService) {
          setLoadFailed(true);
          return;
        }

        const placesService = new googleObj.maps.places.PlacesService(document.createElement("div"));
        const autocompleteService = new googleObj.maps.places.AutocompleteService();
        setRuntime({ autocompleteService, placesService });
        setLoadFailed(false);
      } catch {
        if (!mounted) return;
        setLoadFailed(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiKey, hasApiKey]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  useEffect(() => {
    if (!runtime || !hasApiKey || loadFailed) return;

    const q = value.trim();
    if (q.length < 3 || verified) {
      if (verified) {
        setPredictions([]);
        setShowSuggestions(false);
      }
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runtime.autocompleteService.getPlacePredictions(
        {
          input: q,
          types: ["address"],
          componentRestrictions: { country: "gb" },
        },
        (nextPredictions, status) => {
          if (status !== "OK" || !nextPredictions?.length) {
            setPredictions([]);
            setShowSuggestions(false);
            setHighlightIndex(-1);
            return;
          }
          setPredictions(nextPredictions);
          setShowSuggestions(true);
          setHighlightIndex(-1);
        }
      );
    }, 220);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [value, runtime, hasApiKey, loadFailed, verified]);

  const selectPrediction = (prediction: AddressPrediction) => {
    selectingRef.current = true;
    const finish = (selectedAddress: string) => {
      onChange(selectedAddress);
      onAddressSelect(selectedAddress);
      onVerifiedChange(true);
      setBlurError(null);
      setPredictions([]);
      setShowSuggestions(false);
      setHighlightIndex(-1);
      selectingRef.current = false;
    };

    if (!runtime) {
      finish(prediction.description);
      return;
    }

    runtime.placesService.getDetails(
      { placeId: prediction.place_id, fields: ["formatted_address"] },
      (place, status) => {
        const selectedAddress =
          status === "OK" && place?.formatted_address ? place.formatted_address : prediction.description;
        finish(selectedAddress);
      }
    );
  };

  const handleBlur = () => {
    // Allow mousedown on a suggestion to fire before blur clears the field.
    window.setTimeout(() => {
      if (selectingRef.current) return;
      setShowSuggestions(false);
      if (verified) {
        setBlurError(null);
        return;
      }
      if (value.trim()) {
        onChange("");
        onVerifiedChange(false);
        setBlurError(BLUR_ERROR);
        setPredictions([]);
      }
    }, 180);
  };

  return (
    <div ref={rootRef} className="address-autocomplete-root mt-2">
      <input type="hidden" name="address_verified" value={verified ? "true" : "false"} readOnly />
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          onVerifiedChange(false);
          setBlurError(null);
          if (next.trim().length < 3) {
            setPredictions([]);
            setShowSuggestions(false);
            setHighlightIndex(-1);
            return;
          }
          setShowSuggestions(true);
        }}
        onFocus={() => {
          if (!verified && predictions.length > 0) setShowSuggestions(true);
        }}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (!showSuggestions || predictions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((prev) => (prev + 1) % predictions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((prev) => (prev <= 0 ? predictions.length - 1 : prev - 1));
          } else if (e.key === "Enter" && highlightIndex >= 0) {
            e.preventDefault();
            selectPrediction(predictions[highlightIndex]!);
          } else if (e.key === "Escape") {
            setShowSuggestions(false);
          }
        }}
        placeholder={placeholder}
        className={inputClass}
        disabled={disabled}
        required={required}
        autoComplete="off"
        aria-invalid={displayError ? true : undefined}
      />

      {hasApiKey && !loadFailed && showSuggestions && predictions.length > 0 ? (
        <div className="address-autocomplete-dropdown" role="listbox">
          {predictions.map((prediction, idx) => (
            <button
              type="button"
              key={prediction.place_id}
              className={`address-autocomplete-option ${idx === highlightIndex ? "is-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectPrediction(prediction);
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              {prediction.description}
            </button>
          ))}
          <div className="address-autocomplete-branding">Powered by Google</div>
        </div>
      ) : null}

      {displayError ? (
        <p className="mt-1.5 text-[13px] text-[var(--c-danger)]" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
