#!/usr/bin/env bash
# contact sheet: tools/contact.sh <shotDir> <out.png>   (Windows ffmpeg has no glob -> normalise into f_%02d.png)
set -e
DIR="$1"; OUT="$2"
rm -rf "$DIR/seq"; mkdir -p "$DIR/seq"
i=0
for f in "$DIR"/[0-9]*.png; do
  ffmpeg -hide_banner -loglevel error -y -i "$f" -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black" "$DIR/seq/f_$(printf %02d $i).png"
  i=$((i+1))
done
while [ $((i % 4)) -ne 0 ]; do
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i color=black:s=640x360 -frames:v 1 "$DIR/seq/f_$(printf %02d $i).png"
  i=$((i+1))
done
ffmpeg -hide_banner -loglevel error -y -i "$DIR/seq/f_%02d.png" -vf "tile=4x$((i / 4))" -frames:v 1 "$OUT"
rm -rf "$DIR/seq"
echo "$OUT ($i tiles)"
