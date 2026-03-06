#!/bin/bash
# Fix for folly/coro/Coroutine.h not found with RN 0.81 + Xcode 16
# Sets C++20 as the language standard for all pods
echo "Applying C++20 fix for Folly..."
