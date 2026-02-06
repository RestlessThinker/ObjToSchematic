# ObjToSchematic iOS Host App

This app hosts the headless web conversion runtime inside `WKWebView`.

## Build web assets

From the repository root:

```bash
npm run build:ios-web
```

That command writes `index.html` and `bundle.js` into `ObjToSchematicKit/Sources/ObjToSchematicKit/Resources/WebAssets/`.

## Run the iOS app

1. Open `ios/ObjToSchematicIOS/ObjToSchematicIOS.xcodeproj` in Xcode.
2. Pick an iOS simulator/device.
3. Run the app.
4. Tap **Convert Demo OBJ**.

The app invokes the JS headless conversion flow through the `ObjToSchematicKit` Swift Package and writes the generated `.schem` file to the iOS temporary directory.

JS `console.log`/`warn`/`error` output is bridged to Xcode logs via `WKScriptMessageHandler`.

## iOS tests

Run the `ObjToSchematicIOSTests` test target in Xcode.

## Production path-based conversion API

From Swift, pass a single absolute file path for the `.obj` file using `ObjToSchematicKit`:

```swift
mainViewController.runConversion(objPath: "/absolute/path/to/model.obj") { result in
    // handle success/failure
}
```

The JS runtime resolves `.mtl` and texture siblings relative to that path via the native `fileIORequest` bridge.
