# ============================================================================
# Vector — Build & Dev Commands
# Usage: make <target>    (run from project root)
# ============================================================================

MOBILE_DIR   := mobile
BACKEND_DIR  := backend
LANDING_DIR  := customer-webpage
ML_DIR       := ml
ML_VENV      := $(ML_DIR)/.venv
ML_PYTHON    := $(ML_VENV)/bin/python
ANDROID_DIR  := $(MOBILE_DIR)/android
IOS_DIR      := $(MOBILE_DIR)/ios
APK_OUTPUT   := $(ANDROID_DIR)/app/build/outputs/apk/release/app-release.apk
AAB_OUTPUT   := $(ANDROID_DIR)/app/build/outputs/bundle/release/app-release.aab
IPA_OUTPUT   := $(DIST_DIR)/Vector.ipa
DIST_DIR     := dist
SCHEME       := Vector
WORKSPACE    := $(IOS_DIR)/Vector.xcworkspace
ARCHIVE_PATH := $(DIST_DIR)/Vector.xcarchive

.PHONY: help dev dev-mobile dev-backend dev-landing dev-all prebuild prebuild-clean \
        apk aab apk-debug ios ios-sim ios-device ios-archive ipa \
        install-deps typecheck clean clean-android clean-ios \
        eas-apk eas-aab eas-ios clean-all \
        nlu-setup nlu-train-intent nlu-train-entity nlu-train nlu-test nlu-all

# ── Help ────────────────────────────────────────────────────────────────────

help: ## Show this help
	@echo ""
	@echo "  Vector Build System"
	@echo "  ────────────────────────────────────────"
	@echo ""
	@echo "  \033[33mDevelopment\033[0m"
	@grep -E '^(dev|dev-mobile|dev-backend|dev-landing|dev-all|typecheck|install-deps):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  \033[33mAndroid (local builds — free, no queue)\033[0m"
	@grep -E '^(apk|aab|apk-debug):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  \033[33miOS (local builds — free, no queue)\033[0m"
	@grep -E '^(ios-sim|ios-device|ipa):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  \033[33mEAS Cloud Builds (free tier: 30 builds/mo, has queue)\033[0m"
	@grep -E '^(eas-apk|eas-aab|eas-ios):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  \033[33mNLU / ML\033[0m"
	@grep -E '^(nlu-setup|nlu-train-intent|nlu-train-entity|nlu-train|nlu-test|nlu-all):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "  \033[33mMaintenance\033[0m"
	@grep -E '^(prebuild|prebuild-clean|clean|clean-android|clean-ios|clean-all):.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "    \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ── Development ─────────────────────────────────────────────────────────────

dev: ## Start both mobile + backend in parallel
	@echo "Starting backend and mobile..."
	@make -j2 dev-backend dev-mobile

dev-mobile: ## Start Metro bundler (dev-client mode)
	cd $(MOBILE_DIR) && npm start

dev-backend: ## Start FastAPI backend with hot reload
	cd $(BACKEND_DIR) && uvicorn app:app --reload --host 0.0.0.0 --port 8000

dev-landing: ## Start landing page dev server
	cd $(LANDING_DIR) && npm run dev

dev-all: ## Start backend + mobile + landing in parallel
	@echo "Starting backend, mobile, and landing page..."
	@make -j3 dev-backend dev-mobile dev-landing

# ── Type Check ──────────────────────────────────────────────────────────────

typecheck: ## Run TypeScript type check
	cd $(MOBILE_DIR) && npx tsc --noEmit

# ── Dependencies ────────────────────────────────────────────────────────────

install-deps: ## Install all dependencies (mobile + backend)
	cd $(MOBILE_DIR) && npm install
	cd $(BACKEND_DIR) && pip install -r requirements.txt

# ── Prebuild (generate native projects) ─────────────────────────────────────

prebuild: ## Generate ios/ and android/ native dirs
	cd $(MOBILE_DIR) && npx expo prebuild

prebuild-clean: ## Clean regenerate native dirs (fresh start)
	cd $(MOBILE_DIR) && npx expo prebuild --clean

# ── Android Builds (local, free, no EAS queue) ─────────────────────────────

apk: prebuild typecheck ## Build production APK
	@echo "Building release APK..."
	cd $(ANDROID_DIR) && ./gradlew assembleRelease
	@mkdir -p $(DIST_DIR)
	@cp $(APK_OUTPUT) $(DIST_DIR)/vector-release.apk 2>/dev/null && \
		echo "\n✅ APK ready: $(DIST_DIR)/vector-release.apk" || \
		echo "\n❌ APK not found at expected path. Check gradle output."

