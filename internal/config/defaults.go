package config

// Defaults defines the hardcoded default configuration values.
// Merge priority: env > CLI flags > character.toml > keshin.toml > HardcodedDefaults
var HardcodedDefaults = Config{
	Mode: "web",
	Server: ServerConfig{
		Host: "0.0.0.0",
		Port: 8080,
	},
	Log: LogConfig{
		Level:  "info",
		Format: "console",
	},
	LLM: LLMConfig{
		Provider:    "groq",
		Model:       "llama-3.3-70b-versatile",
		MaxTokens:   512,
		Temperature: 0.7,
		Groq: ProviderSettings{
			APIKey:  "",
			Model:   "llama-3.3-70b-versatile",
			BaseURL: "https://api.groq.com/openai/v1",
		},
		Gemini: ProviderSettings{
			APIKey:  "",
			Model:   "gemini-2.0-flash-lite",
			BaseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
		},
		Ollama: ProviderSettings{
			BaseURL: "http://localhost:11434",
			Model:   "llama3.2:3b",
		},
		OpenRouter: ProviderSettings{
			APIKey:  "",
			Model:   "meta-llama/llama-3.2-3b-instruct:free",
			BaseURL: "https://openrouter.ai/api/v1",
		},
	},
	TTS: TTSConfig{
		Provider: "edge-tts",
		EdgeTTS: EdgeTTSConfig{
			Voice: "ja-JP-NanamiNeural",
			Rate:  "+0%",
			Pitch: "+0Hz",
		},
		Kokoro: KokoroConfig{
			BaseURL: "http://localhost:8880",
			Voice:   "default",
		},
		VoiceVox: VoiceVoxConfig{
			BaseURL:   "http://localhost:50021",
			SpeakerID: 0,
		},
	},
	Character: CharacterConfig{
		Default:  "hinata",
		PacksDir: "packs",
	},
	Translation: TranslationConfig{
		Enabled:    true,
		Provider:   "llm",
		SourceLang: "ja",
		TargetLang: "en",
	},
	Version: "0.1.0",
}
