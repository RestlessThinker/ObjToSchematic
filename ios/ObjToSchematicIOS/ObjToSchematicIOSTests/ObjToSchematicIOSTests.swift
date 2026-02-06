import ObjToSchematicKit
import XCTest

final class ObjToSchematicIOSTests: XCTestCase {
    func testPackageWebAssetsLoadInAppTarget() throws {
        let bundle = ObjToSchematicController.resourceBundle()
        let indexURL = bundle.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets")
            ?? bundle.url(forResource: "index", withExtension: "html")
        if indexURL == nil {
            let details = [
                "Resource bundle: \(bundle.bundleURL.path)",
                "Main bundle: \(Bundle.main.bundleURL.path)",
                "Module bundle: \(Bundle(for: ObjToSchematicController.self).bundleURL.path)",
            ].joined(separator: " | ")

            throw XCTSkip("Missing WebAssets/index.html. Ensure `npm run build:ios-web` has populated ObjToSchematicKit resources. \(details)")
        }

        XCTAssertNotNil(indexURL)
    }

    func testPathConversionBridgeReturnsResult() throws {
        let controller = ObjToSchematicController()
        let hostView = UIView(frame: CGRect(x: 0, y: 0, width: 300, height: 300))
        let loadExpectation = expectation(description: "web assets loaded")
        do {
            try controller.load(into: hostView) { result in
                switch result {
                case .success:
                    loadExpectation.fulfill()
                case .failure(let error):
                    XCTFail("Failed to load web assets: \(error.localizedDescription)")
                    loadExpectation.fulfill()
                }
            }
        } catch {
            if case ObjToSchematicError.missingWebAssets = error {
                loadExpectation.fulfill()
                throw XCTSkip("Missing WebAssets. Ensure `npm run build:ios-web` has populated ObjToSchematicKit resources.")
            }
            XCTFail("Failed to load web assets: \(error.localizedDescription)")
            loadExpectation.fulfill()
        }

        let demoURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("ObjToSchematicTest", isDirectory: true)
        let objURL = demoURL.appendingPathComponent("model.obj")
        let mtlURL = demoURL.appendingPathComponent("model.mtl")

        try? FileManager.default.createDirectory(at: demoURL, withIntermediateDirectories: true)
        try? [
            "mtllib model.mtl",
            "o Demo",
            "v 0 0 0",
            "v 1 0 0",
            "v 0 1 0",
            "f 1 2 3",
        ].joined(separator: "\n").write(to: objURL, atomically: true, encoding: .utf8)
        try? [
            "newmtl demo",
            "Kd 0.7 0.7 0.7",
        ].joined(separator: "\n").write(to: mtlURL, atomically: true, encoding: .utf8)

        let conversionExpectation = expectation(description: "conversion completes")
        wait(for: [loadExpectation], timeout: 10)

        DispatchQueue.main.async {
            controller.waitForBridgeReady(timeout: 5) { readyResult in
                switch readyResult {
                case .success:
                    controller.convert(objPath: objURL.path) { result in
                        switch result {
                        case .success(let payload):
                            XCTAssertTrue(payload.filename.hasSuffix(".schem"))
                            XCTAssertGreaterThan(payload.size, 0)
                        case .failure(let error):
                            XCTFail("Conversion failed: \(error.localizedDescription)")
                        }
                        conversionExpectation.fulfill()
                    }
                case .failure(let error):
                    XCTFail("Bridge not ready: \(error.localizedDescription)")
                    conversionExpectation.fulfill()
                }
            }
        }

        wait(for: [conversionExpectation], timeout: 30)
    }
}