aab: prebuild typecheck ## Build production AAB (Play Store)
	@echo "Building release AAB..."
	cd $(ANDROID_DIR) && ./gradlew bundleRelease
	@mkdir -p $(DIST_DIR)
	@cp $(AAB_OUTPUT) $(DIST_DIR)/vector-release.aab 2>/dev/null && \
		echo "\n✅ AAB ready: $(DIST_DIR)/vector-release.aab" || \
		echo "\n❌ AAB not found at expected path. Check gradle output."

apk-debug: prebuild ## Build debug APK (for testing)
	cd $(ANDROID_DIR) && ./gradlew assembleDebug
	@echo "\n✅ Debug APK: $(ANDROID_DIR)/app/build/outputs/apk/debug/app-debug.apk"

# ── iOS Builds (local, free, no EAS queue) ──────────────────────────────────

ios-sim: prebuild typecheck ## Build & run on iOS Simulator
	cd $(MOBILE_DIR) && npx expo run:ios

ios-device: prebuild typecheck ## Build & run on connected iOS device
	cd $(MOBILE_DIR) && npx expo run:ios --device

ios-archive: prebuild typecheck ## Build Xcode archive (requires signing)
	@echo "Installing CocoaPods..."
	cd $(IOS_DIR) && pod install
	@echo "Building Xcode archive..."
	@mkdir -p $(DIST_DIR)
	xcodebuild -workspace $(WORKSPACE) \
		-scheme $(SCHEME) \
		-configuration Release \
		-archivePath $(ARCHIVE_PATH) \
		-destination "generic/platform=iOS" \
		archive \
		CODE_SIGN_IDENTITY="" \
		CODE_SIGNING_REQUIRED=NO \
		CODE_SIGNING_ALLOWED=NO
	@echo "\n✅ Archive ready: $(ARCHIVE_PATH)"
	@echo "   To distribute, open in Xcode: open $(ARCHIVE_PATH)"

ipa: ios-archive ## Build IPA from archive (ad-hoc / App Store)
	@echo "Exporting IPA..."
	@echo '<?xml version="1.0" encoding="UTF-8"?>\n\
	<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n\
	<plist version="1.0"><dict>\n\
	<key>method</key><string>ad-hoc</string>\n\
	<key>compileBitcode</key><false/>\n\
	</dict></plist>' > $(DIST_DIR)/export-options.plist
	xcodebuild -exportArchive \
		-archivePath $(ARCHIVE_PATH) \
		-exportPath $(DIST_DIR) \
		-exportOptionsPlist $(DIST_DIR)/export-options.plist
	@rm -f $(DIST_DIR)/export-options.plist
	@echo "\n✅ IPA ready: $(DIST_DIR)/"

# ── EAS Builds (cloud — if you prefer, has queue on free tier) ──────────────

eas-apk: ## Build APK on EAS servers (has queue wait)
	cd $(MOBILE_DIR) && npx eas-cli build --platform android --profile production-apk

eas-aab: ## Build AAB on EAS servers for Play Store
	cd $(MOBILE_DIR) && npx eas-cli build --platform android --profile production

eas-ios: ## Build iOS on EAS servers (handles signing)
	cd $(MOBILE_DIR) && npx eas-cli build --platform ios --profile production

# ── NLU / ML ───────────────────────────────────────────────────────────────

$(ML_VENV): $(ML_DIR)/requirements.txt
	@echo "Creating ml venv with uv..."
	cd $(ML_DIR) && uv venv && uv pip install --python .venv/bin/python -r requirements.txt
	@touch $(ML_VENV)

nlu-setup: $(ML_VENV) ## Create ml venv and install deps via uv

nlu-train-intent: $(ML_VENV) ## Train the intent classifier model
	cd $(ML_DIR) && $(abspath $(ML_PYTHON)) train_intent_model.py

nlu-train-entity: $(ML_VENV) ## Train the entity (NER) model
	cd $(ML_DIR) && $(abspath $(ML_PYTHON)) train_entity_model.py

nlu-train: nlu-train-intent nlu-train-entity ## Train both intent + entity models

nlu-test: $(ML_VENV) ## Run NLU pipeline tests
	cd $(ML_DIR) && $(abspath $(ML_PYTHON)) test_pipeline.py

nlu-all: nlu-train nlu-test ## Train all models then run tests

# ── Clean ───────────────────────────────────────────────────────────────────

clean: clean-android clean-ios ## Clean all native build artifacts
	@rm -rf $(DIST_DIR)
	@echo "✅ Cleaned all build artifacts"

clean-android: ## Clean Android build artifacts
	@rm -rf $(ANDROID_DIR)
	@echo "Cleaned android/"

clean-ios: ## Clean iOS build artifacts
	@rm -rf $(IOS_DIR)
	@echo "Cleaned ios/"

clean-all: clean ## Full clean including node_modules
	@rm -rf $(MOBILE_DIR)/node_modules
	@echo "Cleaned node_modules — run 'make install-deps' to reinstall"
