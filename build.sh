#!/bin/bash

npm rebuild --verbose sharp
cd node_modules/puppeteer
cp ~/.local-chromium . -r
cd ../..