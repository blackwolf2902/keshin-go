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
	assert.Equal(t, "A cheerful schoolgirl who loves ramen and stargazing.", pack.Character.Description)
	assert.Equal(t, "keshin-community", pack.Character.Author)
	assert.Equal(t, "1.0.0", pack.Character.Version)
	assert.NotEmpty(t, pack.SystemPrompt)
	assert.Contains(t, pack.SystemPrompt, "Hinata")

	// Voice config
	require.NotNil(t, pack.Voice)
	assert.Equal(t, "edge-tts", pack.Voice.Provider)

	// Expressions
	require.Len(t, pack.Expressions, 6)
	// Find happy expression by name (files loaded alphabetically)
	happyFound := false
	for _, e := range pack.Expressions {
		if e.Name == "happy" {
			happyFound = true
			assert.NotNil(t, e.BlendShapes)
			assert.Contains(t, e.BlendShapes, "happy")
			break
		}
	}
	assert.True(t, happyFound, "happy expression should be in pack")
	assert.Contains(t, pack.Expressions[0].BlendShapes, "angry", "first expression should be angry")
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
