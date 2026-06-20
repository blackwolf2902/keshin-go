package pack

import (
	"fmt"
	"os"
	"path/filepath"
)

// ValidationResult holds the result of a pack validation.
type ValidationResult struct {
	Valid    bool     `json:"valid"`
	Errors   []string `json:"errors,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

// ValidatePack validates a character pack directory structure.
func ValidatePack(packDir string) *ValidationResult {
	result := &ValidationResult{Valid: true}

	// Check directory exists
	info, err := os.Stat(packDir)
	if err != nil {
		if os.IsNotExist(err) {
			result.Errors = append(result.Errors, fmt.Sprintf("pack directory not found: %s", packDir))
		} else {
			result.Errors = append(result.Errors, fmt.Sprintf("cannot access pack directory: %v", err))
		}
		result.Valid = false
		return result
	}
	if !info.IsDir() {
		result.Errors = append(result.Errors, fmt.Sprintf("pack path is not a directory: %s", packDir))
		result.Valid = false
		return result
	}

	// Check character.toml exists and is valid
	charPath := filepath.Join(packDir, "character.toml")
	if _, err := os.Stat(charPath); os.IsNotExist(err) {
		result.Errors = append(result.Errors, "missing required file: character.toml")
		result.Valid = false
	} else {
		// Try to load it
		pack, err := LoadPack(packDir)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("invalid character.toml: %v", err))
			result.Valid = false
		} else {
			_ = pack
		}
	}

	// Check personality directory and system.md (optional in Phase 1A)
	personalityDir := filepath.Join(packDir, "personality")
	if info, err := os.Stat(personalityDir); err == nil {
		if !info.IsDir() {
			result.Warnings = append(result.Warnings, "personality path is not a directory")
		} else {
			sysPath := filepath.Join(personalityDir, "system.md")
			if _, err := os.Stat(sysPath); os.IsNotExist(err) {
				result.Warnings = append(result.Warnings, "personality/system.md not found")
			}
		}
	} else {
		result.Warnings = append(result.Warnings, "personality directory not found")
	}

	// Check expressions directory (optional)
	exprDir := filepath.Join(packDir, "expressions")
	if entries, err := os.ReadDir(exprDir); err == nil {
		for _, entry := range entries {
			if !entry.IsDir() && filepath.Ext(entry.Name()) == ".toml" {
				exprPath := filepath.Join(exprDir, entry.Name())
				var exprFile CharacterExpressionFile
				if err := loadTOMLFile(exprPath, &exprFile); err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("invalid expression file %s: %v", entry.Name(), err))
					result.Valid = false
				}
			}
		}
	} else {
		result.Warnings = append(result.Warnings, "expressions directory not found")
	}

	return result
}
