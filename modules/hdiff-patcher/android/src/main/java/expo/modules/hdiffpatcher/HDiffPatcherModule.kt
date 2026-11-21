package expo.modules.hdiffpatcher

import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.zip.ZipFile

class HDiffPatcherModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("HDiffPatcher")

    AsyncFunction("getInstalledApkInfo") {
      withContext(Dispatchers.IO) {
        val appInfo = context.applicationInfo
        val sourceDir = appInfo.sourceDir ?: ""
        val file = File(sourceDir)
        val apkSize = if (file.exists()) file.length() else 0L

        var apkVariant = "unknown"
        if (file.exists() && file.canRead()) {
          try {
            val abis = mutableSetOf<String>()
            ZipFile(file).use { zip ->
              val entries = zip.entries()
              while (entries.hasMoreElements()) {
                val entry = entries.nextElement()
                val name = entry.name
                if (name.startsWith("lib/")) {
                  val parts = name.split("/")
                  if (parts.size >= 3) {
                    val abi = parts[1]
                    if (abi.isNotEmpty()) {
                      abis.add(abi)
                    }
                  }
                }
              }
            }

            apkVariant = when {
              abis.size > 1 -> "universal"
              abis.size == 1 -> {
                val singleAbi = abis.first()
                when (singleAbi) {
                  "arm64-v8a", "armeabi-v7a", "x86_64", "x86" -> singleAbi
                  else -> "unknown"
                }
              }
              else -> "universal" // Pure Java/Dex APK with no native libs
            }
          } catch (e: Exception) {
            e.printStackTrace()
            apkVariant = "unknown"
          }
        }

        mapOf(
          "apkPath" to sourceDir,
          "apkVariant" to apkVariant,
          "apkSize" to apkSize
        )
      }
    }

    AsyncFunction("applyHdiffPatch") { patchPath: String, outputApkPath: String ->
      withContext(Dispatchers.IO) {
        val sourceDir = context.applicationInfo.sourceDir
        if (sourceDir.isNullOrEmpty()) {
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "IO_ERROR",
            "message" to "Application sourceDir is null or empty"
          )
        }

        val baseFile = File(sourceDir)
        if (!baseFile.exists() || !baseFile.canRead()) {
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "IO_ERROR",
            "message" to "Installed APK is not readable at $sourceDir"
          )
        }

        val patchFile = File(patchPath)
        if (!patchFile.exists() || !patchFile.canRead()) {
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "IO_ERROR",
            "message" to "Patch file does not exist or is unreadable at $patchPath"
          )
        }

        val outputFile = File(outputApkPath)
        val parentDir = outputFile.parentFile ?: context.cacheDir
        if (!parentDir.exists()) {
          parentDir.mkdirs()
        }

        // Storage check: require ~1.5x the base APK size free
        val requiredBytes = (baseFile.length() * 1.5).toLong()
        val availableBytes = parentDir.usableSpace
        if (availableBytes < requiredBytes) {
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "LOW_STORAGE",
            "message" to "Insufficient disk space: required $requiredBytes bytes, available $availableBytes bytes"
          )
        }

        // Validate patch header expected oldDataSize
        val headerInfo = HPatchNativeBridge.checkPatchHeader(patchPath)
        if (headerInfo == null) {
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "PATCH_FAILED",
            "message" to "Failed to parse patch header from $patchPath"
          )
        }

        val expectedOldSize = headerInfo[0]
        val actualOldSize = baseFile.length()
        if (expectedOldSize != actualOldSize) {
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "OLD_FILE_MISMATCH",
            "message" to "Installed APK size ($actualOldSize) does not match expected patch size ($expectedOldSize)"
          )
        }

        // Remove any old output file if it exists
        if (outputFile.exists()) {
          outputFile.delete()
        }

        val patchCode = HPatchNativeBridge.applyPatch(
          sourceDir,
          patchPath,
          outputApkPath,
          4 * 1024 * 1024L // 4MB cache
        )

        if (patchCode != 0) {
          if (outputFile.exists()) {
            outputFile.delete()
          }
          val errCode = when (patchCode) {
            6 -> "OLD_FILE_MISMATCH"
            24 -> "LOW_STORAGE"
            2, 3, 4, 5, 7 -> "IO_ERROR"
            else -> "PATCH_FAILED"
          }
          return@withContext mapOf(
            "success" to false,
            "errorCode" to errCode,
            "message" to "Native patch application failed with error code $patchCode"
          )
        }

        // Validate the generated APK
        val pm = context.packageManager
        val archiveInfo = pm.getPackageArchiveInfo(outputApkPath, 0)
        if (archiveInfo == null || archiveInfo.packageName != context.packageName) {
          if (outputFile.exists()) {
            outputFile.delete()
          }
          return@withContext mapOf(
            "success" to false,
            "errorCode" to "INVALID_APK",
            "message" to "Generated APK package name '${archiveInfo?.packageName}' does not match running app '${context.packageName}'"
          )
        }

        mapOf("success" to true)
      }
    }
  }
}
