import ObjToSchematicKit
import UIKit

final class MainViewController: UIViewController {
    private let converter = ObjToSchematicController()
    private let webContainer = UIView()

    private let statusLabel = UILabel()
    private let convertButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        configureUI()
        loadBridgePage()
    }

    private func configureUI() {
        convertButton.setTitle("Convert Demo OBJ", for: .normal)
        convertButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        convertButton.addTarget(self, action: #selector(handleConvertTap), for: .touchUpInside)
        convertButton.translatesAutoresizingMaskIntoConstraints = false

        statusLabel.font = .systemFont(ofSize: 14, weight: .medium)
        statusLabel.textColor = .secondaryLabel
        statusLabel.text = "Ready"
        statusLabel.numberOfLines = 0
        statusLabel.translatesAutoresizingMaskIntoConstraints = false

        webContainer.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(convertButton)
        view.addSubview(statusLabel)
        view.addSubview(webContainer)

        NSLayoutConstraint.activate([
            convertButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            convertButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            statusLabel.topAnchor.constraint(equalTo: convertButton.bottomAnchor, constant: 16),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            webContainer.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 16),
            webContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webContainer.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func loadBridgePage() {
        do {
            try converter.load(into: webContainer)
        } catch {
            statusLabel.text = "Missing bundled WebAssets"
            NSLog("ObjToSchematicIOS: missing WebAssets - \(error.localizedDescription)")
        }
    }

    @objc
    private func handleConvertTap() {
        convertButton.isEnabled = false
        statusLabel.text = "Running conversion..."

        guard let objPath = objPathForDemo() else {
            statusLabel.text = "Missing demo OBJ in Documents"
            convertButton.isEnabled = true
            return
        }

        converter.convert(objPath: objPath) { [weak self] result in
            guard let self = self else {
                return
            }
            self.convertButton.isEnabled = true
            switch result {
            case .success(let payload):
                self.statusLabel.text = "Done: \(payload.filename) (\(payload.size) bytes)"
            case .failure(let error):
                self.statusLabel.text = "Failed: \(error.localizedDescription)"
            }
        }
    }

    private func objPathForDemo() -> String? {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
        let demoFolder = documents?.appendingPathComponent("ObjToSchematicDemo", isDirectory: true)
        let objURL = demoFolder?.appendingPathComponent("model.obj")
        let mtlURL = demoFolder?.appendingPathComponent("model.mtl")

        guard let folder = demoFolder, let objURL = objURL, let mtlURL = mtlURL else {
            return nil
        }

        if !FileManager.default.fileExists(atPath: folder.path) {
            try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        }

        if !FileManager.default.fileExists(atPath: objURL.path) {
            let obj = [
                "mtllib model.mtl",
                "o Demo",
                "v 0 0 0",
                "v 1 0 0",
                "v 0 1 0",
                "f 1 2 3",
            ].joined(separator: "\n")
            try? obj.write(to: objURL, atomically: true, encoding: .utf8)
        }

        if !FileManager.default.fileExists(atPath: mtlURL.path) {
            let mtl = [
                "newmtl demo",
                "Kd 0.7 0.7 0.7",
            ].joined(separator: "\n")
            try? mtl.write(to: mtlURL, atomically: true, encoding: .utf8)
        }

        return objURL.path
    }
}
