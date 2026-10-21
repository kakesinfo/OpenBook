import 'dart:io';
import 'dart:math';

import 'package:image/image.dart' as img;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class CoverImageService {
  static const _maxWidth = 600;
  static const _maxHeight = 900;

  Future<String> storeResizedCover(String sourcePath) async {
    final sourceFile = File(sourcePath);
    final bytes = await sourceFile.readAsBytes();
    final decodedImage = img.decodeImage(bytes);

    if (decodedImage == null) {
      throw Exception('Impossible de lire cette image.');
    }

    final resized = _resizeWithinBounds(decodedImage);
    final outputBytes = img.encodeJpg(resized, quality: 85);

    final appDirectory = await getApplicationDocumentsDirectory();
    final coversDirectory = Directory(p.join(appDirectory.path, 'covers'));
    if (!await coversDirectory.exists()) {
      await coversDirectory.create(recursive: true);
    }

    final fileName = 'cover_${DateTime.now().millisecondsSinceEpoch}_${Random().nextInt(10000)}.jpg';
    final outputPath = p.join(coversDirectory.path, fileName);
    await File(outputPath).writeAsBytes(outputBytes, flush: true);

    return outputPath;
  }

  Future<void> deleteLocalCover(String path) async {
    if (path.isEmpty) {
      return;
    }

    final file = File(path);
    if (await file.exists()) {
      await file.delete();
    }
  }

  bool isLocalCoverPath(String path) {
    if (path.isEmpty) {
      return false;
    }

    return !path.startsWith('http://') && !path.startsWith('https://');
  }

  img.Image _resizeWithinBounds(img.Image image) {
    final width = image.width;
    final height = image.height;

    if (width <= _maxWidth && height <= _maxHeight) {
      return image;
    }

    final widthRatio = _maxWidth / width;
    final heightRatio = _maxHeight / height;
    final ratio = min(widthRatio, heightRatio);

    return img.copyResize(
      image,
      width: (width * ratio).round(),
      height: (height * ratio).round(),
      interpolation: img.Interpolation.cubic,
    );
  }
}
