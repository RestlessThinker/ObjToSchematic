import Foundation
import WebKit

struct FileIOResponse: Encodable {
    let id: String
    let ok: Bool
    let text: String?
    let base64: String?
    let exists: Bool?
    let error: String?

    static func successText(id: String, value: String) -> FileIOResponse {
        return FileIOResponse(id: id, ok: true, text: value, base64: nil, exists: nil, error: nil)
    }

    static func successBase64(id: String, value: String) -> FileIOResponse {
        return FileIOResponse(id: id, ok: true, text: nil, base64: value, exists: nil, error: nil)
    }

    static func successExists(id: String, value: Bool) -> FileIOResponse {
        return FileIOResponse(id: id, ok: true, text: nil, base64: nil, exists: value, error: nil)
    }

    static func failure(id: String, message: String) -> FileIOResponse {
        return FileIOResponse(id: id, ok: false, text: nil, base64: nil, exists: nil, error: message)
    }
}

enum FileIOOperation: String {
    case readText
    case readBase64
    case fileExists
}

struct FileIORequest {
    let id: String
    let operation: FileIOOperation
    let path: String

    init(payload: [String: Any]) throws {
        guard let id = payload["id"] as? String, !id.isEmpty else {
            throw NSError(domain: "ObjToSchematicKit", code: 3001, userInfo: [NSLocalizedDescriptionKey: "Missing request id"])
        }
        guard let operationRaw = payload["operation"] as? String,
              let operation = FileIOOperation(rawValue: operationRaw) else {
            throw NSError(domain: "ObjToSchematicKit", code: 3002, userInfo: [NSLocalizedDescriptionKey: "Unknown file operation"])
        }
        guard let path = payload["path"] as? String, !path.isEmpty else {
            throw NSError(domain: "ObjToSchematicKit", code: 3003, userInfo: [NSLocalizedDescriptionKey: "Missing file path"])
        }

        self.id = id
        self.operation = operation
        self.path = path
    }
}

final class AppFileService {
    private let baseDirectoryURL: URL

    init(baseDirectoryURL: URL = URL(fileURLWithPath: NSHomeDirectory(), isDirectory: true)) {
        self.baseDirectoryURL = baseDirectoryURL.standardizedFileURL
    }

    func readText(at absolutePath: String) throws -> String {
        let url = try validate(path: absolutePath)
        return try String(contentsOf: url, encoding: .utf8)
    }

    func readBase64(at absolutePath: String) throws -> String {
        let url = try validate(path: absolutePath)
        let data = try Data(contentsOf: url)
        return data.base64EncodedString()
    }

    func fileExists(at absolutePath: String) throws -> Bool {
        _ = try validate(path: absolutePath)
        return FileManager.default.fileExists(atPath: absolutePath)
    }

    private func validate(path absolutePath: String) throws -> URL {
        guard absolutePath.hasPrefix("/") else {
            throw NSError(domain: "ObjToSchematicKit", code: 3010, userInfo: [NSLocalizedDescriptionKey: "Path must be absolute"])
        }

        let fileURL = URL(fileURLWithPath: absolutePath).standardizedFileURL
        let basePath = baseDirectoryURL.path
        let candidatePath = fileURL.path

        guard candidatePath == basePath || candidatePath.hasPrefix(basePath + "/") else {
            throw NSError(domain: "ObjToSchematicKit", code: 3011, userInfo: [NSLocalizedDescriptionKey: "Path outside app container is not allowed"])
        }

        return fileURL
    }
}

protocol JavaScriptEvaluating: AnyObject {
    func evaluateJavaScript(_ javaScriptString: String, completionHandler: ((Any?, Error?) -> Void)?)
}

extension WKWebView: JavaScriptEvaluating {}

final class FileIOBridgeHandler: NSObject, WKScriptMessageHandler {
    private weak var evaluator: JavaScriptEvaluating?
    private let fileService: AppFileService

    init(evaluator: JavaScriptEvaluating, fileService: AppFileService = AppFileService()) {
        self.evaluator = evaluator
        self.fileService = fileService
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let payload = message.body as? [String: Any] else {
            NSLog("ObjToSchematicKit [fileIORequest] invalid payload: \(message.body)")
            return
        }

        handle(payload: payload)
    }

    func handle(payload: [String: Any]) {
        let response: FileIOResponse
        do {
            let request = try FileIORequest(payload: payload)
            switch request.operation {
            case .readText:
                response = .successText(id: request.id, value: try fileService.readText(at: request.path))
            case .readBase64:
                response = .successBase64(id: request.id, value: try fileService.readBase64(at: request.path))
            case .fileExists:
                response = .successExists(id: request.id, value: try fileService.fileExists(at: request.path))
            }
        } catch {
            let requestId = (payload["id"] as? String) ?? "unknown"
            response = .failure(id: requestId, message: error.localizedDescription)
        }

        send(response: response)
    }

    private func send(response: FileIOResponse) {
        guard let evaluator = evaluator else {
            return
        }

        do {
            let data = try JSONEncoder().encode(response)
            guard let json = String(data: data, encoding: .utf8) else {
                return
            }
            let script = "window.__objToSchematicResolveFileIO(\(json));"
            evaluator.evaluateJavaScript(script, completionHandler: nil)
        } catch {
            NSLog("ObjToSchematicKit [fileIORequest] failed to encode response: \(error.localizedDescription)")
        }
    }
}
