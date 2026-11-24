package direct.passer.core

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import uniffi.passer_ffi.AdmissionListener
import uniffi.passer_ffi.ApprovalInfo
import uniffi.passer_ffi.ApprovalPrompter
import uniffi.passer_ffi.CallerInfo
import uniffi.passer_ffi.CapabilityHandler
import uniffi.passer_ffi.CapabilitySpec
import uniffi.passer_ffi.EffectKind
import uniffi.passer_ffi.KeyVault
import uniffi.passer_ffi.NetworkKind
import uniffi.passer_ffi.PasserDevice
import uniffi.passer_ffi.PasserException
import java.io.File
import java.security.KeyStore
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The Passer device network (passer-core) for Android. Same surface as the iOS module:
 * the Rust core decides; this class keeps the key, forwards approval prompts to
 * JavaScript and translates calls.
 */
class PasserCoreModule : Module() {
  private var device: PasserDevice? = null
  private val waiting = ConcurrentHashMap<Int, CompletableDeferred<Boolean>>()
  private val nextId = AtomicInteger(1)

  override fun definition() = ModuleDefinition {
    Name("PasserCore")

    Events("onApprovalRequest", "onApprovalClosed", "onDeviceJoined", "onReceived")

    AsyncFunction("open") Coroutine { -> status(openDevice()) }

    AsyncFunction("status") Coroutine { -> status(openDevice()) }

    AsyncFunction("createGroup") Coroutine { groupName: String, deviceName: String ->
      openDevice().createGroup(groupName, deviceName)
    }

    AsyncFunction("join") Coroutine { link: String, deviceName: String ->
      val r = openDevice().join(link, deviceName, NetworkKind.N0_DEV)
      mapOf("groupName" to r.groupName, "sas" to r.sas)
    }

    AsyncFunction("start") Coroutine { coord: String? ->
      openDevice().start(NetworkKind.N0_DEV, coord)
    }

    AsyncFunction("stop") Coroutine { -> device?.stop() }

    AsyncFunction("invite") Coroutine { minutes: Int, asApprover: Boolean ->
      openDevice().invite(minutes.coerceIn(1, 15).toUInt(), asApprover).link
    }

    AsyncFunction("call") Coroutine { target: String, capability: String, inputJson: String ->
      openDevice().call(target, capability, inputJson)
    }

    AsyncFunction("removeDevice") Coroutine { id: String -> openDevice().removeDevice(id) }

    AsyncFunction("stopAllSessions") Coroutine { -> openDevice().stopAllSessions() }

    Function("answerApproval") { id: Int, allow: Boolean ->
      waiting.remove(id)?.complete(allow) ?: false
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("no React context")

  private fun openDevice(): PasserDevice {
    device?.let { return it }
    val home = File(context.filesDir, "passer-core").apply { mkdirs() }
    val d = PasserDevice(home.absolutePath, KeystoreVault(context))
    d.setApprovalPrompter(JsPrompter())
    d.setAdmissionListener(JoinRelay())
    // What other devices of the group can ask this phone; declared before `start`.
    d.addCapabilities(PHONE_CAPABILITIES, PhoneCapabilities())
    device = d
    return d
  }

  private suspend fun status(d: PasserDevice): Map<String, Any?> {
    val members = try { d.members() } catch (e: PasserException) { emptyList() }
    return mapOf(
      "deviceId" to d.deviceId(),
      "group" to d.groupName(),
      "running" to d.isRunning(),
      "members" to members.map {
        mapOf(
          "id" to it.id,
          "shortId" to it.id.take(10),
          "name" to it.name,
          "approver" to it.approver,
          "thisDevice" to it.thisDevice,
        )
      },
    )
  }

  /** Asks the user through the app's UI; no answer within 55 s means no. */
  private inner class JsPrompter : ApprovalPrompter {
    override suspend fun ask(request: ApprovalInfo): Boolean {
      val id = nextId.getAndIncrement()
      val answer = CompletableDeferred<Boolean>()
      waiting[id] = answer
      sendEvent(
        "onApprovalRequest",
        mapOf(
          "id" to id,
          "requester" to request.requesterName,
          "requesterId" to request.requesterId.take(10),
          "agent" to request.agent,
          "title" to request.title,
          "capability" to request.capability,
          "target" to request.target,
          "minutes" to request.durationMinutes.toLong(),
          "expiresInSecs" to 55,
        ),
      )
      val allowed = withTimeoutOrNull(55_000) { answer.await() } ?: false
      waiting.remove(id)
      sendEvent("onApprovalClosed", mapOf("id" to id))
      return allowed
    }
  }

  /**
   * What this phone offers the group: the PC's own names, inputs and limits
   * (`passer-app/src-tauri/src/devices.rs`), so the desktop's commands work unchanged.
   */
  private inner class PhoneCapabilities : CapabilityHandler {
    override suspend fun invoke(capability: String, target: String?, inputJson: String, caller: CallerInfo): String {
      val input = try {
        JSONObject(inputJson)
      } catch (e: Exception) {
        throw PasserException.Invalid("input is not JSON")
      }
      val from: Map<String, Any?> = mapOf("from" to caller.deviceName, "fromId" to caller.deviceId.take(10), "agent" to caller.agent)
      return when (capability) {
        "clipboard.write" -> {
          if (!input.has("text")) throw PasserException.Invalid("text is missing")
          val text = input.getString("text")
          if (text.length > MAX_TEXT) throw PasserException.Invalid("text too long")
          withContext(Dispatchers.Main) {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Passer", text))
          }
          sendEvent("onReceived", from + mapOf("kind" to "text", "text" to text.take(160)))
          """{"ok":true}"""
        }
        "file.receive" -> {
          val bytes = try {
            Base64.decode(input.optString("data_base64", ""), Base64.DEFAULT)
          } catch (e: IllegalArgumentException) {
            throw PasserException.Invalid("data_base64 is not valid base64")
          }
          if (bytes.size > MAX_FILE_BYTES) throw PasserException.Invalid("file too large for this version (700 KB maximum)")
          val file = save(bytes, input.optString("name", ""))
          sendEvent(
            "onReceived",
            from + mapOf("kind" to "file", "name" to file.name, "uri" to Uri.fromFile(file).toString(), "size" to bytes.size),
          )
          """{"saved":true,"size":${bytes.size}}"""
        }
        else -> throw PasserException.Invalid("unknown capability $capability")
      }
    }

    /** Only the base name is kept, as on the PC, so a sender cannot write anywhere else. */
    private fun save(bytes: ByteArray, rawName: String): File {
      val base = File(rawName).name
      val name = if (base.isEmpty() || base == "." || base == "..") "received_file" else base
      val folder = File(context.filesDir, "received").apply { mkdirs() }
      var file = File(folder, name)
      val stem = file.nameWithoutExtension
      val ext = file.extension
      var copy = 2
      while (file.exists()) {
        file = File(folder, if (ext.isEmpty()) "$stem $copy" else "$stem $copy.$ext")
        copy += 1
      }
      try {
        file.writeBytes(bytes)
      } catch (e: Exception) {
        throw PasserException.Storage("could not save the file: ${e.message}")
      }
      return file
    }
  }

  private inner class JoinRelay : AdmissionListener {
    override fun admitted(deviceId: String, deviceName: String, sas: String) {
      sendEvent("onDeviceJoined", mapOf("name" to deviceName, "id" to deviceId.take(10), "sas" to sas))
    }
  }
}

private const val MAX_TEXT = 200_000
private const val MAX_FILE_BYTES = 700 * 1024

private val PHONE_CAPABILITIES = listOf(
  CapabilitySpec(
    "clipboard.write",
    "Put text on the phone clipboard",
    "Replaces the text on this phone's clipboard.",
    """{"type":"object","properties":{"text":{"type":"string","maxLength":200000}},"required":["text"],"additionalProperties":false}""",
    EffectKind.WRITE,
    null,
    false,
  ),
  CapabilitySpec(
    "file.receive",
    "Send a file to the phone",
    "Saves a small file (under 700 KB) in Passer on this phone.",
    """{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":255},"data_base64":{"type":"string","maxLength":955737}},"required":["name","data_base64"],"additionalProperties":false}""",
    EffectKind.WRITE,
    null,
    false,
  ),
)

/**
 * The device key, encrypted with an AES key that never leaves the Android Keystore,
 * stored in the app's private preferences (excluded from backups by the app).
 */
class KeystoreVault(context: Context) : KeyVault {
  private val prefs = context.getSharedPreferences("passer-core", Context.MODE_PRIVATE)

  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
      KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build(),
    )
    return generator.generateKey()
  }

  override fun load(): ByteArray? {
    val sealed = prefs.getString(PREF, null) ?: return null
    return try {
      val bytes = Base64.decode(sealed, Base64.NO_WRAP)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, 12))
      cipher.doFinal(bytes, 12, bytes.size - 12)
    } catch (e: Exception) {
      null
    }
  }

  override fun store(secret: ByteArray) {
    try {
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key())
      val sealed = cipher.iv + cipher.doFinal(secret)
      prefs.edit().putString(PREF, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
    } catch (e: Exception) {
      throw PasserException.Storage("Keystore error: ${e.message}")
    }
  }

  private companion object {
    const val ALIAS = "passer-core-device-key"
    const val PREF = "device-key"
  }
}
