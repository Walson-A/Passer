package direct.passer.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import uniffi.passer_ffi.AdmissionListener
import uniffi.passer_ffi.ApprovalInfo
import uniffi.passer_ffi.ApprovalPrompter
import uniffi.passer_ffi.DeviceKind
import uniffi.passer_ffi.EffectKind
import uniffi.passer_ffi.KeyVault
import uniffi.passer_ffi.NetworkKind
import uniffi.passer_ffi.PasserDevice
import uniffi.passer_ffi.PasserException
import uniffi.passer_ffi.TransferProgress
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

    Events("onApprovalRequest", "onApprovalClosed", "onDeviceJoined", "onTransferProgress")

    AsyncFunction("open") Coroutine { -> status(openDevice()) }

    AsyncFunction("status") Coroutine { -> status(openDevice()) }

    AsyncFunction("createGroup") Coroutine { groupName: String, deviceName: String ->
      openDevice().createGroup(groupName, deviceName)
    }

    AsyncFunction("join") Coroutine { link: String, deviceName: String ->
      val r = openDevice().join(link, deviceName, NetworkKind.N0Dev)
      mapOf("groupName" to r.groupName, "sas" to r.sas)
    }

    AsyncFunction("start") Coroutine { coord: String? ->
      openDevice().start(NetworkKind.N0Dev, coord)
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

    AsyncFunction("sendFile") Coroutine { target: String, capability: String, inputJson: String, uri: String, transferId: String ->
      openDevice().sendFile(target, capability, inputJson, filePath(uri), ProgressRelay(transferId))
    }

    AsyncFunction("fetchFile") Coroutine { target: String, capability: String, inputJson: String, uri: String, transferId: String ->
      openDevice().fetchFile(target, capability, inputJson, filePath(uri), ProgressRelay(transferId))
    }

    AsyncFunction("refreshMembers") Coroutine { -> openDevice().refreshMembers().toInt() }

    AsyncFunction("memberCapabilities") { id: String ->
      openDevice().memberCapabilities(id).map {
        mapOf(
          "name" to it.name,
          "title" to it.title,
          "description" to it.description,
          "effect" to effectName(it.effect),
          "needsApproval" to it.needsApproval,
        )
      }
    }

    AsyncFunction("journal") Coroutine { limit: Int, id: String? ->
      openDevice().journalRecent(limit.coerceIn(1, 200).toUInt(), id).map {
        mapOf(
          "seq" to it.seq.toDouble(),
          "at" to it.at.toDouble(),
          "outgoing" to it.outgoing,
          "peerId" to it.peerId,
          "peerShortId" to it.peerId.take(10),
          "peerName" to it.peerName,
          "agent" to it.agent,
          "capability" to it.capability,
          "target" to it.target,
          "decision" to it.decision,
          "approved" to it.approved,
          "outcome" to it.outcome,
        )
      }
    }

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
    val tablet = context.resources.configuration.smallestScreenWidthDp >= 600
    val appVersion = try {
      context.packageManager.getPackageInfo(context.packageName, 0).versionName
    } catch (e: Exception) {
      null
    }
    d.setDeviceDetails(
      if (tablet) DeviceKind.TABLET else DeviceKind.PHONE,
      android.os.Build.VERSION.RELEASE,
      appVersion,
    )
    d.setApprovalPrompter(JsPrompter())
    d.setAdmissionListener(JoinRelay())
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
          "kind" to it.kind.name.lowercase(),
          "os" to it.os,
          "osVersion" to it.osVersion,
          "appVersion" to it.appVersion,
          "coreVersion" to it.coreVersion,
          "answeredAt" to it.answeredAt?.toDouble(),
        )
      },
    )
  }

  /** Expo hands file URIs (`file:///...`); the core wants paths. */
  private fun filePath(uri: String): String =
    if (uri.startsWith("file://")) android.net.Uri.parse(uri).path ?: uri else uri

  private inner class ProgressRelay(private val id: String) : TransferProgress {
    override fun progress(done: ULong, total: ULong?) {
      sendEvent("onTransferProgress", mapOf("id" to id, "done" to done.toDouble(), "total" to total?.toDouble()))
    }
  }

  private fun effectName(effect: EffectKind) = when (effect) {
    EffectKind.READ -> "read"
    EffectKind.WRITE -> "write"
    EffectKind.SENSITIVE -> "sensitive"
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

  private inner class JoinRelay : AdmissionListener {
    override fun admitted(deviceId: String, deviceName: String, sas: String) {
      sendEvent("onDeviceJoined", mapOf("name" to deviceName, "id" to deviceId.take(10), "sas" to sas))
    }
  }
}

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
