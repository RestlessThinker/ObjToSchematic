import Foundation
import UIKit
import WebKit

public struct ConversionResult {
    public let filename: String
    public let base64: String
    public let size: Int
}

public enum ObjToSchematicError: LocalizedError {
    case missingWebAssets
    case invalidPayload
    case serializationFailure
    case jsError(String)
    case bridgeNotReady

    public var errorDescription: String? {
        switch self {
        case .missingWebAssets:
            return "Missing bundled WebAssets"
        case .invalidPayload:
            return "Unexpected JavaScript payload"
        case .serializationFailure:
            return "Could not serialize request"
        case .jsError(let message):
            return "JavaScript error: \(message)"
        case .bridgeNotReady:
            return "JavaScript bridge not ready"
        }
    }
}

public final class ObjToSchematicController: NSObject {
    public private(set) var webView: WKWebView
    private let fileIOBridgeHandler: FileIOBridgeHandler
    private var loadCompletion: ((Result<Void, Error>) -> Void)?

    public override init() {
        let userContentController = WKUserContentController()
        let config = WKWebViewConfiguration()
        config.userContentController = userContentController
        self.webView = WKWebView(frame: .zero, configuration: config)
        self.fileIOBridgeHandler = FileIOBridgeHandler(evaluator: webView)

        super.init()

        userContentController.add(self, name: "logger")
        userContentController.add(self, name: "conversionComplete")
        userContentController.add(self, name: "conversionState")
        userContentController.add(self, name: "fileIORequest")
    }

    public func load(into view: UIView) throws {
        try load(into: view, completion: nil)
    }

    public func load(into view: UIView, completion: ((Result<Void, Error>) -> Void)?) throws {
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let bundle = ObjToSchematicController.resourceBundle()
        let (indexURL, webAssetsURL) = ObjToSchematicController.webAssetURLs(in: bundle)
        guard let indexURL, let webAssetsURL else {
            throw ObjToSchematicError.missingWebAssets
        }

        if completion != nil {
            webView.navigationDelegate = self
            loadCompletion = completion
        }

        webView.loadFileURL(indexURL, allowingReadAccessTo: webAssetsURL)
    }

    public func convert(objPath: String, completion: @escaping (Result<ConversionResult, Error>) -> Void) {
        if #available(iOS 15.0, *) {
            webView.callAsyncJavaScript(
                "return await window.ObjToSchematicIOSBridge.runConversionFromObjPathForTesting(objPath);",
                arguments: ["objPath": objPath],
                in: nil,
                in: .page,
                completionHandler: { result in
                    completion(Self.decode(result: result))
                }
            )
            return
        }

        guard let data = try? JSONSerialization.data(withJSONObject: ["objPath": objPath], options: []),
              let json = String(data: data, encoding: .utf8) else {
            completion(.failure(ObjToSchematicError.serializationFailure))
            return
        }

        webView.evaluateJavaScript(
            "window.ObjToSchematicIOSBridge.runConversionFromObjPathForTesting(\(json).objPath).then(JSON.stringify)",
            completionHandler: { value, error in
                if let error = error {
                    completion(.failure(error))
                    return
                }
                guard let jsonString = value as? String,
                      let jsonData = jsonString.data(using: .utf8),
                      let payload = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any]
                else {
                    completion(.failure(ObjToSchematicError.invalidPayload))
                    return
                }

                completion(Self.decode(payload: payload))
            }
        )
    }

    public func waitForBridgeReady(
        timeout: TimeInterval = 5,
        pollInterval: TimeInterval = 0.1,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        let deadline = Date().addingTimeInterval(timeout)

        func poll() {
            webView.evaluateJavaScript(
                "typeof window.ObjToSchematicIOSBridge !== 'undefined' && " +
                "typeof window.ObjToSchematicIOSBridge.runConversionFromObjPathForTesting === 'function'"
            ) { value, error in
                if let error = error {
                    completion(.failure(error))
                    return
                }

                if let ready = value as? Bool, ready {
                    completion(.success(()))
                    return
                }

                if Date() >= deadline {
                    completion(.failure(ObjToSchematicError.bridgeNotReady))
                    return
                }

                DispatchQueue.main.asyncAfter(deadline: .now() + pollInterval) {
                    poll()
                }
            }
        }

        poll()
    }

    private static func decode(result: Result<Any, Error>) -> Result<ConversionResult, Error> {
        switch result {
        case .failure(let error):
            return .failure(error)
        case .success(let value):
            guard let payload = value as? [String: Any] else {
                return .failure(ObjToSchematicError.invalidPayload)
            }
            return decode(payload: payload)
        }
    }

    private static func decode(payload: [String: Any]) -> Result<ConversionResult, Error> {
        if let error = payload["error"] as? String, error.isEmpty == false {
            return .failure(ObjToSchematicError.jsError(error))
        }

        guard let filename = payload["filename"] as? String,
              let size = payload["size"] as? Int else {
            return .failure(ObjToSchematicError.invalidPayload)
        }

        let base64 = payload["base64"] as? String ?? ""
        return .success(ConversionResult(filename: filename, base64: base64, size: size))
    }
}

