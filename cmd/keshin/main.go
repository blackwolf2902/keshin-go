package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/blackwolf2902/keshin-go/internal/config"
	"github.com/blackwolf2902/keshin-go/internal/server"
	"github.com/spf13/cobra"
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
		cfg, err := config.Load()
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
		cfg, err := config.Load()
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

		// Load config
		cfg, err := config.Load()
		if err != nil {
			logger.Fatal("Failed to load config", zap.Error(err))
		}

		// Override with CLI flags
		if character != "" {
			cfg.Character.Default = character
		}
		if mode != "" {
			cfg.Mode = mode
		}
		if port != 0 {
			cfg.Server.Port = port
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
