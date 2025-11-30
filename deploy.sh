#!/bin/bash

# OC Movie Finder - Quick Deploy Script
# This is a simple bash wrapper for easy execution

cd "$(dirname "$0")/.."
node server/update_and_deploy.js
