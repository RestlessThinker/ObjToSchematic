import XCTest
@testable import ObjToSchematicIOS

final class ObjToSchematicIOSTests: XCTestCase {
    func testWebAssetsAreBundled() {
        let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets")
        XCTAssertNotNil(indexURL)
    }

    func testSampleConversionBridgeReturnsResult() {
        let controller = MainViewController()
        controller.loadViewIfNeeded()

        let expectation = expectation(description: "conversion completes")
        controller.runSampleConversion { result in
            switch result {
            case .success(let payload):
                let filename = payload["filename"] as? String
                let size = payload["size"] as? Int
                XCTAssertEqual(filename?.hasSuffix(".schem"), true)
                XCTAssertNotNil(size)
                XCTAssertGreaterThan(size ?? 0, 0)
            case .failure(let error):
                XCTFail("Conversion failed: \(error.localizedDescription)")
            }
            expectation.fulfill()
        }

        waitForExpectations(timeout: 30)
    }
}
