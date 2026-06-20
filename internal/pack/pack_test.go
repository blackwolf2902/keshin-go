package pack

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadPack_Hinata(t *testing.T) {
	pack, err := LoadPack("../../packs/hinata")
	require.NoError(t, err)
	require.NotNil(t, pack)

	assert.Equal(t, "Hinata", pack.Character.Name)
	assert.Equal(t, "ja", pack.Character.Lang)
	assert.Equal(t, "A cheerful and energetic Japanese high school girl", pack.Character.Description)
	assert.Equal(t, "Keshin Dev", pack.Character.Author)
	assert.Equal(t, "0.1.0", pack.Character.Version)
	assert.NotEmpty(t, pack.SystemPrompt)
	assert.Contains(t, pack.SystemPrompt, "Hinata")

	// Voice config
	require.NotNil(t, pack.Voice)
	assert.Equal(t, "edge-tts", pack.Voice.Provider)

	// Expressions
	require.Len(t, pack.Expressions, 2)
	assert.Equal(t, "happy", pack.Expressions[0].Name)
	assert.Equal(t, 0.8, pack.Expressions[0].Intensity)
	assert.Equal(t, "thinking", pack.Expressions[1].Name)
	assert.Equal(t, 0.3, pack.Expressions[1].Intensity)
}

func TestLoadPack_Example(t *testing.T) {
	pack, err := LoadPack("../../packs/_example")
	require.NoError(t, err)
	require.NotNil(t, pack)

	assert.Equal(t, "Example", pack.Character.Name)
	assert.Equal(t, "ja", pack.Character.Lang)
	assert.NotEmpty(t, pack.SystemPrompt)
	require.Len(t, pack.Expressions, 1)
	assert.Equal(t, "happy", pack.Expressions[0].Name)
}

func TestLoadPack_Invalid(t *testing.T) {
	pack, err := LoadPack("../../packs/nonexistent")
	require.Error(t, err)
	assert.Nil(t, pack)
}

func TestSummarize(t *testing.T) {
	pack, err := LoadPack("../../packs/hinata")
	require.NoError(t, err)

	summary := pack.Summarize("hinata")
	assert.Equal(t, "hinata", summary.ID)
	assert.Equal(t, "Hinata", summary.Name)
	assert.Equal(t, "ja", summary.Lang)
	assert.Equal(t, "edge-tts", summary.Voice)
}

func TestValidatePack_Hinata(t *testing.T) {
	result := ValidatePack("../../packs/hinata")
	assert.True(t, result.Valid)
	assert.Empty(t, result.Errors)
}

func TestValidatePack_Invalid(t *testing.T) {
	result := ValidatePack("../../packs/nonexistent")
	assert.False(t, result.Valid)
	assert.NotEmpty(t, result.Errors)
}
