# Convenience wrapper for C core + web build + tests

# Determine build directory (override to keep verification out of ./build)
BUILD_DIR ?= build

# Default target: build core library and CLI test
all: $(BUILD_DIR)/libsugoroku.a $(BUILD_DIR)/cli_test

# Create build directory
$(BUILD_DIR):
	mkdir -p $(BUILD_DIR)

# Compile core library
$(BUILD_DIR)/libsugoroku.a: core/sugoroku.c $(BUILD_DIR)
	gcc -std=c11 -O2 -Wall -Wextra -Werror -c $< -o $(BUILD_DIR)/sugoroku.o
	ar rcs $@ $(BUILD_DIR)/sugoroku.o

# Compile CLI test
$(BUILD_DIR)/cli_test: core/cli_test.c $(BUILD_DIR)/libsugoroku.a $(BUILD_DIR)
	gcc -std=c11 -O2 -Wall -Wextra -Werror $< -L$(BUILD_DIR) -lsugoroku -o $@

# Run both C test paths: basic self-tests and the forced-winner benchmark
test: $(BUILD_DIR)/cli_test
	@echo "Running CLI self-tests..."
	@$(BUILD_DIR)/cli_test
	@echo "Running CLI benchmark..."
	@$(BUILD_DIR)/cli_test --benchmark

# Clean build artifacts
clean:
	rm -rf $(BUILD_DIR)

# Start mobile app HTTP server
mobile:
	@echo "Starting mobile HTTP server..."
	python3 -m http.server 8080 --bind 0.0.0.0

.PHONY: all test clean mobile