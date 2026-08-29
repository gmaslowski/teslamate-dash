package main

import (
	"crypto/subtle"
	"net/http"
)

// basicAuth is a small HTTP Basic Auth middleware. It activates only when
// both TC_AUTH_USER and TC_AUTH_PASS are set (auth disabled otherwise), and
// compares credentials in constant time to avoid timing side-channels.
func basicAuth(user, pass string, next http.Handler) http.Handler {
	if user == "" || pass == "" {
		return next // auth disabled
	}
	userBytes := []byte(user)
	passBytes := []byte(pass)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, p, ok := r.BasicAuth()
		userOK := ok && subtle.ConstantTimeCompare([]byte(u), userBytes) == 1
		passOK := subtle.ConstantTimeCompare([]byte(p), passBytes) == 1
		if !userOK || !passOK {
			w.Header().Set("WWW-Authenticate", `Basic realm="TeslaMate Dash"`)
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}
