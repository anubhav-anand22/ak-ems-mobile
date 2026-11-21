cmake_minimum_required(VERSION 3.22.1)
project(hdiffpatcher LANGUAGES C CXX)

set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 17)

add_definitions(
    -DANDROID_NDK
    -DNDEBUG
    -D_LARGEFILE64_SOURCE
    -D_FILE_OFFSET_BITS=64
    -D_IS_USED_MULTITHREAD=0
    -D_IS_NEED_DIR_DIFF_PATCH=0
    -D_IS_NEED_DEFAULT_CompressPlugin=0
    -D_IS_NEED_DEFAULT_ChecksumPlugin=0
    -D_CompressPlugin_zlib=1
)

include_directories(
    src/main/cpp
    src/main/cpp/libHDiffPatch/HPatch
)

add_library(
    hdiffpatcher
    SHARED
    src/main/cpp/hpatch_jni.c
    src/main/cpp/file_for_patch.c
    src/main/cpp/libHDiffPatch/HPatch/patch.c
)

find_library(log-lib log)
find_library(z-lib z)

target_link_libraries(
    hdiffpatcher
    ${log-lib}
    ${z-lib}
)
