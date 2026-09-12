import Foundation

/// What the Shortcuts actions say when they run, in the app's language. Their titles and
/// parameter names are translated by the String Catalogs instead, since iOS shows those
/// in the Shortcuts app with no Passer code running.
enum IntentText {
  private static var french: Bool { PasserShared.isFrench }

  static var nothingToSend: String { french ? "Rien à envoyer." : "Nothing to send." }

  static var iphoneClipboardUnavailable: String {
    french
      ? "Le presse-papiers de l'iPhone est vide, ou iOS n'a pas laissé Passer le lire."
      : "The iPhone clipboard is empty, or iOS didn't let Passer read it."
  }

  static var clipboardOnlyImages: String {
    french
      ? "Le presse-papiers du PC n'accepte que des images. Choisissez le Passboard pour ces fichiers."
      : "The PC clipboard only takes images. Choose the Passboard for these files."
  }

  static var pcHasImage: String {
    french
      ? "Le presse-papiers du PC contient une image : utilisez « Obtenir les fichiers du PC »."
      : "The PC clipboard holds an image: use Get Files from PC."
  }

  static var pcHasFiles: String {
    french
      ? "Le presse-papiers du PC contient des fichiers : utilisez « Obtenir les fichiers du PC »."
      : "The PC clipboard holds files: use Get Files from PC."
  }

  static var pcHasText: String {
    french
      ? "Le presse-papiers du PC contient du texte : utilisez « Obtenir le texte du PC »."
      : "The PC clipboard holds text: use Get Text from PC."
  }

  static var photosNotAllowed: String {
    french
      ? "Passer n'a pas accès à vos photos. Autorisez-le dans les réglages de Passer."
      : "Passer can't see your photos. Allow it in Passer's settings."
  }

  static var noScreenshot: String {
    french ? "Aucune capture d'écran dans la photothèque." : "No screenshot in the photo library."
  }

  static var noPhoto: String {
    french ? "Aucune photo dans la photothèque." : "No photo in the photo library."
  }

  static var pastedImage: String { french ? "Image collée" : "Pasted image" }

  static var imageFromPC: String { french ? "Image du PC" : "Image from PC" }

  static func reachable(_ name: String) -> String {
    french ? "\(PasserText.unbreakable(name)) est joignable." : "\(PasserText.unbreakable(name)) is reachable."
  }

  static func sentAndDeleted(_ name: String) -> String {
    french ? "Envoyée à \(PasserText.unbreakable(name)), puis supprimée." : "Sent to \(PasserText.unbreakable(name)), then deleted."
  }

  static func sentNotDeleted(_ name: String) -> String {
    french
      ? "Envoyée à \(PasserText.unbreakable(name)), mais iOS ne l'a pas supprimée. Ajoutez l'action « Supprimer des photos » à votre raccourci."
      : "Sent to \(PasserText.unbreakable(name)), but iOS didn't delete it. Add the Delete Photos action to your shortcut."
  }
}
