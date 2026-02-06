import XCTest
@testable import ObjToSchematicKit

private final class MockJavaScriptEvaluator: JavaScriptEvaluating {
    private(set) var scripts: [String] = []

    func evaluateJavaScript(_ javaScriptString: String, completionHandler: ((Any?, Error?) -> Void)?) {
        scripts.append(javaScriptString)
        completionHandler?(nil, nil)
    }
}

final class FileIOBridgeTests: XCTestCase {
    func testAppFileServiceReadsTextAndBase64InsideAllowedDirectory() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: root)
        }

        let fileURL = root.appendingPathComponent("mesh.obj")
        try "hello".write(to: fileURL, atomically: true, encoding: .utf8)

        let service = AppFileService(baseDirectoryURL: root)
        XCTAssertEqual(try service.readText(at: fileURL.path), "hello")
        XCTAssertEqual(try service.fileExists(at: fileURL.path), true)
        XCTAssertEqual(try service.readBase64(at: fileURL.path), Data("hello".utf8).base64EncodedString())
    }

    func testAppFileServiceRejectsOutsideDirectory() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: root)
        }

        let outside = FileManager.default.temporaryDirectory
            .deletingLastPathComponent()
            .appendingPathComponent("outside.txt")
        try "x".write(to: outside, atomically: true, encoding: .utf8)
        defer {
            try? FileManager.default.removeItem(at: outside)
        }

        let service = AppFileService(baseDirectoryURL: root)
        XCTAssertThrowsError(try service.readText(at: outside.path))
    }

    func testFileIOBridgeHandlerEmitsResolveScript() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: root)
        }

        let fileURL = root.appendingPathComponent("mesh.obj")
        try "mesh-data".write(to: fileURL, atomically: true, encoding: .utf8)

        let evaluator = MockJavaScriptEvaluator()
        let handler = FileIOBridgeHandler(evaluator: evaluator, fileService: AppFileService(baseDirectoryURL: root))

        handler.handle(payload: [
            "id": "123",
            "operation": "readText",
            "path": fileURL.path,
        ])

        XCTAssertEqual(evaluator.scripts.count, 1)
        let script = evaluator.scripts[0]
        XCTAssertTrue(script.contains("window.__objToSchematicResolveFileIO("))
        XCTAssertTrue(script.contains("\"id\":\"123\""))
        XCTAssertTrue(script.contains("\"ok\":true"))
    }
}
