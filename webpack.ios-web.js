const path = require('path');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: './src/ios_web.ts',
    plugins: [
        new NodePolyfillPlugin(),
        new HtmlWebpackPlugin({
            template: './ios/ObjToSchematicIOS/template.html',
            filename: 'index.html',
            inject: 'body',
        }),
    ],
    module: {
        rules: [
            {
                test: /\.worker.ts$/,
                use: [
                    'worker-loader',
                    'ts-loader',
                ],
            },
            {
                test: /\.vs|fs|atlas$/,
                use: 'raw-loader',
                exclude: /\.js$/,
                exclude: /node_modules/,
            },
            {
                test: /\.png$/,
                resourceQuery: /inline/,
                type: 'asset/inline',
                exclude: /node_modules/,
            },
            {
                test: /\.png$/,
                resourceQuery: { not: [/inline/] },
                use: 'file-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(obj|mtl)$/,
                type: 'asset/source',
                exclude: /node_modules/,
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, './ios/ObjToSchematicIOS/ObjToSchematicIOS/WebAssets'),
        clean: true,
    },
    performance: {
        hints: false,
    },
};
