#include <jni.h>
#include <string.h>
#include <stdlib.h>
#include <zlib.h>
#include <android/log.h>
#include <inttypes.h>

#include "file_for_patch.h"
#include "libHDiffPatch/HPatch/patch.h"
#include "decompress_plugin_demo.h"

#define LOG_TAG "HDiffPatcherNative"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

JNIEXPORT jlongArray JNICALL
Java_expo_modules_hdiffpatcher_HPatchNativeBridge_checkPatchHeader(
    JNIEnv* env,
    jclass clazz,
    jstring patchPath
) {
    if (!patchPath) return NULL;
    const char* cPatchPath = (*env)->GetStringUTFChars(env, patchPath, NULL);
    if (!cPatchPath) return NULL;

    hpatch_TFileStreamInput diffData;
    hpatch_TFileStreamInput_init(&diffData);
    if (!hpatch_TFileStreamInput_open(&diffData, cPatchPath)) {
        LOGE("Failed to open patch file: %s", cPatchPath);
        (*env)->ReleaseStringUTFChars(env, patchPath, cPatchPath);
        return NULL;
    }

    hpatch_compressedDiffInfo diffInfo;
    memset(&diffInfo, 0, sizeof(diffInfo));
    hpatch_BOOL ok = getCompressedDiffInfo(&diffInfo, &diffData.base);
    hpatch_TFileStreamInput_close(&diffData);
    (*env)->ReleaseStringUTFChars(env, patchPath, cPatchPath);

    if (!ok) {
        LOGE("Failed to parse diff header from patch file");
        return NULL;
    }

    jlongArray resultArray = (*env)->NewLongArray(env, 3);
    if (!resultArray) return NULL;

    jlong buf[3];
    buf[0] = (jlong)diffInfo.oldDataSize;
    buf[1] = (jlong)diffInfo.newDataSize;
    buf[2] = (jlong)diffInfo.compressedCount;
    (*env)->SetLongArrayRegion(env, resultArray, 0, 3, buf);

    return resultArray;
}

