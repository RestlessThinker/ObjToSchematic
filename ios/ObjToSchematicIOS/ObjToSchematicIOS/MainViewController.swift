import UIKit
import WebKit

final class MainViewController: UIViewController, WKScriptMessageHandler {
    private(set) var webView: WKWebView!

    private let statusLabel = UILabel()
    private let convertButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        configureWebView()
        configureUI()
        loadBridgePage()
    }

    private func configureWebView() {
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "logger")
        userContentController.add(self, name: "conversionComplete")
        userContentController.add(self, name: "conversionState")

        let config = WKWebViewConfiguration()
        config.userContentController = userContentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
    }

    private func configureUI() {
        convertButton.setTitle("Convert Truck OBJ", for: .normal)
        convertButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        convertButton.addTarget(self, action: #selector(handleConvertTap), for: .touchUpInside)
        convertButton.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.font = .systemFont(ofSize: 14, weight: .medium)
        statusLabel.textColor = .secondaryLabel
        statusLabel.text = "Ready"
        statusLabel.numberOfLines = 0
        statusLabel.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(convertButton)
        view.addSubview(statusLabel)
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            convertButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            convertButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            statusLabel.topAnchor.constraint(equalTo: convertButton.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            webView.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 16),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func loadBridgePage() {
        guard
            let webAssetsURL = Bundle.main.resourceURL?.appendingPathComponent("WebAssets", isDirectory: true),
            let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets")
        else {
            statusLabel.text = "Missing bundled WebAssets/index.html"
            NSLog("ObjToSchematicIOS: missing WebAssets/index.html")
            return
        }

        webView.loadFileURL(indexURL, allowingReadAccessTo: webAssetsURL)
    }

    @objc
    private func handleConvertTap() {
        convertButton.isEnabled = false
        statusLabel.text = "Running conversion..."

        runSampleConversion { [weak self] result in
            guard let self = self else {
                return
            }
            self.convertButton.isEnabled = true
            switch result {
            case .success(let payload):
                let filename = payload["filename"] as? String ?? "unknown"
                let size = payload["size"] as? Int ?? 0
                self.statusLabel.text = "Done: \(filename) (\(size) bytes)"
            case .failure(let error):
                self.statusLabel.text = "Failed: \(error.localizedDescription)"
            }
        }
    }

    func runSampleConversion(completion: @escaping (Result<[String: Any], Error>) -> Void) {
        if #available(iOS 15.0, *) {
            webView.callAsyncJavaScript(
                "return await window.ObjToSchematicIOSBridge.runSampleConversionForTesting();",
                arguments: [:],
                in: nil,
                in: .defaultClient,
                completionHandler: { result in
                    switch result {
                    case .success(let value):
                        if let payload = value as? [String: Any] {
                            completion(.success(payload))
                        } else {
                            completion(.failure(NSError(
                                domain: "ObjToSchematicIOS",
                                code: 1001,
                                userInfo: [NSLocalizedDescriptionKey: "Unexpected JS payload"]
                            )))
                        }
                    case .failure(let error):
                        completion(.failure(error))
                    }
                }
            )
            return
        }

        webView.evaluateJavaScript(
            "window.ObjToSchematicIOSBridge.runSampleConversionForTesting().then(JSON.stringify)",
            completionHandler: { value, error in
                if let error = error {
                    completion(.failure(error))
                    return
                }
                guard
                    let jsonString = value as? String,
                    let data = jsonString.data(using: .utf8),
                    let json = try? JSONSerialization.jsonObject(with: data, options: []),
                    let payload = json as? [String: Any]
                else {
                    completion(.failure(NSError(
                        domain: "ObjToSchematicIOS",
                        code: 1002,
                        userInfo: [NSLocalizedDescriptionKey: "Could not decode conversion payload"]
                    )))
                    return
                }
                completion(.success(payload))
            }
        )
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let payload = message.body as? [String: Any] else {
            NSLog("ObjToSchematicIOS [\(message.name)] invalid payload: \(message.body)")
            return
        }

        switch message.name {
        case "logger":
            let level = payload["level"] as? String ?? "log"
            let logMessage = payload["message"] as? String ?? ""
            NSLog("ObjToSchematicIOS [JS \(level)] \(logMessage)")
        case "conversionComplete":
            persistOutput(payload: payload)
        case "conversionState":
            if let state = payload["message"] as? String {
                NSLog("ObjToSchematicIOS [state] \(state)")
            }
            if let error = payload["error"] as? String {
                NSLog("ObjToSchematicIOS [state-error] \(error)")
            }
        default:
            break
        }
    }

    private func persistOutput(payload: [String: Any]) {
        guard
            let filename = payload["filename"] as? String,
            let base64 = payload["base64"] as? String,
            let bytes = Data(base64Encoded: base64)
        else {
            NSLog("ObjToSchematicIOS: conversion payload missing output")
            return
        }

        let outputURL = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
        do {
            try bytes.write(to: outputURL, options: .atomic)
            NSLog("ObjToSchematicIOS: wrote exported file to \(outputURL.path)")
        } catch {
            NSLog("ObjToSchematicIOS: failed to write output - \(error.localizedDescription)")
        }
    }
}
