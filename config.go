package main

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
)

// Config is read entirely from environment variables so it drops cleanly into a
// container next to TeslaMate. It reuses TeslaMate's DATABASE_* names, and lets
// you override any of them with a TC_ prefix.
type Config struct {
	Port        string
	Demo        bool
	Units       string // "km" or "mi"
	MapStyleURL string
	RedactHome  bool
	Downsample  int
	Title       string

	dbHost string
	dbPort string
	dbName string
	dbUser string
	dbPass string
	dsn    string
}

func loadConfig() Config {
	dbHost := firstEnv("", "TC_DATABASE_HOST", "DATABASE_HOST")
	dsn := os.Getenv("TC_DSN")

	c := Config{
		Port:        firstEnv("4001", "TC_PORT"),
		Units:       firstEnv("km", "TC_UNITS"),
		MapStyleURL: firstEnv("https://tiles.openfreemap.org/styles/positron", "TC_MAP_STYLE_URL"),
		RedactHome:  envBool("TC_REDACT_HOME", true),
		Downsample:  envInt("TC_DOWNSAMPLE", 4),
		Title:       firstEnv("TeslaMate Dash", "TC_TITLE"),

		dbHost: dbHost,
		dbPort: firstEnv("5432", "TC_DATABASE_PORT", "DATABASE_PORT"),
		dbName: firstEnv("teslamate", "TC_DATABASE_NAME", "DATABASE_NAME"),
		dbUser: firstEnv("teslamate", "TC_DATABASE_USER", "DATABASE_USER"),
		dbPass: firstEnv("", "TC_DATABASE_PASS", "DATABASE_PASS"),
		dsn:    dsn,
	}
	// Demo on by default when there is nothing to connect to.
	noDB := dsn == "" && dbHost == ""
	c.Demo = envBool("TC_DEMO", noDB)
	if c.Downsample < 1 {
		c.Downsample = 1
	}
	if c.Units != "mi" {
		c.Units = "km"
	}
	return c
}

// DSN builds a libpq-style connection string. SSL is left to the operator via
// TC_DSN if they need it; the common case (sharing TeslaMate's compose network)
// is plaintext on a private network.
func (c Config) DSN() string {
	if c.dsn != "" {
		return c.dsn
	}
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		url.QueryEscape(c.dbUser), url.QueryEscape(c.dbPass),
		c.dbHost, c.dbPort, c.dbName)
}

func firstEnv(def string, keys ...string) string {
	for _, k := range keys {
		if v := os.Getenv(k); v != "" {
			return v
		}
	}
	return def
}

func envBool(key string, def bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return def
	}
	return b
}

func envInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
