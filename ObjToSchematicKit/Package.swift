// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ObjToSchematicKit",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "ObjToSchematicKit",
            targets: ["ObjToSchematicKit"]
        )
    ],
    targets: [
        .target(
            name: "ObjToSchematicKit",
            resources: [
                .process("Resources/WebAssets")
            ]
        ),
        .testTarget(
            name: "ObjToSchematicKitTests",
            dependencies: ["ObjToSchematicKit"]
        )
    ]
)
