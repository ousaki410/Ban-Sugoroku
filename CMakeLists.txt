cmake_minimum_required(VERSION 3.10)
project(Ban-Sugoroku C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

# Source files for core library
add_library(sugoroku STATIC
    core/sugoroku.c
)

# Public header for core
target_include_directories(sugoroku PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/core>
    $<INSTALL_INTERFACE:include>
)

# CLI test executable
add_executable(cli_test core/cli_test.c)
target_link_libraries(cli_test sugoroku)

# Installation targets
install(TARGETS sugoroku
    ARCHIVE DESTINATION lib
    LIBRARY DESTINATION lib
)

install(FILES core/sugoroku.h
    DESTINATION include
)

# Add a custom target for mobile preview (runs a local HTTP server via python)
find_program(PYTHON3 python3)
if(PYTHON3)
    add_custom_target(mobile
        COMMAND ${PYTHON3} -m http.server 8080 --bind 0.0.0.0
        WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/mobile
        COMMENT "Starting mobile app HTTP server on port 8080"
        VERBATIM
    )
endif()

# Enable testing
enable_testing()
add_test(NAME cli_test
    COMMAND cli_test
    WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
)