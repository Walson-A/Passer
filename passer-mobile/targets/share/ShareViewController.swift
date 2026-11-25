import SwiftUI
import UIKit

/// The share extension's entry point: hosts `ShareView` and ends the request when it is done.
final class ShareViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    let model = ShareModel(
      items: items,
      onFinish: { [weak self] in
        self?.extensionContext?.completeRequest(returningItems: nil)
      },
      onCancel: { [weak self] in
        self?.extensionContext?.cancelRequest(withError: CocoaError(.userCancelled))
      }
    )

    let host = UIHostingController(rootView: ShareView(model: model))
    host.view.backgroundColor = .clear
    addChild(host)
    host.view.frame = view.bounds
    host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(host.view)
    host.didMove(toParent: self)
  }
}
