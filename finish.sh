#!/bin/bash
# usage: finish.sh <folder> <name>   -> remux audio.wav + 2-pass compress to <name>-up.mp4 (<10MB)
set -e
cd /d/DishTales-hoathinh/$1
FF=./node_modules/ffmpeg-static/ffmpeg.exe
$FF -y -loglevel error -i video_noaudio.mp4 -i audio.wav -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart $2.mp4
$FF -y -loglevel error -i $2.mp4 -c:v libx264 -preset slow -b:v 720k -pass 1 -passlogfile p2 -an -f mp4 NUL
$FF -y -loglevel error -i $2.mp4 -c:v libx264 -preset slow -b:v 720k -pass 2 -passlogfile p2 -c:a aac -b:a 96k -movflags +faststart $2-up.mp4
rm -f p2*
ls -l $2.mp4 $2-up.mp4
