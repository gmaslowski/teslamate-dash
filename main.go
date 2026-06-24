package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

//go:embed web
var webFS embed.FS

func main() {
	cfg := loadConfig()
	log.Printf("teslamate-dash starting on :%s (demo=%v units=%s)", cfg.Port, cfg.Demo, cfg.Units)

	var store Store
	if cfg.Demo {
		store = newDemoStore()
		log.Printf("DEMO MODE: serving synthetic data, no database connection is made")
	} else {
		db, err := openDB(cfg)
		if err != nil {
			log.Fatalf("database connection failed: %v", err)
		}
		defer db.Close()
		if err := db.checkSchema(context.Background()); err != nil {
			log.Fatalf("schema check failed: %v", err)
		}
		log.Printf("connected read-only to TeslaMate database %q", cfg.dbName)
		store = db
	}

	mux := http.NewServeMux()
	registerAPI(mux, store, cfg)

	sub, err := fs.Sub(webFS, "web")
	if err != nil {
		log.Fatalf("embed: %v", err)
	}
	mux.Handle("/", http.FileServer(http.FS(sub)))

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           logRequests(mux),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	log.Printf("shut down cleanly")
}

func logRequests(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h.ServeHTTP(w, r)
		log.Printf("%s %s (%s)", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
