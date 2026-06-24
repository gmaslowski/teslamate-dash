package main

import (
	"context"
	"math"
	"math/rand"
	"time"
)

// demoStore generates deterministic synthetic data around a fictional area so
// the app runs and renders with no database. No real locations are used.
type demoStore struct {
	drives   []DriveSummary
	paths    map[int][][]float64
	places   []Place
	charging []ChargeSession
}

// Centre of the synthetic world (open water off the map is avoided; this is a
// neutral land point used only for demo geometry, not a real address).
const demoLat, demoLon = 50.06, 19.94

func newDemoStore() *demoStore {
	rng := rand.New(rand.NewSource(42))
	d := &demoStore{paths: map[int][][]float64{}}
	now := time.Now()

	places := []Place{
		{ID: 1, Name: "Home", Lat: demoLat, Lon: demoLon, Visits: 0, Charges: 0},
		{ID: 2, Name: "Work", Lat: demoLat + 0.05, Lon: demoLon + 0.08, Visits: 0, Charges: 0},
		{ID: 3, Name: "Supercharger", Lat: demoLat - 0.03, Lon: demoLon + 0.12, Visits: 0, Charges: 0},
		{ID: 4, Name: "Gym", Lat: demoLat + 0.02, Lon: demoLon - 0.06, Visits: 0, Charges: 0},
	}

	for i := 0; i < 16; i++ {
		start := now.AddDate(0, 0, -i*2).Add(time.Duration(8+i%6) * time.Hour)
		from := places[rng.Intn(len(places))]
		to := places[rng.Intn(len(places))]
		for to.ID == from.ID {
			to = places[rng.Intn(len(places))]
		}
		coords := wander(from.Lon, from.Lat, to.Lon, to.Lat, 26, rng)
		dist := pathKm(coords)
		dur := int(dist / 45 * 60)
		id := 1000 + i
		d.paths[id] = coords
		d.drives = append(d.drives, DriveSummary{
			ID: id, Start: start, End: start.Add(time.Duration(dur) * time.Minute),
			DistanceKm: round1(dist), DurationM: dur,
			SpeedMax: 70 + float64(rng.Intn(60)), PowerMax: 80 + float64(rng.Intn(180)),
			From: from.Name, To: to.Name, CarID: 1,
		})
		places[indexOf(places, to.ID)].Visits++
	}

	for i := 0; i < 8; i++ {
		start := now.AddDate(0, 0, -i*3).Add(20 * time.Hour)
		dc := i%3 == 0
		var loc string
		var peak, energy float64
		var kind string
		var lat, lon float64
		if dc {
			loc, kind, peak, energy = "Supercharger", "DC", 120+float64(rng.Intn(130)), 25+float64(rng.Intn(35))
			lat, lon = places[2].Lat, places[2].Lon
			places[2].Charges++
		} else {
			loc, kind, peak, energy = "Home", "AC", 11, 10+float64(rng.Intn(40))
			lat, lon = places[0].Lat, places[0].Lon
			places[0].Charges++
		}
		cost := round2(energy * 0.28)
		s0 := 20 + rng.Intn(30)
		s1 := s0 + int(energy/60*100)
		if s1 > 100 {
			s1 = 100
		}
		d.charging = append(d.charging, ChargeSession{
			ID: 2000 + i, Start: start, End: start.Add(time.Duration(int(energy/peak*60)) * time.Minute),
			EnergyKWh: round1(energy), DurationM: int(energy / peak * 60), Cost: &cost,
			Location: loc, Lat: lat, Lon: lon, SocStart: s0, SocEnd: s1, PeakKW: round1(peak), Kind: kind,
		})
	}

	d.places = places
	return d
}

func (s *demoStore) Cars(ctx context.Context) ([]Car, error) {
	return []Car{{ID: 1, Name: "Model Y", Model: "Y"}}, nil
}

func (s *demoStore) Drives(ctx context.Context, r Range) ([]DriveSummary, error) {
	return s.drives, nil
}

func (s *demoStore) Paths(ctx context.Context, r Range, downsample int) (*FeatureCollection, error) {
	fc := newFeatureCollection()
	for _, dr := range s.drives {
		if c, ok := s.paths[dr.ID]; ok && len(c) >= 2 {
			fc.Features = append(fc.Features, lineFeature(c, map[string]any{
				"drive_id": dr.ID,
				"speed":    dr.SpeedMax,
			}))
		}
	}
	return fc, nil
}

func (s *demoStore) Places(ctx context.Context) ([]Place, error)            { return s.places, nil }
func (s *demoStore) Charging(ctx context.Context, r Range) ([]ChargeSession, error) {
	return s.charging, nil
}

func (s *demoStore) Stats(ctx context.Context, r Range) (Stats, error) {
	var st Stats
	for _, dr := range s.drives {
		st.DistanceKm += dr.DistanceKm
		st.Drives++
	}
	for _, c := range s.charging {
		st.EnergyKWh += c.EnergyKWh
		st.Sessions++
		if c.Cost != nil {
			st.Cost += *c.Cost
		}
	}
	st.DistanceKm = round1(st.DistanceKm)
	st.EnergyKWh = round1(st.EnergyKWh)
	st.Cost = round2(st.Cost)
	return st, nil
}

// wander draws a jittered polyline from start to end.
func wander(x0, y0, x1, y1 float64, n int, rng *rand.Rand) [][]float64 {
	out := make([][]float64, 0, n)
	for i := 0; i <= n; i++ {
		t := float64(i) / float64(n)
		jx := (rng.Float64() - 0.5) * 0.01
		jy := (rng.Float64() - 0.5) * 0.01
		out = append(out, []float64{x0 + (x1-x0)*t + jx, y0 + (y1-y0)*t + jy})
	}
	return out
}

func pathKm(c [][]float64) float64 {
	var km float64
	for i := 1; i < len(c); i++ {
		km += haversine(c[i-1][1], c[i-1][0], c[i][1], c[i][0])
	}
	return km
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*math.Sin(dLon/2)*math.Sin(dLon/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func indexOf(p []Place, id int) int {
	for i := range p {
		if p[i].ID == id {
			return i
		}
	}
	return 0
}

func round1(f float64) float64 { return math.Round(f*10) / 10 }
func round2(f float64) float64 { return math.Round(f*100) / 100 }
