package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	pool *pgxpool.Pool
}

// openDB opens a connection pool and forces every session into read-only mode
// as defense in depth. You should still point it at a read-only role (see README).
func openDB(cfg Config) (*DB, error) {
	pcfg, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	if pcfg.ConnConfig.RuntimeParams == nil {
		pcfg.ConnConfig.RuntimeParams = map[string]string{}
	}
	pcfg.ConnConfig.RuntimeParams["default_transaction_read_only"] = "on"
	pcfg.ConnConfig.RuntimeParams["application_name"] = "teslamate-dash"
	pcfg.MaxConns = 4

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	pool, err := pgxpool.NewWithConfig(ctx, pcfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &DB{pool: pool}, nil
}

func (d *DB) Close() { d.pool.Close() }

// checkSchema verifies the TeslaMate tables we read actually exist, so a
// misconfigured DB fails loudly at startup instead of mid-request.
func (d *DB) checkSchema(ctx context.Context) error {
	required := []string{"drives", "positions", "charging_processes", "charges", "addresses", "geofences", "cars"}
	var missing []string
	for _, t := range required {
		var reg *string
		if err := d.pool.QueryRow(ctx, "SELECT to_regclass($1)", "public."+t).Scan(&reg); err != nil {
			return err
		}
		if reg == nil {
			missing = append(missing, t)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("missing expected TeslaMate tables: %s", strings.Join(missing, ", "))
	}
	return nil
}

func args(r Range) []any { return []any{r.From, r.To, r.CarID} }

func (d *DB) Cars(ctx context.Context) ([]Car, error) {
	rows, err := d.pool.Query(ctx, `SELECT id, COALESCE(name,''), COALESCE(model,'') FROM cars ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Car
	for rows.Next() {
		var c Car
		if err := rows.Scan(&c.ID, &c.Name, &c.Model); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (d *DB) Drives(ctx context.Context, r Range) ([]DriveSummary, error) {
	const q = `
SELECT d.id, d.start_date, COALESCE(d.end_date, d.start_date),
       COALESCE(d.distance,0)::float8, COALESCE(d.duration_min,0),
       COALESCE(d.speed_max,0)::float8, COALESCE(d.power_max,0)::float8,
       COALESCE(sa.display_name,'Unknown'), COALESCE(ea.display_name,'Unknown'),
       d.car_id
FROM drives d
LEFT JOIN addresses sa ON sa.id = d.start_address_id
LEFT JOIN addresses ea ON ea.id = d.end_address_id
WHERE d.start_date >= $1 AND d.start_date < $2
  AND ($3::int IS NULL OR d.car_id = $3)
ORDER BY d.start_date DESC
LIMIT 5000`
	rows, err := d.pool.Query(ctx, q, args(r)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DriveSummary
	for rows.Next() {
		var s DriveSummary
		if err := rows.Scan(&s.ID, &s.Start, &s.End, &s.DistanceKm, &s.DurationM,
			&s.SpeedMax, &s.PowerMax, &s.From, &s.To, &s.CarID); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func (d *DB) Paths(ctx context.Context, r Range, downsample int) (*FeatureCollection, error) {
	const q = `
SELECT drive_id, longitude, latitude, COALESCE(speed,0)
FROM (
  SELECT p.drive_id, p.longitude, p.latitude, p.speed, p.date,
         row_number() OVER (PARTITION BY p.drive_id ORDER BY p.date) AS rn
  FROM positions p
  JOIN drives d ON d.id = p.drive_id
  WHERE d.start_date >= $1 AND d.start_date < $2
    AND ($3::int IS NULL OR d.car_id = $3)
    AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
) s
WHERE rn % $4 = 1
ORDER BY drive_id, rn`
	rows, err := d.pool.Query(ctx, q, r.From, r.To, r.CarID, downsample)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fc := newFeatureCollection()
	var curID int
	var coords [][]float64
	var maxSpeed float64
	flush := func() {
		if len(coords) >= 2 {
			fc.Features = append(fc.Features, lineFeature(coords, map[string]any{
				"drive_id": curID,
				"speed":    maxSpeed,
			}))
		}
	}
	first := true
	for rows.Next() {
		var did int
		var lon, lat, speed float64
		if err := rows.Scan(&did, &lon, &lat, &speed); err != nil {
			return nil, err
		}
		if first {
			curID, first = did, false
		}
		if did != curID {
			flush()
			coords = nil
			maxSpeed = 0
			curID = did
		}
		coords = append(coords, []float64{lon, lat})
		if speed > maxSpeed {
			maxSpeed = speed
		}
	}
	flush()
	return fc, rows.Err()
}

func (d *DB) Places(ctx context.Context) ([]Place, error) {
	const q = `
SELECT g.id, COALESCE(g.name,'Unnamed'), g.latitude, g.longitude,
   (SELECT count(*) FROM drives dd WHERE dd.end_geofence_id = g.id) AS visits,
   (SELECT count(*) FROM charging_processes cc WHERE cc.geofence_id = g.id) AS charges
FROM geofences g
ORDER BY visits DESC, charges DESC
LIMIT 500`
	rows, err := d.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Place
	for rows.Next() {
		var p Place
		if err := rows.Scan(&p.ID, &p.Name, &p.Lat, &p.Lon, &p.Visits, &p.Charges); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (d *DB) Charging(ctx context.Context, r Range) ([]ChargeSession, error) {
	const q = `
SELECT c.id, c.start_date, COALESCE(c.end_date, c.start_date),
   COALESCE(c.charge_energy_added,0)::float8, COALESCE(c.duration_min,0), c.cost::float8,
   COALESCE(g.name, a.display_name, 'Unknown'),
   COALESCE(p.latitude, g.latitude, a.latitude, 0)::float8,
   COALESCE(p.longitude, g.longitude, a.longitude, 0)::float8,
   COALESCE(c.start_battery_level,0), COALESCE(c.end_battery_level,0),
   COALESCE((SELECT max(ch.charger_power) FROM charges ch WHERE ch.charging_process_id = c.id),0)::float8,
   (SELECT max(ch.charger_phases) FROM charges ch WHERE ch.charging_process_id = c.id)
FROM charging_processes c
LEFT JOIN geofences g ON g.id = c.geofence_id
LEFT JOIN addresses a ON a.id = c.address_id
LEFT JOIN positions p ON p.id = c.position_id
WHERE c.start_date >= $1 AND c.start_date < $2
  AND ($3::int IS NULL OR c.car_id = $3)
ORDER BY c.start_date DESC
LIMIT 5000`
	rows, err := d.pool.Query(ctx, q, args(r)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ChargeSession
	for rows.Next() {
		var s ChargeSession
		var phases *int
		if err := rows.Scan(&s.ID, &s.Start, &s.End, &s.EnergyKWh, &s.DurationM, &s.Cost,
			&s.Location, &s.Lat, &s.Lon, &s.SocStart, &s.SocEnd, &s.PeakKW, &phases); err != nil {
			return nil, err
		}
		s.Kind = chargeKind(phases, s.PeakKW)
		out = append(out, s)
	}
	return out, rows.Err()
}

func (d *DB) Stats(ctx context.Context, r Range) (Stats, error) {
	const q = `
SELECT
 (SELECT COALESCE(sum(distance),0)::float8 FROM drives WHERE start_date>=$1 AND start_date<$2 AND ($3::int IS NULL OR car_id=$3)),
 (SELECT count(*) FROM drives WHERE start_date>=$1 AND start_date<$2 AND ($3::int IS NULL OR car_id=$3)),
 (SELECT COALESCE(sum(charge_energy_added),0)::float8 FROM charging_processes WHERE start_date>=$1 AND start_date<$2 AND ($3::int IS NULL OR car_id=$3)),
 (SELECT count(*) FROM charging_processes WHERE start_date>=$1 AND start_date<$2 AND ($3::int IS NULL OR car_id=$3)),
 (SELECT COALESCE(sum(cost),0)::float8 FROM charging_processes WHERE start_date>=$1 AND start_date<$2 AND ($3::int IS NULL OR car_id=$3))`
	var s Stats
	err := d.pool.QueryRow(ctx, q, args(r)...).Scan(&s.DistanceKm, &s.Drives, &s.EnergyKWh, &s.Sessions, &s.Cost)
	return s, err
}

// chargeKind infers AC vs DC. TeslaMate records a phase count for AC charging;
// DC fast charging reports no phases.
func chargeKind(phases *int, peakKW float64) string {
	if phases == nil || *phases == 0 {
		return "DC"
	}
	return "AC"
}
