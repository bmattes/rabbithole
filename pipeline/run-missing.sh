#!/bin/bash
set -e
cd /Users/bmattes/Desktop/RabbitHole/pipeline

DATE=2026-03-09

domains=(
  "americanfootball"
  "basketball"
  "music"
  "comics"
  "food"
  "soccer"
  "geography"
  "literature"
  "military"
  "movies"
  "mythology"
  "philosophy"
  "royals"
  "science"
  "space"
  "sport"
  "tennis"
  "tv"
  "videogames"
  "art"
  "history"
)

for domain in "${domains[@]}"; do
  echo ""
  echo "=== $domain ==="
  npx ts-node src/scripts/run-domain.ts --domain "$domain" --date "$DATE" 2>&1
  echo "=== $domain DONE ==="
done

echo ""
echo "ALL DOMAINS COMPLETE"
