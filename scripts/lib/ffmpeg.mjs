import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobeStatic?.path) ffmpeg.setFfprobePath(ffprobeStatic.path);

export { ffmpeg };

export function probe(file) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

export function runToFile(build) {
  return new Promise((resolve, reject) => {
    build().on('end', resolve).on('error', reject).run();
  });
}
