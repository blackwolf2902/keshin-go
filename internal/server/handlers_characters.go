package server

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/blackwolf2902/keshin-go/internal/pack"
	"go.uber.org/zap"
)

// handleListCharacters lists available character packs.
func (s *Server) handleListCharacters(w http.ResponseWriter, r *http.Request) {
	packsDir := s.cfg.Character.PacksDir
	if packsDir == "" {
		packsDir = "packs"
	}

	entries, err := os.ReadDir(packsDir)
	if err != nil {
		s.logger.Error("Failed to read packs dir", zap.String("dir", packsDir), zap.Error(err))
		writeJSON(w, http.StatusOK, []pack.PackSummary{})
		return
	}

	var summaries []pack.PackSummary
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		packDir := filepath.Join(packsDir, entry.Name())
		p, err := pack.LoadPack(packDir)
		if err != nil {
			s.logger.Warn("Failed to load pack",
				zap.String("pack", entry.Name()),
				zap.Error(err),
			)
			continue
		}
		summaries = append(summaries, p.Summarize(entry.Name()))
	}

	if summaries == nil {
		summaries = []pack.PackSummary{}
	}

	writeJSON(w, http.StatusOK, summaries)
}
