package pack

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pelletier/go-toml/v2"
)

// CharacterPack represents a loaded character pack.
type CharacterPack struct {
	Character   CharacterMeta `toml:"character"`
	Model       *ModelConfig  `toml:"model,omitempty"`
	Voice       *VoiceConfig  `toml:"voice,omitempty"`
	Expressions []Expression  `toml:"-"`
	// Loaded paths
	BasePath     string `toml:"-"`
	SystemPrompt string `toml:"-"`
}

// CharacterMeta holds the character metadata.
type CharacterMeta struct {
	Name        string `toml:"name"`
	Lang        string `toml:"lang"`
	Description string `toml:"description,omitempty"`
	Author      string `toml:"author,omitempty"`
	Version     string `toml:"version,omitempty"`
}

// ModelConfig holds 3D model configuration (optional for Phase 1A).
type ModelConfig struct {
	VRM string `toml:"vrm"`
}

// VoiceConfig holds TTS voice configuration.
type VoiceConfig struct {
	Provider string `toml:"provider"`
	Speaker  string `toml:"speaker,omitempty"`
	Rate     string `toml:"rate,omitempty"`
	Pitch    string `toml:"pitch,omitempty"`
}

// Expression represents an emotion expression from an expression file.
type Expression struct {
	Name        string             `toml:"-"`
	BlendShapes map[string]float64 `toml:"blend_shapes"`
}

// CharacterExpressionFile is the TOML structure for individual expression files.
type CharacterExpressionFile struct {
	Expression struct {
		Name        string `toml:"name"`
		Description string `toml:"description,omitempty"`
	} `toml:"expression"`
	BlendShapes map[string]float64 `toml:"blend_shapes"`
}

// LoadPack loads a character pack from the given directory path.
func LoadPack(packDir string) (*CharacterPack, error) {
	pack := &CharacterPack{BasePath: packDir}

	// Load character.toml
	charPath := filepath.Join(packDir, "character.toml")
	if err := loadTOMLFile(charPath, pack); err != nil {
		return nil, fmt.Errorf("load character.toml: %w", err)
	}

	if pack.Character.Name == "" {
		return nil, fmt.Errorf("character.toml missing required field: character.name")
	}
	if pack.Character.Lang == "" {
		return nil, fmt.Errorf("character.toml missing required field: character.lang")
	}

	// Load system prompt from personality/system.md
	systemPromptPath := filepath.Join(packDir, "personality", "system.md")
	if data, err := os.ReadFile(systemPromptPath); err == nil {
		pack.SystemPrompt = string(data)
	} else {
		if os.IsNotExist(err) {
			pack.SystemPrompt = ""
		} else {
			return nil, fmt.Errorf("read system.md: %w", err)
		}
	}

	// Load expressions from expressions/*.toml
	exprDir := filepath.Join(packDir, "expressions")
	entries, err := os.ReadDir(exprDir)
	if err != nil {
		if os.IsNotExist(err) {
			pack.Expressions = []Expression{}
		} else {
			return nil, fmt.Errorf("read expressions dir: %w", err)
		}
	} else {
		for _, entry := range entries {
			if entry.IsDir() || filepath.Ext(entry.Name()) != ".toml" {
				continue
			}
			exprPath := filepath.Join(exprDir, entry.Name())
			var exprFile CharacterExpressionFile
			if err := loadTOMLFile(exprPath, &exprFile); err != nil {
				return nil, fmt.Errorf("load expression %s: %w", entry.Name(), err)
			}
			pack.Expressions = append(pack.Expressions, Expression{
				Name:        trimExt(entry.Name()),
				BlendShapes: exprFile.BlendShapes,
			})
		}
	}

	return pack, nil
}

func loadTOMLFile(path string, target interface{}) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	return toml.Unmarshal(data, target)
}

func trimExt(name string) string {
	return name[:len(name)-len(filepath.Ext(name))]
}

// PackSummary is a lightweight summary of a character pack (for API responses).
type PackSummary struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Lang        string `json:"lang"`
	Description string `json:"description,omitempty"`
	Author      string `json:"author,omitempty"`
	Version     string `json:"version,omitempty"`
	Voice       string `json:"voice,omitempty"`
}

// Summarize creates a PackSummary from a CharacterPack.
func (p *CharacterPack) Summarize(packID string) PackSummary {
	s := PackSummary{
		ID:          packID,
		Name:        p.Character.Name,
		Lang:        p.Character.Lang,
		Description: p.Character.Description,
		Author:      p.Character.Author,
		Version:     p.Character.Version,
	}
	if p.Voice != nil {
		s.Voice = p.Voice.Provider
	}
	return s
}
