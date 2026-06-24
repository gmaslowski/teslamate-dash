package main

import (
	"context"
	"time"
)

// Range is the common query filter: a time window and an optional car.
type Range struct {
	From  time.Time
	To    time.Time
	CarID *int
}

// Store is the read-only data source. Both the live Postgres reader and the
// demo generator implement it, so the HTTP layer never knows the difference.
type Store interface {
	Cars(ctx context.Context) ([]Car, error)
	Drives(ctx context.Context, r Range) ([]DriveSummary, error)
	Paths(ctx context.Context, r Range, downsample int) (*FeatureCollection, error)
	Places(ctx context.Context) ([]Place, error)
	Charging(ctx context.Context, r Range) ([]ChargeSession, error)
	Stats(ctx context.Context, r Range) (Stats, error)
}

type Car struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Model string `json:"model,omitempty"`
}

type DriveSummary struct {
	ID         int       `json:"id"`
	Start      time.Time `json:"start"`
	End        time.Time `json:"end"`
	DistanceKm float64   `json:"distance_km"`
	DurationM  int       `json:"duration_min"`
	SpeedMax   float64   `json:"speed_max"`
	PowerMax   float64   `json:"power_max"`
	From       string    `json:"from"`
	To         string    `json:"to"`
	CarID      int       `json:"car_id"`
}

type Place struct {
	ID      int     `json:"id"`
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lon     float64 `json:"lon"`
	Visits  int     `json:"visits"`
	Charges int     `json:"charges"`
}

type ChargeSession struct {
	ID         int       `json:"id"`
	Start      time.Time `json:"start"`
	End        time.Time `json:"end"`
	EnergyKWh  float64   `json:"energy_kwh"`
	DurationM  int       `json:"duration_min"`
	Cost       *float64  `json:"cost"`
	Location   string    `json:"location"`
	Lat        float64   `json:"lat"`
	Lon        float64   `json:"lon"`
	SocStart   int       `json:"soc_start"`
	SocEnd     int       `json:"soc_end"`
	PeakKW     float64   `json:"peak_kw"`
	Kind       string    `json:"kind"` // "AC" or "DC"
}

type Stats struct {
	DistanceKm float64 `json:"distance_km"`
	Drives     int     `json:"drives"`
	EnergyKWh  float64 `json:"energy_kwh"`
	Sessions   int     `json:"sessions"`
	Cost       float64 `json:"cost"`
}

// GeoJSON LineString feature collection for driven roads.
type FeatureCollection struct {
	Type     string    `json:"type"`
	Features []Feature `json:"features"`
}

type Feature struct {
	Type       string         `json:"type"`
	Geometry   Geometry       `json:"geometry"`
	Properties map[string]any `json:"properties"`
}

type Geometry struct {
	Type        string      `json:"type"`
	Coordinates [][]float64 `json:"coordinates"`
}

func newFeatureCollection() *FeatureCollection {
	return &FeatureCollection{Type: "FeatureCollection", Features: []Feature{}}
}

func lineFeature(coords [][]float64, props map[string]any) Feature {
	return Feature{
		Type:       "Feature",
		Geometry:   Geometry{Type: "LineString", Coordinates: coords},
		Properties: props,
	}
}
