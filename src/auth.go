package main

import (
	"crypto/subtle"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// Basic Auth rate limiting: protects against password brute-force.
//   - at most RATE_MAX_FAILS_PER_MIN failed attempts per IP per minute
//   - after LOCKOUT_AFTER total failures an IP is blocked for LOCKOUT_SECONDS
const (
	RATE_MAX_FAILS_PER_MIN = 10
	LOCKOUT_AFTER          = 20
	LOCKOUT_SECONDS        = 300
)

type ipState struct {
	fails       int   // failures in current window
	windowStart int64 // unix seconds when window opened
	totalFails  int   // running total (for lockout)
	blockedTill int64 // unix seconds; 0 = not blocked
}

type authLimiter struct {
	mu    sync.Mutex
	state map[string]*ipState
}

func newAuthLimiter() *authLimiter {
	return &authLimiter{state: make(map[string]*ipState)}
}

func (l *authLimiter) clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (l *authLimiter) blocked(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	s, ok := l.state[ip]
	if !ok {
		return false
	}
	if s.blockedTill > 0 && time.Now().Unix() >= s.blockedTill {
		s.blockedTill = 0
		s.fails = 0
		s.windowStart = 0
	}
	return s.blockedTill > 0
}

func (l *authLimiter) rateLimited(ip string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now().Unix()
	s, ok := l.state[ip]
	if !ok {
		return false
	}
	if s.windowStart == 0 || now-s.windowStart >= 60 {
		s.windowStart = now
		s.fails = 0
	}
	return s.fails >= RATE_MAX_FAILS_PER_MIN
}

// recordFailure registers a failed attempt; returns lockout seconds (0 = none).
func (l *authLimiter) recordFailure(ip string) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now().Unix()
	s, ok := l.state[ip]
	if !ok {
		s = &ipState{}
		l.state[ip] = s
	}
	if s.windowStart == 0 || now-s.windowStart >= 60 {
		s.windowStart = now
		s.fails = 0
	}
	s.fails++
	s.totalFails++
	if s.totalFails >= LOCKOUT_AFTER {
		s.blockedTill = now + LOCKOUT_SECONDS
		log.Printf("auth: brute-force suspected, blocking %s for %ds", ip, LOCKOUT_SECONDS)
		return LOCKOUT_SECONDS
	}
	return 0
}

func (l *authLimiter) recordSuccess(ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	if s, ok := l.state[ip]; ok {
		s.fails = 0
		s.windowStart = 0
		s.totalFails = 0
		s.blockedTill = 0
	}
}

// basicAuth is an HTTP Basic Auth middleware with brute-force protection.
// It activates only when both TC_AUTH_USER and TC_AUTH_PASS are set
// (auth disabled otherwise), and compares credentials in constant time.
func basicAuth(user, pass string, next http.Handler) http.Handler {
	if strings.TrimSpace(user) == "" || strings.TrimSpace(pass) == "" {
		return next // auth disabled
	}
	limiter := newAuthLimiter()
	userBytes := []byte(user)
	passBytes := []byte(pass)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := limiter.clientIP(r)
		if secs := limiter.blocked(ip); secs {
			w.Header().Set("Retry-After", "300")
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}
		u, p, ok := r.BasicAuth()
		userOK := ok && subtle.ConstantTimeCompare([]byte(u), userBytes) == 1
		passOK := subtle.ConstantTimeCompare([]byte(p), passBytes) == 1
		if !userOK || !passOK {
			if limiter.rateLimited(ip) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}
			limiter.recordFailure(ip)
			log.Printf("auth: 401 from %s", ip)
			w.Header().Set("WWW-Authenticate", `Basic realm="TeslaMate Dash"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		limiter.recordSuccess(ip)
		next.ServeHTTP(w, r)
	})
}
