package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/blackwolf2902/keshin-go/internal/config"
	"github.com/blackwolf2902/keshin-go/internal/server"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"go.uber.org/zap"
)

var (
	cfgFile   string
	character string
	mode      string
	port      int
)

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

var rootCmd = &cobra.Command{
	Use:   "keshin",
	Short: "Keshin — Interactive anime character companion",
	Long: `Keshin is an interactive anime character companion that
runs locally on your machine. It uses LLMs for conversation,
TTS for voice, and 3D avatars for expression.`,
}

func init() {
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(runCmd)

	runCmd.Flags().StringVarP(&character, "character", "c", "", "Character pack to load")
	runCmd.Flags().StringVarP(&mode, "mode", "m", "web", "Run mode: web or desktop")
	runCmd.Flags().IntVarP(&port, "port", "p", 0, "Server port")
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load(nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("keshin v%s\n", cfg.Version)
	},
}

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Print effective configuration",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load(nil)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error loading config: %v\n", err)
			os.Exit(1)
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(cfg); err != nil {
			fmt.Fprintf(os.Stderr, "Error encoding config: %v\n", err)
			os.Exit(1)
		}
	},
}

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "Start the Keshin server",
	Run: func(cmd *cobra.Command, args []string) {
		logger, _ := zap.NewProduction()
		defer logger.Sync()

		logger.Info("Starting Keshin",
			zap.String("mode", mode),
			zap.Int("port", port),
			zap.String("character", character),
		)

		// Create viper and bind CLI flags so they participate in the merge chain
		// at the correct priority (env > CLI flags > character.toml > keshin.toml > defaults)
		v := viper.New()
		if err := v.BindPFlag("character.default", cmd.Flags().Lookup("character")); err != nil {
			logger.Fatal("Failed to bind character flag", zap.Error(err))
		}
		if err := v.BindPFlag("mode", cmd.Flags().Lookup("mode")); err != nil {
			logger.Fatal("Failed to bind mode flag", zap.Error(err))
		}
		if err := v.BindPFlag("server.port", cmd.Flags().Lookup("port")); err != nil {
			logger.Fatal("Failed to bind port flag", zap.Error(err))
		}

		// Load config (viper with bound flags participates in merge chain)
		cfg, err := config.Load(v)
		if err != nil {
			logger.Fatal("Failed to load config", zap.Error(err))
		}

		logger.Info("Configuration loaded",
			zap.String("llm_provider", cfg.LLM.Provider),
			zap.String("tts_provider", cfg.TTS.Provider),
			zap.String("character", cfg.Character.Default),
		)

		// Start HTTP server
		srv := server.New(cfg, logger)
		if err := srv.Start(); err != nil {
			logger.Fatal("Server failed", zap.Error(err))
		}
	},
}
