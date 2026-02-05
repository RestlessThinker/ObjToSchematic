# ObjToSchematic iOS Host App

This app hosts the headless web conversion runtime inside `WKWebView`.

## Build web assets

From the repository root:

```bash
npm run build:ios-web
```

That command writes `index.html` and `bundle.js` into `ios/ObjToSchematicIOS/ObjToSchematicIOS/WebAssets/`.

## Run the iOS app

1. Open `ios/ObjToSchematicIOS/ObjToSchematicIOS.xcodeproj` in Xcode.
2. Pick an iOS simulator/device.
3. Run the app.
4. Tap **Convert Truck OBJ**.

The app invokes the JS headless conversion flow and writes the generated `.schem` file to the iOS temporary directory.
The bundled sample input is `3dmodels/truck/model-mobile.obj` plus its `.mtl` and textures.

JS `console.log`/`warn`/`error` output is bridged to Xcode logs via `WKScriptMessageHandler`.

## iOS tests

Run the `ObjToSchematicIOSTests` test target in Xcode.
