package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/blackwolf2902/keshin-go/internal/bridge"
	"github.com/blackwolf2902/keshin-go/internal/config"
	"go.uber.org/zap"
)

// Server is the HTTP server for Keshin.
type Server struct {
	cfg    *config.Config
	router chi.Router
	bridge *bridge.Client
	logger *zap.Logger
	srv    *http.Server
}

// New creates a new Keshin HTTP server.
func New(cfg *config.Config, logger *zap.Logger) *Server {
	bridgeURL := fmt.Sprintf("http://localhost:%d", 9090)
	bc := bridge.NewClient(bridgeURL)

	r := chi.NewRouter()

	// Middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(120 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	s := &Server{
		cfg:    cfg,
		router: r,
		bridge: bc,
		logger: logger,
	}

	s.registerRoutes()

	return s
}

func (s *Server) registerRoutes() {
	s.router.Get("/health", s.handleHealth)
	s.router.Get("/api/health", s.handleHealth) // Also serve under /api

	s.router.Route("/api", func(r chi.Router) {
		r.Get("/characters", s.handleListCharacters)
		r.Post("/chat", s.handleChat)
		r.Get("/chat/stream", s.handleChatStream)
	})
}

// Start starts the HTTP server.
func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.cfg.Server.Host, s.cfg.Server.Port)
	s.logger.Info("Starting HTTP server", zap.String("addr", addr))

	s.srv = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return s.srv.ListenAndServe()
}

// Shutdown gracefully shuts down the server.
func (s *Server) Shutdown(ctx context.Context) error {
	return s.srv.Shutdown(ctx)
}

// handleHealth checks health of both Go and Python services.
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	pyHealth, err := s.bridge.Health()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status": "degraded",
			"go":     "ok",
			"python": fmt.Sprintf("error: %v", err),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":    pyHealth.Status,
		"go":        "ok",
		"python":    pyHealth.Status,
		"providers": pyHealth.Providers,
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	//nolint:errcheck
	json.NewEncoder(w).Encode(data)
}
