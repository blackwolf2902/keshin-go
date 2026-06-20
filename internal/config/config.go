package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config is the top-level configuration structure.
type Config struct {
	Version     string            `mapstructure:"version"`
	Mode        string            `mapstructure:"mode"`
	Server      ServerConfig      `mapstructure:"server"`
	Log         LogConfig         `mapstructure:"log"`
	LLM         LLMConfig         `mapstructure:"llm"`
	TTS         TTSConfig         `mapstructure:"tts"`
	Character   CharacterConfig   `mapstructure:"character"`
	Translation TranslationConfig `mapstructure:"translation"`
}

type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

type LLMConfig struct {
	Provider    string           `mapstructure:"provider"`
	Model       string           `mapstructure:"model"`
	MaxTokens   int              `mapstructure:"max_tokens"`
	Temperature float64          `mapstructure:"temperature"`
	Groq        ProviderSettings `mapstructure:"groq"`
	Gemini      ProviderSettings `mapstructure:"gemini"`
	Ollama      ProviderSettings `mapstructure:"ollama"`
	OpenRouter  ProviderSettings `mapstructure:"openrouter"`
}

type ProviderSettings struct {
	APIKey  string `mapstructure:"api_key"`
	Model   string `mapstructure:"model"`
	BaseURL string `mapstructure:"base_url"`
}

type TTSConfig struct {
	Provider string         `mapstructure:"provider"`
	EdgeTTS  EdgeTTSConfig  `mapstructure:"edge_tts"`
	Kokoro   KokoroConfig   `mapstructure:"kokoro"`
	VoiceVox VoiceVoxConfig `mapstructure:"voicevox"`
}

type EdgeTTSConfig struct {
	Voice string `mapstructure:"voice"`
	Rate  string `mapstructure:"rate"`
	Pitch string `mapstructure:"pitch"`
}

type KokoroConfig struct {
	BaseURL string `mapstructure:"base_url"`
	Voice   string `mapstructure:"voice"`
}

type VoiceVoxConfig struct {
	BaseURL   string `mapstructure:"base_url"`
	SpeakerID int    `mapstructure:"speaker_id"`
}

type CharacterConfig struct {
	Default  string `mapstructure:"default"`
	PacksDir string `mapstructure:"packs_dir"`
}

type TranslationConfig struct {
	Enabled    bool   `mapstructure:"enabled"`
	Provider   string `mapstructure:"provider"`
	SourceLang string `mapstructure:"source_lang"`
	TargetLang string `mapstructure:"target_lang"`
}

// Load reads and merges configuration with the priority:
// env > CLI flags > character.toml > keshin.toml > hardcoded defaults
func Load(configPaths ...string) (*Config, error) {
	v := viper.New()

	// 1. Set defaults
	bindDefaults(v)

	// 2. Read global config file (keshin.toml)
	v.SetConfigName("keshin")
	v.SetConfigType("toml")
	for _, p := range configPaths {
		v.AddConfigPath(p)
	}
	v.AddConfigPath(".") // Current directory

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("read config: %w", err)
		}
		// Config file not found is OK — defaults apply
	}

	// 3. Environment variables (KESHIV_ prefix, underscore→dot mapping)
	v.SetEnvPrefix("keshin")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// 4. Bind CLI flags (set externally before calling Load)
	// CLI flags are bound by the caller via v.BindPFlag

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}

	return &cfg, nil
}

// bindDefaults sets viper defaults from the HardcodedDefaults struct.
func bindDefaults(v *viper.Viper) {
	defaults := map[string]interface{}{
		"version":                 HardcodedDefaults.Version,
		"mode":                    HardcodedDefaults.Mode,
		"server.host":             HardcodedDefaults.Server.Host,
		"server.port":             HardcodedDefaults.Server.Port,
		"log.level":               HardcodedDefaults.Log.Level,
		"log.format":              HardcodedDefaults.Log.Format,
		"llm.provider":            HardcodedDefaults.LLM.Provider,
		"llm.model":               HardcodedDefaults.LLM.Model,
		"llm.max_tokens":          HardcodedDefaults.LLM.MaxTokens,
		"llm.temperature":         HardcodedDefaults.LLM.Temperature,
		"llm.groq.api_key":        HardcodedDefaults.LLM.Groq.APIKey,
		"llm.groq.model":          HardcodedDefaults.LLM.Groq.Model,
		"llm.groq.base_url":       HardcodedDefaults.LLM.Groq.BaseURL,
		"llm.gemini.api_key":      HardcodedDefaults.LLM.Gemini.APIKey,
		"llm.gemini.model":        HardcodedDefaults.LLM.Gemini.Model,
		"llm.gemini.base_url":     HardcodedDefaults.LLM.Gemini.BaseURL,
		"llm.ollama.base_url":     HardcodedDefaults.LLM.Ollama.BaseURL,
		"llm.ollama.model":        HardcodedDefaults.LLM.Ollama.Model,
		"llm.openrouter.api_key":  HardcodedDefaults.LLM.OpenRouter.APIKey,
		"llm.openrouter.model":    HardcodedDefaults.LLM.OpenRouter.Model,
		"llm.openrouter.base_url": HardcodedDefaults.LLM.OpenRouter.BaseURL,
		"tts.provider":            HardcodedDefaults.TTS.Provider,
		"tts.edge_tts.voice":      HardcodedDefaults.TTS.EdgeTTS.Voice,
		"tts.edge_tts.rate":       HardcodedDefaults.TTS.EdgeTTS.Rate,
		"tts.edge_tts.pitch":      HardcodedDefaults.TTS.EdgeTTS.Pitch,
		"tts.kokoro.base_url":     HardcodedDefaults.TTS.Kokoro.BaseURL,
		"tts.kokoro.voice":        HardcodedDefaults.TTS.Kokoro.Voice,
		"tts.voicevox.base_url":   HardcodedDefaults.TTS.VoiceVox.BaseURL,
		"tts.voicevox.speaker_id": HardcodedDefaults.TTS.VoiceVox.SpeakerID,
		"character.default":       HardcodedDefaults.Character.Default,
		"character.packs_dir":     HardcodedDefaults.Character.PacksDir,
		"translation.enabled":     HardcodedDefaults.Translation.Enabled,
		"translation.provider":    HardcodedDefaults.Translation.Provider,
		"translation.source_lang": HardcodedDefaults.Translation.SourceLang,
		"translation.target_lang": HardcodedDefaults.Translation.TargetLang,
	}
	for key, value := range defaults {
		v.SetDefault(key, value)
	}
}
