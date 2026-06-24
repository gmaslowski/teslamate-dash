package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

func registerAPI(mux *http.ServeMux, s Store, cfg Config) {
	mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"title":        cfg.Title,
			"units":        cfg.Units,
			"map_style_url": cfg.MapStyleURL,
			"redact_home":  cfg.RedactHome,
			"demo":         cfg.Demo,
		})
	})

	mux.HandleFunc("/api/cars", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Cars(r.Context())
		respond(w, v, err)
	})

	mux.HandleFunc("/api/drives", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Drives(r.Context(), parseRange(r))
		respond(w, v, err)
	})

	mux.HandleFunc("/api/paths", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Paths(r.Context(), parseRange(r), cfg.Downsample)
		respond(w, v, err)
	})

	mux.HandleFunc("/api/places", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Places(r.Context())
		respond(w, v, err)
	})

	mux.HandleFunc("/api/charging", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Charging(r.Context(), parseRange(r))
		respond(w, v, err)
	})

	mux.HandleFunc("/api/stats", func(w http.ResponseWriter, r *http.Request) {
		v, err := s.Stats(r.Context(), parseRange(r))
		respond(w, v, err)
	})
}

// parseRange reads ?from=&to=&car= as either YYYY-MM-DD or RFC3339.
// Defaults to all of time so the whole history shows unless narrowed.
func parseRange(r *http.Request) Range {
	now := time.Now()
	out := Range{From: time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC), To: now.Add(24 * time.Hour)}
	if v := parseTime(r.URL.Query().Get("from")); !v.IsZero() {
		out.From = v
	}
	if v := parseTime(r.URL.Query().Get("to")); !v.IsZero() {
		out.To = v
	}
	if c := r.URL.Query().Get("car"); c != "" {
		if n, err := strconv.Atoi(c); err == nil {
			out.CarID = &n
		}
	}
	return out
}

func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

func respond(w http.ResponseWriter, v any, err error) {
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, v)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
