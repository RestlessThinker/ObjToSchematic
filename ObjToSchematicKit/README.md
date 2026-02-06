# ObjToSchematicKit

Swift Package wrapper for ObjToSchematic headless web runtime.

## Assets

This package ships **prebuilt** web assets under `Resources/WebAssets`. To update them, rebuild and copy:

```bash
npm run build:ios-web
```

These assets must exist before running iOS tests or loading the web view in the host app.

## Usage

```swift
import ObjToSchematicKit

let converter = ObjToSchematicController()
try converter.load(into: containerView)
converter.convert(objPath: "/absolute/path/in/app/container/model.obj") { result in
    // handle ConversionResult
}
```
