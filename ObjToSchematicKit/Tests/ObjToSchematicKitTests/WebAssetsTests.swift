import XCTest
@testable import ObjToSchematicKit

final class WebAssetsTests: XCTestCase {
    func testWebAssetsBundledInPackage() {
        let indexURL = Bundle.module.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets")
            ?? Bundle.module.url(forResource: "index", withExtension: "html")
        XCTAssertNotNil(indexURL)
    }
}