extension ObjToSchematicController {
    private static func webAssetURLs(in bundle: Bundle) -> (URL?, URL?) {
        if let indexURL = bundle.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets"),
           let webAssetsURL = bundle.resourceURL?.appendingPathComponent("WebAssets", isDirectory: true) {
            return (indexURL, webAssetsURL)
        }

        if let indexURL = bundle.url(forResource: "index", withExtension: "html"),
           let webAssetsURL = bundle.resourceURL {
            return (indexURL, webAssetsURL)
        }

        return (nil, nil)
    }

    public static func resourceBundle() -> Bundle {
        var candidates: [Bundle] = [
            Bundle(for: ObjToSchematicController.self),
            Bundle.main,
        ]
        #if SWIFT_PACKAGE
        candidates.append(Bundle.module)
        #endif

        for candidate in candidates {
            if webAssetURLs(in: candidate).0 != nil {
                return candidate
            }

            let bundleNames = [
                "ObjToSchematicKit",
                "ObjToSchematicKit_ObjToSchematicKit",
            ]

            let bundleSearchRoots: [URL?] = [
                candidate.bundleURL,
                candidate.resourceURL,
                candidate.builtInPlugInsURL,
            ]

            for bundleName in bundleNames {
                for root in bundleSearchRoots.compactMap({ $0 }) {
                    let url = root.appendingPathComponent("\(bundleName).bundle", isDirectory: true)
                    if let resourceBundle = Bundle(url: url),
                       webAssetURLs(in: resourceBundle).0 != nil {
                        return resourceBundle
                    }
                }
            }
        }

        for bundle in Bundle.allBundles {
            if webAssetURLs(in: bundle).0 != nil {
                return bundle
            }
        }

        let fileManager = FileManager.default
        let searchRoots: [URL?] = [
            Bundle.main.bundleURL,
            Bundle.main.resourceURL,
            Bundle.main.builtInPlugInsURL,
            Bundle(for: ObjToSchematicController.self).bundleURL,
            Bundle(for: ObjToSchematicController.self).resourceURL,
        ]

        for root in searchRoots.compactMap({ $0 }) {
            if let enumerator = fileManager.enumerator(at: root, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]) {
                for case let url as URL in enumerator {
                    guard url.pathExtension == "bundle" else { continue }
                    if let resourceBundle = Bundle(url: url),
                       webAssetURLs(in: resourceBundle).0 != nil {
                        return resourceBundle
                    }
                }
            }
        }

        return Bundle(for: ObjToSchematicController.self)
    }
}

extension ObjToSchematicController: WKScriptMessageHandler {
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "fileIORequest" {
            fileIOBridgeHandler.userContentController(userContentController, didReceive: message)
            return
        }

        guard let payload = message.body as? [String: Any] else {
            NSLog("ObjToSchematicKit [\(message.name)] invalid payload: \(message.body)")
            return
        }

        switch message.name {
        case "logger":
            let level = payload["level"] as? String ?? "log"
            let logMessage = payload["message"] as? String ?? ""
            NSLog("ObjToSchematicKit [JS \(level)] \(logMessage)")
        case "conversionState":
            if let state = payload["message"] as? String {
                NSLog("ObjToSchematicKit [state] \(state)")
            }
            if let error = payload["error"] as? String {
                NSLog("ObjToSchematicKit [state-error] \(error)")
            }
        case "conversionComplete":
            break
        default:
            break
        }
    }
}

extension ObjToSchematicController: WKNavigationDelegate {
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadCompletion?(.success(()))
        loadCompletion = nil
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadCompletion?(.failure(error))
        loadCompletion = nil
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadCompletion?(.failure(error))
        loadCompletion = nil
    }
}
