package expo.modules.hdiffpatcher

object HPatchNativeBridge {
    init {
        try {
            System.loadLibrary("hdiffpatcher")
        } catch (e: Throwable) {
            e.printStackTrace()
        }
    }

    @JvmStatic
    external fun checkPatchHeader(patchPath: String): LongArray?

    @JvmStatic
    external fun applyPatch(
        oldPath: String,
        patchPath: String,
        newPath: String,
        cacheMemory: Long
    ): Int
}