JNIEXPORT jint JNICALL
Java_expo_modules_hdiffpatcher_HPatchNativeBridge_applyPatch(
    JNIEnv* env,
    jclass clazz,
    jstring oldPath,
    jstring patchPath,
    jstring newPath,
    jlong cacheMemory
) {
    if (!oldPath || !patchPath || !newPath) return 1; // HPATCH_OPTIONS_ERROR

    const char* cOldPath = (*env)->GetStringUTFChars(env, oldPath, NULL);
    const char* cPatchPath = (*env)->GetStringUTFChars(env, patchPath, NULL);
    const char* cNewPath = (*env)->GetStringUTFChars(env, newPath, NULL);

    if (!cOldPath || !cPatchPath || !cNewPath) {
        if (cOldPath) (*env)->ReleaseStringUTFChars(env, oldPath, cOldPath);
        if (cPatchPath) (*env)->ReleaseStringUTFChars(env, patchPath, cPatchPath);
        if (cNewPath) (*env)->ReleaseStringUTFChars(env, newPath, cNewPath);
        return 1;
    }

    hpatch_TFileStreamInput oldData;
    hpatch_TFileStreamInput diffData;
    hpatch_TFileStreamOutput newData;
    hpatch_compressedDiffInfo diffInfo;

    hpatch_TFileStreamInput_init(&oldData);
    hpatch_TFileStreamInput_init(&diffData);
    hpatch_TFileStreamOutput_init(&newData);

    int result = 0;

    if (!hpatch_TFileStreamInput_open(&oldData, cOldPath)) {
        LOGE("Cannot open old APK for reading: %s", cOldPath);
        result = 2; // HPATCH_OPENREAD_ERROR
        goto cleanup_strings;
    }

    if (!hpatch_TFileStreamInput_open(&diffData, cPatchPath)) {
        LOGE("Cannot open patch file for reading: %s", cPatchPath);
        hpatch_TFileStreamInput_close(&oldData);
        result = 2; // HPATCH_OPENREAD_ERROR
        goto cleanup_strings;
    }

    memset(&diffInfo, 0, sizeof(diffInfo));
    if (!getCompressedDiffInfo(&diffInfo, &diffData.base)) {
        LOGE("Cannot read compressed diff info from patch: %s", cPatchPath);
        hpatch_TFileStreamInput_close(&oldData);
        hpatch_TFileStreamInput_close(&diffData);
        result = 9; // HPATCH_HDIFFINFO_ERROR
        goto cleanup_strings;
    }

    if (oldData.base.streamSize != diffInfo.oldDataSize) {
        LOGE("Old file size mismatch! actual=%" PRIu64 ", expected=%" PRIu64,
             oldData.base.streamSize, diffInfo.oldDataSize);
        hpatch_TFileStreamInput_close(&oldData);
        hpatch_TFileStreamInput_close(&diffData);
        result = 6; // HPATCH_FILEDATA_ERROR (OLD_FILE_MISMATCH)
        goto cleanup_strings;
    }

    if (!hpatch_TFileStreamOutput_open(&newData, cNewPath, diffInfo.newDataSize)) {
        LOGE("Cannot open output new APK for writing: %s", cNewPath);
        hpatch_TFileStreamInput_close(&oldData);
        hpatch_TFileStreamInput_close(&diffData);
        result = 3; // HPATCH_OPENWRITE_ERROR
        goto cleanup_strings;
    }

    size_t cacheSize = (cacheMemory > 0) ? (size_t)cacheMemory : (1024 * 1024 * 4); // 4MB default
    if (cacheSize < 1024 * 256) cacheSize = 1024 * 256;
    unsigned char* temp_cache = (unsigned char*)malloc(cacheSize);
    if (!temp_cache) {
        LOGE("Failed to allocate %zu bytes working cache", cacheSize);
        hpatch_TFileStreamOutput_close(&newData);
        hpatch_TFileStreamInput_close(&oldData);
        hpatch_TFileStreamInput_close(&diffData);
        result = 8; // HPATCH_MEM_ERROR
        goto cleanup_strings;
    }

    hpatch_TDecompress* decompressPlugin = NULL;
    if (diffInfo.compressedCount > 0) {
#ifdef _CompressPlugin_zlib
        if (strcmp(diffInfo.compressType, "zlib") == 0 || strcmp(diffInfo.compressType, "") == 0) {
            decompressPlugin = &zlibDecompressPlugin;
        }
#endif
    }

    LOGI("Applying patch: oldSize=%" PRIu64 ", patchSize=%" PRIu64 ", newSize=%" PRIu64 ", compType='%s'",
         oldData.base.streamSize, diffData.base.streamSize, diffInfo.newDataSize, diffInfo.compressType);

    hpatch_BOOL ok = patch_decompress_with_cache(
        &newData.base,
        &oldData.base,
        &diffData.base,
        decompressPlugin,
        temp_cache,
        temp_cache + cacheSize
    );

    free(temp_cache);

    if (!hpatch_TFileStreamOutput_close(&newData)) {
        LOGE("Failed to close output new file");
        if (result == 0) result = 7; // HPATCH_FILECLOSE_ERROR
    }
    hpatch_TFileStreamInput_close(&diffData);
    hpatch_TFileStreamInput_close(&oldData);

    if (!ok) {
        LOGE("patch_decompress_with_cache failed");
        if (result == 0) result = 11; // HPATCH_HPATCH_ERROR
    } else {
        LOGI("Patch applied successfully to: %s", cNewPath);
    }

cleanup_strings:
    (*env)->ReleaseStringUTFChars(env, oldPath, cOldPath);
    (*env)->ReleaseStringUTFChars(env, patchPath, cPatchPath);
    (*env)->ReleaseStringUTFChars(env, newPath, cNewPath);

    return result;
}
